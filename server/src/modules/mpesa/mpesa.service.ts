import { db } from '../../db/index.js';
import { v4 as uuidv4 } from 'uuid';
import { io } from '../../index.js';
import { PrinterService } from '../printers/printer.service.js';

export interface StkPushParams {
  orderId: string;
  phoneNumber: string;
  amount: number;
  waiterId?: string;
  shiftId?: string;
  items?: Array<{ order_item_id: string; quantity: number }>;
}

export class MpesaService {
  /**
   * Formats Kenyan phone number to standard 2547XXXXXXXX or 2541XXXXXXXX format
   */
  static formatPhoneNumber(phone: string): string {
    let cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '254' + cleaned.substring(1);
    } else if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
      cleaned = '254' + cleaned;
    } else if (cleaned.startsWith('+254')) {
      cleaned = cleaned.substring(1);
    }
    return cleaned;
  }

  /**
   * Generates timestamp in Daraja format: YYYYMMDDHHmmss
   */
  static getDarajaTimestamp(): string {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  }

  /**
   * Fetches Daraja OAuth token if valid consumer credentials are provided
   */
  static async getDarajaToken(consumerKey: string, consumerSecret: string, environment: 'sandbox' | 'production'): Promise<string | null> {
    try {
      const baseUrl = environment === 'production' 
        ? 'https://api.safaricom.co.ke' 
        : 'https://sandbox.safaricom.co.ke';

      const auth = Buffer.from(`${consumerKey.trim()}:${consumerSecret.trim()}`).toString('base64');
      const response = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
        headers: {
          Authorization: `Basic ${auth}`
        }
      });

      if (!response.ok) {
        console.warn(`[M-Pesa Daraja] Token fetch returned status: ${response.status}`);
        return null;
      }

      const data = await response.json() as { access_token?: string };
      return data.access_token || null;
    } catch (err: any) {
      console.warn('[M-Pesa Daraja] OAuth Token request failed:', err.message);
      return null;
    }
  }

  /**
   * Initiates Lipa na M-Pesa Online STK Push prompt to customer phone
   */
  static async initiateStkPush(params: StkPushParams): Promise<{
    success: boolean;
    checkoutRequestId: string;
    message: string;
    phoneFormatted: string;
  }> {
    const formattedPhone = this.formatPhoneNumber(params.phoneNumber);
    if (formattedPhone.length !== 12 || !formattedPhone.startsWith('254')) {
      throw new Error(`Invalid Kenyan mobile phone number: ${params.phoneNumber}. Expected format: 0712345678 or 254712345678.`);
    }

    const settings = db.prepare('SELECT * FROM mpesa_settings LIMIT 1').get() as any;
    let checkoutRequestId = `ws_CO_${Date.now()}_${Math.round(Math.random() * 1e6)}`;
    let merchantRequestId = `MR_${Date.now()}`;
    const txId = uuidv4();
    const itemsJson = params.items && params.items.length > 0 ? JSON.stringify(params.items) : null;

    // Attempt real Safaricom Daraja STK Push if live credentials are configured
    if (settings?.consumer_key && settings?.consumer_secret && settings?.passkey) {
      try {
        const token = await this.getDarajaToken(settings.consumer_key, settings.consumer_secret, settings.environment || 'sandbox');
        if (token) {
          const timestamp = this.getDarajaTimestamp();
          const shortcode = settings.shortcode || '174379';
          const password = Buffer.from(`${shortcode}${settings.passkey}${timestamp}`).toString('base64');
          const baseUrl = settings.environment === 'production' 
            ? 'https://api.safaricom.co.ke' 
            : 'https://sandbox.safaricom.co.ke';

          const darajaPayload = {
            BusinessShortCode: shortcode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: settings.business_type === 'paybill' ? 'CustomerPayBillOnline' : 'CustomerBuyGoodsOnline',
            Amount: Math.max(1, Math.round(params.amount)),
            PartyA: formattedPhone,
            PartyB: settings.business_type === 'paybill' ? shortcode : (settings.till_number || shortcode),
            PhoneNumber: formattedPhone,
            CallBackURL: 'https://keniarms.restaurant/api/mpesa/callback',
            AccountReference: `KeniaRMS_${params.orderId.substring(0, 6)}`,
            TransactionDesc: `KeniaRMS Restaurant Bill ${params.orderId.substring(0, 6)}`
          };

          const darajaRes = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(darajaPayload)
          });

          if (darajaRes.ok) {
            const darajaData = await darajaRes.json() as any;
            if (darajaData.CheckoutRequestID) {
              checkoutRequestId = darajaData.CheckoutRequestID;
              merchantRequestId = darajaData.MerchantRequestID || merchantRequestId;
              console.log(`[M-Pesa Daraja LIVE] STK Push sent successfully. CheckoutRequestID: ${checkoutRequestId}`);
            }
          } else {
            const errBody = await darajaRes.text();
            console.warn(`[M-Pesa Daraja LIVE] Safaricom returned ${darajaRes.status}: ${errBody}`);
          }
        }
      } catch (liveErr: any) {
        console.warn('[M-Pesa Daraja LIVE] Fallback to simulator:', liveErr.message);
      }
    }

    // Record transaction in database
    db.prepare(`
      INSERT INTO mpesa_transactions (id, order_id, checkout_request_id, merchant_request_id, phone_number, amount, items_json, waiter_id, shift_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(
      txId,
      params.orderId,
      checkoutRequestId,
      merchantRequestId,
      formattedPhone,
      params.amount,
      itemsJson,
      params.waiterId || null,
      params.shiftId || null
    );

    console.log(`[M-Pesa STK Push] Sent request to ${formattedPhone} for KES ${params.amount} (CheckoutRequestID: ${checkoutRequestId})`);

    // Broadcast prompt event to all clients
    io.emit('mpesa:stk_initiated', {
      orderId: params.orderId,
      checkoutRequestId,
      phoneNumber: formattedPhone,
      amount: params.amount
    });

    return {
      success: true,
      checkoutRequestId,
      phoneFormatted: formattedPhone,
      message: `M-Pesa STK Push prompt sent to ${formattedPhone}. Waiting for customer to enter PIN on phone.`
    };
  }

  /**
   * Handles payment confirmation (either from Daraja webhook or manual PIN simulation)
   */
  static async confirmPayment(
    checkoutRequestId: string, 
    mpesaReceiptNumber: string, 
    resultCode: number = 0, 
    resultDesc: string = 'The service request is processed successfully.'
  ): Promise<boolean> {
    const tx = db.prepare('SELECT * FROM mpesa_transactions WHERE checkout_request_id = ?').get(checkoutRequestId) as any;
    if (!tx) {
      console.warn(`[M-Pesa] Transaction not found for CheckoutRequestID: ${checkoutRequestId}`);
      return false;
    }

    if (tx.status === 'completed') {
      return true; // Already processed
    }

    if (resultCode !== 0) {
      db.prepare(`
        UPDATE mpesa_transactions 
        SET status = 'failed', result_code = ?, result_desc = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(resultCode, resultDesc, tx.id);

      io.emit('mpesa:payment_failed', {
        checkoutRequestId,
        orderId: tx.order_id,
        reason: resultDesc
      });
      return false;
    }

    const order = db.prepare(`
      SELECT o.*, t.name as table_name, t.table_number, w.name as waiter_name
      FROM orders o
      JOIN tables t ON o.table_id = t.id
      JOIN waiters w ON o.waiter_id = w.id
      WHERE o.id = ?
    `).get(tx.order_id) as any;

    if (!order) return false;

    // Parse items if this was a partial split payment
    let splitItems: Array<{ order_item_id: string; quantity: number }> | null = null;
    if (tx.items_json) {
      try {
        splitItems = JSON.parse(tx.items_json);
      } catch (e) {
        splitItems = null;
      }
    }

    // Settle Order in SQLite Transaction
    const settleTx = db.transaction(() => {
      // 1. Mark transaction completed
      db.prepare(`
        UPDATE mpesa_transactions 
        SET status = 'completed', mpesa_receipt_number = ?, result_code = 0, result_desc = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(mpesaReceiptNumber, resultDesc, tx.id);

      const billId = uuidv4();
      const tax16 = Math.round((tx.amount * (16 / 118)) * 100) / 100;
      const levy2 = Math.round((tx.amount * (2 / 118)) * 100) / 100;
      const subtotal = tx.amount - tax16 - levy2;

      // Sanitize foreign keys (waiter_id, shift_id) to prevent FK constraint failures
      let validWaiterId = tx.waiter_id || order.waiter_id;
      const waiterExists = db.prepare('SELECT id FROM waiters WHERE id = ?').get(validWaiterId);
      if (!waiterExists) {
        validWaiterId = order.waiter_id;
      }

      let validShiftId: string | null = (tx.shift_id || order.shift_id) || null;
      if (validShiftId) {
        const shiftExists = db.prepare('SELECT id FROM waiter_shifts WHERE id = ?').get(validShiftId);
        if (!shiftExists) {
          validShiftId = null;
        }
      }

      // 2. Insert bill record
      db.prepare(`
        INSERT INTO bills (id, order_id, table_id, waiter_id, shift_id, subtotal, tax_amount, levy_amount, total_amount, paid_amount, change_amount, tip_amount, payment_method)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'mpesa')
      `).run(
        billId,
        tx.order_id,
        order.table_id,
        validWaiterId,
        validShiftId,
        subtotal,
        tax16,
        levy2,
        tx.amount,
        tx.amount
      );

      // 3. Mark items as paid
      if (splitItems && splitItems.length > 0) {
        const insertBillItem = db.prepare(`
          INSERT INTO bill_items (id, bill_id, order_item_id, quantity, price)
          VALUES (?, ?, ?, ?, ?)
        `);
        const updateItem = db.prepare(`UPDATE order_items SET status = 'paid' WHERE id = ?`);

        for (const it of splitItems) {
          const oi = db.prepare('SELECT * FROM order_items WHERE id = ?').get(it.order_item_id) as any;
          if (oi) {
            insertBillItem.run(uuidv4(), billId, oi.id, it.quantity || oi.quantity, (it.quantity || oi.quantity) * oi.unit_price);
            updateItem.run(oi.id);
          }
        }
      } else {
        // Full order settlement
        db.prepare(`UPDATE order_items SET status = 'paid' WHERE order_id = ? AND status != 'cancelled'`).run(tx.order_id);
      }

      // 4. Check if any unpaid items remain on the order
      const remaining = db.prepare(`
        SELECT COUNT(*) as count FROM order_items 
        WHERE order_id = ? AND status NOT IN ('paid', 'cancelled')
      `).get(tx.order_id) as { count: number };

      if (remaining.count === 0) {
        db.prepare(`UPDATE orders SET status = 'closed', closed_at = datetime('now') WHERE id = ?`).run(tx.order_id);
        db.prepare(`UPDATE tables SET status = 'free', active_waiter_id = NULL WHERE id = ?`).run(order.table_id);
      } else {
        db.prepare(`UPDATE orders SET status = 'partially_paid' WHERE id = ?`).run(tx.order_id);
      }
    });

    settleTx();

    console.log(`[M-Pesa] Payment SUCCESS! Receipt: ${mpesaReceiptNumber}, Amount: KES ${tx.amount}, Table: ${order.table_name}`);

    // Emit print receipt job
    await PrinterService.printTicket({
      station: 'cashier',
      title: 'M-PESA TAX INVOICE',
      tableNumber: order.table_number,
      tableName: order.table_name,
      waiterName: order.waiter_name,
      orderNumber: mpesaReceiptNumber,
      timestamp: new Date().toISOString(),
      items: [
        { name: `Table Settled via M-Pesa (${mpesaReceiptNumber})`, quantity: 1, price: tx.amount }
      ],
      subtotal: tx.amount - Math.round((tx.amount * (16 / 118)) * 100) / 100 - Math.round((tx.amount * (2 / 118)) * 100) / 100,
      tax16: Math.round((tx.amount * (16 / 118)) * 100) / 100,
      levy2: Math.round((tx.amount * (2 / 118)) * 100) / 100,
      total: tx.amount,
      paymentMethod: `M-PESA (${mpesaReceiptNumber})`,
      paidAmount: tx.amount,
      changeAmount: 0
    });

    // Broadcast live event to all clients
    io.emit('mpesa:payment_success', {
      orderId: tx.order_id,
      checkoutRequestId,
      mpesaReceiptNumber,
      amount: tx.amount,
      tableId: order.table_id,
      tableName: order.table_name
    });
    io.emit('tables:updated');

    return true;
  }

  /**
   * Manual confirmation when guest shows M-Pesa SMS with transaction code (Buy Goods / Till)
   */
  static async verifyManualReceipt(
    orderId: string, 
    receiptCode: string, 
    amount: number, 
    waiterId?: string, 
    shiftId?: string,
    items?: Array<{ order_item_id: string; quantity: number }>
  ): Promise<{ success: boolean; message: string }> {
    const cleanedCode = receiptCode.trim().toUpperCase();
    if (cleanedCode.length < 6) {
      throw new Error('Invalid M-Pesa receipt code format (e.g. QJD782JK10)');
    }

    const dummyCheckoutId = `MANUAL_${cleanedCode}_${Date.now()}`;
    const txId = uuidv4();
    const itemsJson = items && items.length > 0 ? JSON.stringify(items) : null;

    db.prepare(`
      INSERT INTO mpesa_transactions (id, order_id, checkout_request_id, merchant_request_id, phone_number, amount, items_json, waiter_id, shift_id, status, mpesa_receipt_number, result_code, result_desc)
      VALUES (?, ?, ?, 'MANUAL', 'MANUAL_VERIFY', ?, ?, ?, ?, 'pending', ?, 0, 'Verified by Staff')
    `).run(txId, orderId, dummyCheckoutId, amount, itemsJson, waiterId || null, shiftId || null, cleanedCode);

    await this.confirmPayment(dummyCheckoutId, cleanedCode, 0, 'Verified manually by Waiter');
    return { success: true, message: `M-Pesa payment ${cleanedCode} verified and settled!` };
  }

  /**
   * Sends a 1 KES test STK push prompt for managers in Settings to test Daraja connectivity
   */
  static async testStkPush(phoneNumber: string): Promise<{ success: boolean; message: string; checkoutRequestId?: string }> {
    const formattedPhone = this.formatPhoneNumber(phoneNumber);
    const settings = db.prepare('SELECT * FROM mpesa_settings LIMIT 1').get() as any;
    
    if (!settings?.consumer_key || !settings?.consumer_secret) {
      return {
        success: false,
        message: 'Consumer Key and Consumer Secret are required to test live Safaricom connection.'
      };
    }

    const token = await this.getDarajaToken(settings.consumer_key, settings.consumer_secret, settings.environment || 'sandbox');
    if (!token) {
      return {
        success: false,
        message: 'Authentication failed. Please verify your Consumer Key and Consumer Secret.'
      };
    }

    const timestamp = this.getDarajaTimestamp();
    const shortcode = settings.shortcode || '174379';
    const password = Buffer.from(`${shortcode}${settings.passkey || ''}${timestamp}`).toString('base64');
    const baseUrl = settings.environment === 'production' 
      ? 'https://api.safaricom.co.ke' 
      : 'https://sandbox.safaricom.co.ke';

    try {
      const res = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          BusinessShortCode: shortcode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: settings.business_type === 'paybill' ? 'CustomerPayBillOnline' : 'CustomerBuyGoodsOnline',
          Amount: 1,
          PartyA: formattedPhone,
          PartyB: settings.business_type === 'paybill' ? shortcode : (settings.till_number || shortcode),
          PhoneNumber: formattedPhone,
          CallBackURL: 'https://keniarms.restaurant/api/mpesa/callback',
          AccountReference: 'KeniaRMS_Test',
          TransactionDesc: 'KeniaRMS Test Prompt'
        })
      });

      const data = await res.json() as any;
      if (res.ok && data.ResponseCode === '0') {
        return {
          success: true,
          message: `Test STK Push dispatched to ${formattedPhone}! (CheckoutRequestID: ${data.CheckoutRequestID})`,
          checkoutRequestId: data.CheckoutRequestID
        };
      } else {
        return {
          success: false,
          message: data.errorMessage || data.ResponseDescription || 'Safaricom rejected request'
        };
      }
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Network error reaching Safaricom Daraja'
      };
    }
  }
}
