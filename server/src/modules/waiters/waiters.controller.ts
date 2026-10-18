import { Request, Response } from 'express';
import { db } from '../../db/index.js';
import { v4 as uuidv4 } from 'uuid';
import { io } from '../../index.js';

export class WaitersController {
  static getAll(_req: Request, res: Response) {
    try {
      const waiters = db.prepare('SELECT id, name, role, is_active FROM waiters WHERE is_active = 1').all();
      res.json({ success: true, waiters });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static login(req: Request, res: Response) {
    try {
      const { pin } = req.body;
      if (!pin) {
        return res.status(400).json({ success: false, message: 'PIN is required' });
      }

      const waiter = db.prepare('SELECT id, name, role, is_active FROM waiters WHERE pin = ? AND is_active = 1').get(pin) as any;
      if (!waiter) {
        return res.status(401).json({ success: false, message: 'Invalid PIN' });
      }

      // Check if waiter has an open shift
      const activeShift = db.prepare(`
        SELECT * FROM waiter_shifts 
        WHERE waiter_id = ? AND status = 'open' 
        ORDER BY start_time DESC LIMIT 1
      `).get(waiter.id);

      res.json({
        success: true,
        waiter,
        activeShift: activeShift || null
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static startShift(req: Request, res: Response) {
    try {
      const { waiter_id, starting_float } = req.body;
      const floatAmount = Number(starting_float) || 0;

      // Check if already has an open shift
      const existing = db.prepare(`
        SELECT * FROM waiter_shifts WHERE waiter_id = ? AND status = 'open'
      `).get(waiter_id) as any;

      if (existing) {
        return res.status(400).json({ 
          success: false, 
          message: 'An active shift is already open for this waiter', 
          shift: existing 
        });
      }

      const shiftId = uuidv4();
      db.prepare(`
        INSERT INTO waiter_shifts (id, waiter_id, starting_float, status)
        VALUES (?, ?, ?, 'open')
      `).run(shiftId, waiter_id, floatAmount);

      const shift = db.prepare('SELECT * FROM waiter_shifts WHERE id = ?').get(shiftId);
      io.emit('waiter:shift_started', { waiter_id, shift });

      res.status(201).json({ success: true, shift });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static getShiftSummary(req: Request, res: Response) {
    try {
      const { waiterId } = req.params;
      const shift = db.prepare(`
        SELECT * FROM waiter_shifts 
        WHERE waiter_id = ? AND status = 'open' 
        ORDER BY start_time DESC LIMIT 1
      `).get(waiterId) as any;

      if (!shift) {
        return res.json({ success: true, hasActiveShift: false, shift: null });
      }

      // Calculate current sales from bills linked to this shift
      const sales = db.prepare(`
        SELECT 
          COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total_amount ELSE 0 END), 0) as cash_sales,
          COALESCE(SUM(CASE WHEN payment_method = 'card' THEN total_amount ELSE 0 END), 0) as card_sales,
          COALESCE(SUM(CASE WHEN payment_method = 'mpesa' THEN total_amount ELSE 0 END), 0) as mpesa_sales,
          COALESCE(SUM(tip_amount), 0) as direct_tips,
          COUNT(*) as bills_count
        FROM bills
        WHERE shift_id = ?
      `).get(shift.id) as any;

      const expectedCash = shift.starting_float + sales.cash_sales;

      res.json({
        success: true,
        hasActiveShift: true,
        shift: {
          ...shift,
          current_cash_sales: sales.cash_sales,
          current_card_sales: sales.card_sales,
          current_mpesa_sales: sales.mpesa_sales,
          current_direct_tips: sales.direct_tips,
          expected_cash: expectedCash,
          bills_count: sales.bills_count
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static endShift(req: Request, res: Response) {
    try {
      const { shift_id, counted_cash, notes } = req.body;
      const counted = Number(counted_cash);

      if (isNaN(counted)) {
        return res.status(400).json({ success: false, message: 'Valid counted cash amount is required' });
      }

      const shift = db.prepare('SELECT * FROM waiter_shifts WHERE id = ?').get(shift_id) as any;
      if (!shift) {
        return res.status(404).json({ success: false, message: 'Shift not found' });
      }

      // Aggregate all bills paid during this shift
      const totals = db.prepare(`
        SELECT 
          COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total_amount ELSE 0 END), 0) as cash_sales,
          COALESCE(SUM(CASE WHEN payment_method = 'card' THEN total_amount ELSE 0 END), 0) as card_sales,
          COALESCE(SUM(CASE WHEN payment_method = 'mpesa' THEN total_amount ELSE 0 END), 0) as mpesa_sales,
          COALESCE(SUM(tip_amount), 0) as recorded_tips
        FROM bills
        WHERE shift_id = ?
      `).get(shift_id) as any;

      const startingFloat = shift.starting_float;
      const expectedCash = startingFloat + totals.cash_sales;
      const cashDifference = counted - expectedCash; // Positive = extra/tip, Negative = shortage

      // Total tips = recorded tips on bills + positive cash overage
      const calculatedTips = Math.max(0, cashDifference) + totals.recorded_tips;

      db.prepare(`
        UPDATE waiter_shifts 
        SET end_time = datetime('now'),
            counted_cash = ?,
            calculated_sales_cash = ?,
            calculated_sales_card = ?,
            calculated_sales_mpesa = ?,
            calculated_tips = ?,
            notes = ?,
            status = 'closed'
        WHERE id = ?
      `).run(
        counted,
        totals.cash_sales,
        totals.card_sales,
        totals.mpesa_sales,
        calculatedTips,
        notes || '',
        shift_id
      );

      const closedShift = db.prepare('SELECT * FROM waiter_shifts WHERE id = ?').get(shift_id) as any;
      io.emit('waiter:shift_ended', closedShift);

      res.json({
        success: true,
        summary: {
          shift_id,
          waiter_id: shift.waiter_id,
          starting_float: startingFloat,
          cash_sales: totals.cash_sales,
          card_sales: totals.card_sales,
          mpesa_sales: totals.mpesa_sales,
          total_revenue: totals.cash_sales + totals.card_sales + totals.mpesa_sales,
          expected_cash: expectedCash,
          counted_cash: counted,
          difference: cashDifference,
          calculated_tips: calculatedTips,
          status: 'closed'
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // Admin Verification
  static verifyAdminPin(req: Request, res: Response) {
    try {
      const { pin } = req.body;
      if (!pin) {
        return res.status(400).json({ success: false, message: 'PIN is required' });
      }

      const admin = db.prepare(`
        SELECT id, name, role, is_active FROM waiters 
        WHERE pin = ? AND (role = 'admin' OR role = 'manager') AND is_active = 1
      `).get(pin) as any;

      if (!admin) {
        return res.status(403).json({ success: false, message: 'Invalid Admin PIN or insufficient permissions' });
      }

      res.json({ success: true, admin });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // RBAC Staff Management (Admin Only)
  static getAllStaff(_req: Request, res: Response) {
    try {
      const staff = db.prepare('SELECT id, name, pin, role, is_active, created_at FROM waiters ORDER BY name ASC').all();
      res.json({ success: true, staff });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static createStaff(req: Request, res: Response) {
    try {
      const { name, pin, role } = req.body;
      if (!name || !pin) {
        return res.status(400).json({ success: false, message: 'Name and 4-digit PIN are required' });
      }

      // Check PIN uniqueness
      const existing = db.prepare('SELECT id FROM waiters WHERE pin = ?').get(pin);
      if (existing) {
        return res.status(400).json({ success: false, message: 'This PIN is already assigned to another staff member' });
      }

      const id = uuidv4();
      const staffRole = role || 'waiter';
      db.prepare(`
        INSERT INTO waiters (id, name, pin, role, is_active)
        VALUES (?, ?, ?, ?, 1)
      `).run(id, name.trim(), pin.trim(), staffRole);

      const created = db.prepare('SELECT id, name, pin, role, is_active, created_at FROM waiters WHERE id = ?').get(id);
      res.json({ success: true, staff: created, message: 'Staff member added successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static updateStaff(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, pin, role, is_active } = req.body;

      if (pin) {
        const conflict = db.prepare('SELECT id FROM waiters WHERE pin = ? AND id != ?').get(pin, id);
        if (conflict) {
          return res.status(400).json({ success: false, message: 'This PIN is already in use by another staff member' });
        }
      }

      db.prepare(`
        UPDATE waiters 
        SET name = COALESCE(?, name),
            pin = COALESCE(?, pin),
            role = COALESCE(?, role),
            is_active = COALESCE(?, is_active)
        WHERE id = ?
      `).run(name ? name.trim() : null, pin ? pin.trim() : null, role || null, is_active !== undefined ? is_active : null, id);

      const updated = db.prepare('SELECT id, name, pin, role, is_active, created_at FROM waiters WHERE id = ?').get(id);
      res.json({ success: true, staff: updated, message: 'Staff member updated' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static deleteStaff(req: Request, res: Response) {
    try {
      const { id } = req.params;
      // Soft-deactivate to preserve historical bill links
      db.prepare('UPDATE waiters SET is_active = 0 WHERE id = ?').run(id);
      res.json({ success: true, message: 'Staff member deactivated' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}
