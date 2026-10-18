import net from 'net';
import { db } from '../../db/index.js';
import { io } from '../../index.js';

export interface PrintTicketItem {
  name: string;
  quantity: number;
  price?: number;
  notes?: string;
}

export interface PrintJobData {
  station: 'kitchen' | 'bar' | 'cashier';
  title: string;
  tableNumber: string | number;
  tableName: string;
  waiterName: string;
  orderNumber?: string;
  timestamp: string;
  items: PrintTicketItem[];
  subtotal?: number;
  tax16?: number;
  levy2?: number;
  total?: number;
  paymentMethod?: string;
  paidAmount?: number;
  changeAmount?: number;
  tipAmount?: number;
}

export class PrinterService {
  // ESC/POS Command Constants
  private static ESC = '\x1b';
  private static GS = '\x1d';
  private static CMD_INIT = '\x1b@';
  private static CMD_ALIGN_CENTER = '\x1ba1';
  private static CMD_ALIGN_LEFT = '\x1ba0';
  private static CMD_ALIGN_RIGHT = '\x1ba2';
  private static CMD_BOLD_ON = '\x1bE1';
  private static CMD_BOLD_OFF = '\x1bE0';
  private static CMD_DOUBLE_SIZE = '\x1d!11';
  private static CMD_NORMAL_SIZE = '\x1d!00';
  private static CMD_CUT = '\x1dVA3';

  static async printTicket(data: PrintJobData): Promise<{ success: boolean; message: string }> {
    // 1. Get printer config from DB
    const printer = db.prepare('SELECT * FROM printer_settings WHERE station = ? AND is_active = 1').get(data.station) as any;

    // 2. Always emit web print event for client display & browser fallback
    io.emit('printer:job', data);

    if (!printer) {
      console.log(`[Printer] No active printer configured for ${data.station}. Broadcasted to browser.`);
      return { success: true, message: `No physical printer configured for ${data.station}; dispatched to web.` };
    }

    if (printer.printer_type === 'browser_preview' || !printer.ip_address) {
      console.log(`[Printer] ${data.station} is in browser preview mode.`);
      return { success: true, message: `Dispatched to browser preview for ${data.station}.` };
    }

    // 3. Physical ESC/POS network print via TCP Socket
    try {
      const escposBuffer = this.buildEscPosPayload(data);
      await this.sendRawTcp(printer.ip_address, printer.port || 9100, escposBuffer);
      return { success: true, message: `Sent to printer ${printer.name} at ${printer.ip_address}:${printer.port}` };
    } catch (err: any) {
      console.error(`[Printer] Network print failed for ${data.station} (${printer.ip_address}):`, err.message);
      return { success: false, message: `Physical print failed: ${err.message}. Ticket remains available in web preview.` };
    }
  }

  private static buildEscPosPayload(data: PrintJobData): Buffer {
    let text = '';
    text += this.CMD_INIT;
    text += this.CMD_ALIGN_CENTER;
    text += this.CMD_BOLD_ON;
    text += this.CMD_DOUBLE_SIZE;
    text += `KENIA RMS\n`;
    text += this.CMD_NORMAL_SIZE;
    text += `*** ${data.title.toUpperCase()} ***\n`;
    text += this.CMD_BOLD_OFF;
    text += `Station: ${data.station.toUpperCase()}\n`;
    text += `--------------------------------\n`;

    text += this.CMD_ALIGN_LEFT;
    text += `Table: ${data.tableName} (#${data.tableNumber})\n`;
    text += `Waiter: ${data.waiterName}\n`;
    text += `Time:  ${new Date(data.timestamp).toLocaleTimeString('en-GB')}\n`;
    text += `================================\n`;

    for (const item of data.items) {
      text += this.CMD_BOLD_ON;
      text += `${item.quantity}x  ${item.name}\n`;
      text += this.CMD_BOLD_OFF;
      if (item.notes) {
        text += `    >> NOTE: ${item.notes}\n`;
      }
      if (item.price !== undefined) {
        text += `    Price: KES ${(item.quantity * item.price).toFixed(2)}\n`;
      }
    }

    text += `--------------------------------\n`;

    if (data.total !== undefined) {
      text += this.CMD_ALIGN_RIGHT;
      if (data.subtotal) text += `Net Subtotal: KES ${data.subtotal.toFixed(2)}\n`;
      if (data.tax16) text += `VAT (16%):    KES ${data.tax16.toFixed(2)}\n`;
      if (data.levy2) text += `Catering (2%):KES ${data.levy2.toFixed(2)}\n`;
      text += this.CMD_BOLD_ON;
      text += this.CMD_DOUBLE_SIZE;
      text += `TOTAL: KES ${data.total.toFixed(2)}\n`;
      text += this.CMD_NORMAL_SIZE;
      text += this.CMD_BOLD_OFF;

      if (data.paymentMethod) {
        text += `Payment: ${data.paymentMethod.toUpperCase()}\n`;
      }
      if (data.paidAmount) {
        text += `Paid:    KES ${data.paidAmount.toFixed(2)}\n`;
      }
      if (data.changeAmount) {
        text += `Change:  KES ${data.changeAmount.toFixed(2)}\n`;
      }
      if (data.tipAmount && data.tipAmount > 0) {
        text += `Tip:     KES ${data.tipAmount.toFixed(2)}\n`;
      }
    }

    text += this.CMD_ALIGN_CENTER;
    text += `\nAsante Sana! Thank you!\n`;
    text += `Powered by KeniaRMS\n\n\n`;
    text += this.CMD_CUT;

    return Buffer.from(text, 'latin1');
  }

  private static sendRawTcp(host: string, port: number, buffer: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      const client = new net.Socket();
      client.setTimeout(4000);

      client.connect(port, host, () => {
        client.write(buffer, () => {
          client.end();
          resolve();
        });
      });

      client.on('error', (err) => {
        client.destroy();
        reject(err);
      });

      client.on('timeout', () => {
        client.destroy();
        reject(new Error(`Connection to printer at ${host}:${port} timed out.`));
      });
    });
  }
}
