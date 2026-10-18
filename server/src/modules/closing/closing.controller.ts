import { Request, Response } from 'express';
import { db } from '../../db/index.js';
import { v4 as uuidv4 } from 'uuid';
import { PrinterService } from '../printers/printer.service.js';

export class ClosingController {
  static getTodayPreview(_req: Request, res: Response) {
    try {
      const todayDate = new Date().toISOString().split('T')[0];

      // Aggregate all bills paid today
      const billsSummary = db.prepare(`
        SELECT 
          COUNT(*) as total_bills,
          COALESCE(SUM(total_amount), 0) as total_gross,
          COALESCE(SUM(subtotal), 0) as total_net,
          COALESCE(SUM(tax_amount), 0) as total_vat16,
          COALESCE(SUM(levy_amount), 0) as total_levy2,
          COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total_amount ELSE 0 END), 0) as total_cash,
          COALESCE(SUM(CASE WHEN payment_method = 'card' THEN total_amount ELSE 0 END), 0) as total_card,
          COALESCE(SUM(CASE WHEN payment_method = 'mpesa' THEN total_amount ELSE 0 END), 0) as total_mpesa,
          COALESCE(SUM(tip_amount), 0) as total_tips
        FROM bills
        WHERE date(created_at) = ?
      `).get(todayDate) as any;

      // Waiter breakdown for today
      const waiterBreakdown = db.prepare(`
        SELECT 
          w.id as waiter_id,
          w.name as waiter_name,
          COUNT(b.id) as orders_served,
          COALESCE(SUM(b.total_amount), 0) as gross_sales,
          COALESCE(SUM(CASE WHEN b.payment_method = 'cash' THEN b.total_amount ELSE 0 END), 0) as cash_sales,
          COALESCE(SUM(CASE WHEN b.payment_method = 'card' THEN b.total_amount ELSE 0 END), 0) as card_sales,
          COALESCE(SUM(CASE WHEN b.payment_method = 'mpesa' THEN b.total_amount ELSE 0 END), 0) as mpesa_sales,
          COALESCE(SUM(b.tip_amount), 0) as tips
        FROM waiters w
        LEFT JOIN bills b ON w.id = b.waiter_id AND date(b.created_at) = ?
        GROUP BY w.id
        ORDER BY gross_sales DESC
      `).all(todayDate);

      // Check open shifts
      const openShifts = db.prepare(`
        SELECT ws.*, w.name as waiter_name
        FROM waiter_shifts ws
        JOIN waiters w ON ws.waiter_id = w.id
        WHERE ws.status = 'open'
      `).all();

      // Check if already closed today
      const existingClosing = db.prepare('SELECT * FROM daily_closings WHERE closing_date = ?').get(todayDate);

      res.json({
        success: true,
        date: todayDate,
        isAlreadyClosed: !!existingClosing,
        existingClosing: existingClosing || null,
        openShiftsCount: openShifts.length,
        openShifts,
        summary: billsSummary,
        waiters: waiterBreakdown
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static async executeDailyClosing(req: Request, res: Response) {
    try {
      const { closed_by_waiter_id, notes } = req.body;
      const todayDate = new Date().toISOString().split('T')[0];

      // Check if open tables remain
      const openTables = db.prepare('SELECT COUNT(*) as count FROM tables WHERE status != \'free\'').get() as { count: number };
      if (openTables.count > 0) {
        return res.status(400).json({ 
          success: false, 
          message: `Cannot execute daily closing: There are still ${openTables.count} occupied table(s). Settle or cancel open tables first.` 
        });
      }

      // Aggregate today's figures
      const summary = db.prepare(`
        SELECT 
          COUNT(*) as total_bills,
          COALESCE(SUM(total_amount), 0) as total_gross,
          COALESCE(SUM(subtotal), 0) as total_net,
          COALESCE(SUM(tax_amount), 0) as total_vat16,
          COALESCE(SUM(levy_amount), 0) as total_levy2,
          COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total_amount ELSE 0 END), 0) as total_cash,
          COALESCE(SUM(CASE WHEN payment_method = 'card' THEN total_amount ELSE 0 END), 0) as total_card,
          COALESCE(SUM(CASE WHEN payment_method = 'mpesa' THEN total_amount ELSE 0 END), 0) as total_mpesa,
          COALESCE(SUM(tip_amount), 0) as total_tips
        FROM bills
        WHERE date(created_at) = ?
      `).get(todayDate) as any;

      const closingId = uuidv4();

      db.prepare(`
        INSERT OR REPLACE INTO daily_closings 
        (id, closing_date, closed_at, closed_by_waiter_id, total_gross_sales, total_net_sales, total_tax_16, total_levy_2, total_cash, total_card, total_mpesa, total_tips, total_orders_count, notes)
        VALUES (?, ?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        closingId,
        todayDate,
        closed_by_waiter_id || null,
        summary.total_gross,
        summary.total_net,
        summary.total_vat16,
        summary.total_levy2,
        summary.total_cash,
        summary.total_card,
        summary.total_mpesa,
        summary.total_tips,
        summary.total_bills,
        notes || ''
      );

      // Print Z-Report
      await PrinterService.printTicket({
        station: 'cashier',
        title: 'DAILY Z-REPORT CLOSING',
        tableNumber: 0,
        tableName: 'Z-REPORT',
        waiterName: 'Manager / Audit',
        timestamp: new Date().toISOString(),
        items: [
          { name: `Total Orders: ${summary.total_bills}`, quantity: 1, price: summary.total_gross },
          { name: `Cash Collected`, quantity: 1, price: summary.total_cash },
          { name: `Card Payments`, quantity: 1, price: summary.total_card },
          { name: `M-Pesa Mobile`, quantity: 1, price: summary.total_mpesa }
        ],
        subtotal: summary.total_net,
        tax16: summary.total_vat16,
        levy2: summary.total_levy2,
        total: summary.total_gross,
        tipAmount: summary.total_tips
      });

      res.json({
        success: true,
        closingId,
        date: todayDate,
        summary,
        message: 'Daily Z-Closing completed successfully.'
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static getHistory(_req: Request, res: Response) {
    try {
      const closings = db.prepare(`
        SELECT dc.*, w.name as closed_by_name
        FROM daily_closings dc
        LEFT JOIN waiters w ON dc.closed_by_waiter_id = w.id
        ORDER BY dc.closing_date DESC
      `).all();

      res.json({ success: true, closings });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static getMonthlyReport(req: Request, res: Response) {
    try {
      const year = req.query.year || new Date().getFullYear().toString();
      const month = req.query.month ? String(req.query.month).padStart(2, '0') : String(new Date().getMonth() + 1).padStart(2, '0');
      const yearMonth = `${year}-${month}`;

      // Daily breakdown for that month
      const days = db.prepare(`
        SELECT 
          date(created_at) as day,
          COUNT(*) as bills_count,
          COALESCE(SUM(total_amount), 0) as gross,
          COALESCE(SUM(subtotal), 0) as net,
          COALESCE(SUM(tax_amount), 0) as vat16,
          COALESCE(SUM(levy_amount), 0) as levy2,
          COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total_amount ELSE 0 END), 0) as cash,
          COALESCE(SUM(CASE WHEN payment_method = 'card' THEN total_amount ELSE 0 END), 0) as card,
          COALESCE(SUM(CASE WHEN payment_method = 'mpesa' THEN total_amount ELSE 0 END), 0) as mpesa,
          COALESCE(SUM(tip_amount), 0) as tips
        FROM bills
        WHERE strftime('%Y-%m', created_at) = ?
        GROUP BY day
        ORDER BY day ASC
      `).all(yearMonth) as any[];

      // Monthly grand totals
      const totals = days.reduce((acc, d) => ({
        bills_count: acc.bills_count + d.bills_count,
        gross: acc.gross + d.gross,
        net: acc.net + d.net,
        vat16: acc.vat16 + d.vat16,
        levy2: acc.levy2 + d.levy2,
        cash: acc.cash + d.cash,
        card: acc.card + d.card,
        mpesa: acc.mpesa + d.mpesa,
        tips: acc.tips + d.tips
      }), { bills_count: 0, gross: 0, net: 0, vat16: 0, levy2: 0, cash: 0, card: 0, mpesa: 0, tips: 0 });

      res.json({
        success: true,
        yearMonth,
        totals,
        days
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static async reprintToday(_req: Request, res: Response) {
    try {
      const todayDate = new Date().toISOString().split('T')[0];
      const summary = db.prepare(`
        SELECT 
          COUNT(*) as total_bills,
          COALESCE(SUM(total_amount), 0) as total_gross,
          COALESCE(SUM(subtotal), 0) as total_net,
          COALESCE(SUM(tax_amount), 0) as total_vat16,
          COALESCE(SUM(levy_amount), 0) as total_levy2,
          COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total_amount ELSE 0 END), 0) as total_cash,
          COALESCE(SUM(CASE WHEN payment_method = 'card' THEN total_amount ELSE 0 END), 0) as total_card,
          COALESCE(SUM(CASE WHEN payment_method = 'mpesa' THEN total_amount ELSE 0 END), 0) as total_mpesa,
          COALESCE(SUM(tip_amount), 0) as total_tips
        FROM bills
        WHERE date(created_at) = ?
      `).get(todayDate) as any;

      await PrinterService.printTicket({
        station: 'cashier',
        title: `DAILY Z-REPORT (${todayDate})`,
        tableNumber: 0,
        tableName: 'DAILY AUDIT',
        waiterName: 'Manager / Auditor',
        timestamp: new Date().toISOString(),
        items: [
          { name: `Total Orders: ${summary.total_bills}`, quantity: 1, price: summary.total_gross },
          { name: `Cash Collected`, quantity: 1, price: summary.total_cash },
          { name: `Card Payments`, quantity: 1, price: summary.total_card },
          { name: `M-Pesa Mobile`, quantity: 1, price: summary.total_mpesa }
        ],
        subtotal: summary.total_net,
        tax16: summary.total_vat16,
        levy2: summary.total_levy2,
        total: summary.total_gross,
        tipAmount: summary.total_tips
      });

      res.json({ success: true, message: `Z-Report printed to cashier station.` });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static async reprintClosing(req: Request, res: Response) {
    try {
      const { closingId } = req.params;
      const closing = db.prepare('SELECT * FROM daily_closings WHERE id = ?').get(closingId) as any;
      if (!closing) {
        return res.status(404).json({ success: false, message: 'Closing record not found' });
      }

      await PrinterService.printTicket({
        station: 'cashier',
        title: `Z-REPORT (${closing.closing_date})`,
        tableNumber: 0,
        tableName: 'Z-REPORT REPRINT',
        waiterName: 'Auditor',
        timestamp: closing.closed_at || new Date().toISOString(),
        items: [
          { name: `Total Orders: ${closing.total_orders_count}`, quantity: 1, price: closing.total_gross_sales },
          { name: `Cash Collected`, quantity: 1, price: closing.total_cash },
          { name: `Card Payments`, quantity: 1, price: closing.total_card },
          { name: `M-Pesa Mobile`, quantity: 1, price: closing.total_mpesa }
        ],
        subtotal: closing.total_net_sales,
        tax16: closing.total_tax_16,
        levy2: closing.total_levy_2,
        total: closing.total_gross_sales,
        tipAmount: closing.total_tips
      });

      res.json({ success: true, message: `Z-Report for ${closing.closing_date} printed.` });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}
