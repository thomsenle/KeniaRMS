import { Router, Request, Response } from 'express';
import { db } from '../../db/index.js';
import { PrinterService } from './printer.service.js';

export const printerRouter = Router();

printerRouter.get('/', (_req: Request, res: Response) => {
  try {
    const printers = db.prepare('SELECT * FROM printer_settings ORDER BY station ASC').all();
    res.json({ success: true, printers });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

printerRouter.put('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, printer_type, ip_address, port, is_active } = req.body;

    db.prepare(`
      UPDATE printer_settings 
      SET name = ?, printer_type = ?, ip_address = ?, port = ?, is_active = ?
      WHERE id = ?
    `).run(name, printer_type, ip_address, Number(port) || 9100, is_active ? 1 : 0, id);

    const updated = db.prepare('SELECT * FROM printer_settings WHERE id = ?').get(id);
    res.json({ success: true, printer: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

printerRouter.post('/:id/test', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const printer = db.prepare('SELECT * FROM printer_settings WHERE id = ?').get(id) as any;
    if (!printer) {
      return res.status(404).json({ success: false, message: 'Printer not found' });
    }

    const result = await PrinterService.printTicket({
      station: printer.station,
      title: 'TEST PRINT',
      tableNumber: 1,
      tableName: 'Test Table',
      waiterName: 'Admin / System Test',
      timestamp: new Date().toISOString(),
      items: [
        { name: '1x Test Dish / Drink', quantity: 1, price: 100 },
        { name: '1x Printer Connectivity Check', quantity: 1, price: 0, notes: 'ESC/POS Socket OK' }
      ],
      subtotal: 100,
      tax16: 16,
      levy2: 2,
      total: 118
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});
