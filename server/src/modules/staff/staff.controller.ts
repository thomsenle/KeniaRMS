import { Request, Response } from 'express';
import { db } from '../../db/index.js';
import { v4 as uuidv4 } from 'uuid';

export class StaffController {
  // 1. Staff Directory (Mitarbeiterverwaltung)
  static getAllStaff(_req: Request, res: Response) {
    try {
      const staff = db.prepare(`
        SELECT 
          id, name, pin, role, department, hourly_rate, target_weekly_hours, 
          phone, email, hire_date, notes, is_active, created_at
        FROM waiters
        ORDER BY is_active DESC, role ASC, name ASC
      `).all() as any[];

      // Check who is currently clocked in
      const activeClockIns = db.prepare(`
        SELECT id, staff_id, clock_in, notes
        FROM staff_time_entries
        WHERE clock_out IS NULL
      `).all() as any[];

      const activeMap = new Map<string, any>();
      for (const entry of activeClockIns) {
        activeMap.set(entry.staff_id, entry);
      }

      const enriched = staff.map(s => ({
        ...s,
        activeClockIn: activeMap.get(s.id) || null
      }));

      res.json({ success: true, staff: enriched });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static getStaffById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const member = db.prepare(`SELECT * FROM waiters WHERE id = ?`).get(id) as any;
      if (!member) {
        return res.status(404).json({ success: false, message: 'Staff member not found' });
      }

      const recentShifts = db.prepare(`
        SELECT * FROM staff_schedules 
        WHERE staff_id = ? 
        ORDER BY shift_date DESC LIMIT 10
      `).all(id);

      const recentHours = db.prepare(`
        SELECT * FROM staff_time_entries 
        WHERE staff_id = ? 
        ORDER BY clock_in DESC LIMIT 10
      `).all(id);

      res.json({ success: true, staff: member, recentShifts, recentHours });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static createStaff(req: Request, res: Response) {
    try {
      const { 
        name, pin, role, department, hourly_rate, target_weekly_hours, 
        phone, email, hire_date, notes 
      } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Staff name is required' });
      }

      const id = uuidv4();
      const validPin = (pin && pin.trim()) || Math.floor(1000 + Math.random() * 9000).toString();
      const validRole = role || 'waiter';
      const validDept = department || (validRole === 'kitchen' ? 'kitchen' : validRole === 'bar' ? 'bar' : 'service');
      const rate = Number(hourly_rate) || 0;
      const targetHours = Number(target_weekly_hours) || 40;
      const validHireDate = hire_date || new Date().toISOString().split('T')[0];

      db.prepare(`
        INSERT INTO waiters (
          id, name, pin, role, department, hourly_rate, target_weekly_hours, 
          phone, email, hire_date, notes, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).run(
        id, name.trim(), validPin, validRole, validDept, rate, targetHours,
        phone || null, email || null, validHireDate, notes || null
      );

      const created = db.prepare(`SELECT * FROM waiters WHERE id = ?`).get(id);
      res.status(201).json({ success: true, staff: created });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static updateStaff(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { 
        name, pin, role, department, hourly_rate, target_weekly_hours, 
        phone, email, hire_date, notes, is_active 
      } = req.body;

      const existing = db.prepare(`SELECT * FROM waiters WHERE id = ?`).get(id) as any;
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Staff member not found' });
      }

      db.prepare(`
        UPDATE waiters 
        SET 
          name = ?, pin = ?, role = ?, department = ?, hourly_rate = ?, 
          target_weekly_hours = ?, phone = ?, email = ?, hire_date = ?, 
          notes = ?, is_active = ?
        WHERE id = ?
      `).run(
        name !== undefined ? name.trim() : existing.name,
        pin !== undefined ? pin.trim() : existing.pin,
        role !== undefined ? role : existing.role,
        department !== undefined ? department : existing.department,
        hourly_rate !== undefined ? Number(hourly_rate) : existing.hourly_rate,
        target_weekly_hours !== undefined ? Number(target_weekly_hours) : existing.target_weekly_hours,
        phone !== undefined ? phone : existing.phone,
        email !== undefined ? email : existing.email,
        hire_date !== undefined ? hire_date : existing.hire_date,
        notes !== undefined ? notes : existing.notes,
        is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
        id
      );

      const updated = db.prepare(`SELECT * FROM waiters WHERE id = ?`).get(id);
      res.json({ success: true, staff: updated });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static toggleStaffActive(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const member = db.prepare(`SELECT is_active FROM waiters WHERE id = ?`).get(id) as any;
      if (!member) {
        return res.status(404).json({ success: false, message: 'Staff member not found' });
      }

      const nextState = member.is_active ? 0 : 1;
      db.prepare(`UPDATE waiters SET is_active = ? WHERE id = ?`).run(nextState, id);

      res.json({ success: true, is_active: nextState });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // 2. Shift Scheduling & Roster (Dienstplan)
  static getSchedules(req: Request, res: Response) {
    try {
      const { startDate, endDate, staffId } = req.query;

      let query = `
        SELECT 
          s.*, w.name as staff_name, w.role as staff_role, w.department as staff_department, w.hourly_rate
        FROM staff_schedules s
        JOIN waiters w ON s.staff_id = w.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (startDate) {
        query += ` AND s.shift_date >= ?`;
        params.push(startDate);
      }
      if (endDate) {
        query += ` AND s.shift_date <= ?`;
        params.push(endDate);
      }
      if (staffId) {
        query += ` AND s.staff_id = ?`;
        params.push(staffId);
      }

      query += ` ORDER BY s.shift_date ASC, s.start_time ASC`;

      const schedules = db.prepare(query).all(...params);
      res.json({ success: true, schedules });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static createSchedule(req: Request, res: Response) {
    try {
      const { staff_id, shift_date, start_time, end_time, station, notes, status } = req.body;

      if (!staff_id || !shift_date || !start_time || !end_time) {
        return res.status(400).json({ 
          success: false, 
          message: 'Staff member, date, start time, and end time are required' 
        });
      }

      // Calculate planned hours
      const [startH, startM] = start_time.split(':').map(Number);
      const [endH, endM] = end_time.split(':').map(Number);
      let diffMinutes = (endH * 60 + endM) - (startH * 60 + startM);
      if (diffMinutes < 0) diffMinutes += 24 * 60; // Overnight shift
      const planned_hours = Math.round((diffMinutes / 60) * 10) / 10;

      const id = uuidv4();
      db.prepare(`
        INSERT INTO staff_schedules (
          id, staff_id, shift_date, start_time, end_time, planned_hours, 
          station, notes, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, staff_id, shift_date, start_time, end_time, planned_hours,
        station || 'service', notes || null, status || 'scheduled'
      );

      const created = db.prepare(`
        SELECT s.*, w.name as staff_name, w.role as staff_role, w.department as staff_department
        FROM staff_schedules s
        JOIN waiters w ON s.staff_id = w.id
        WHERE s.id = ?
      `).get(id);

      res.status(201).json({ success: true, schedule: created });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static updateSchedule(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { shift_date, start_time, end_time, station, notes, status, staff_id } = req.body;

      const existing = db.prepare(`SELECT * FROM staff_schedules WHERE id = ?`).get(id) as any;
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Schedule entry not found' });
      }

      const newStart = start_time || existing.start_time;
      const newEnd = end_time || existing.end_time;
      const [startH, startM] = newStart.split(':').map(Number);
      const [endH, endM] = newEnd.split(':').map(Number);
      let diffMinutes = (endH * 60 + endM) - (startH * 60 + startM);
      if (diffMinutes < 0) diffMinutes += 24 * 60;
      const planned_hours = Math.round((diffMinutes / 60) * 10) / 10;

      db.prepare(`
        UPDATE staff_schedules 
        SET 
          staff_id = ?, shift_date = ?, start_time = ?, end_time = ?, 
          planned_hours = ?, station = ?, notes = ?, status = ?
        WHERE id = ?
      `).run(
        staff_id || existing.staff_id,
        shift_date || existing.shift_date,
        newStart,
        newEnd,
        planned_hours,
        station || existing.station,
        notes !== undefined ? notes : existing.notes,
        status || existing.status,
        id
      );

      const updated = db.prepare(`
        SELECT s.*, w.name as staff_name, w.role as staff_role, w.department as staff_department
        FROM staff_schedules s
        JOIN waiters w ON s.staff_id = w.id
        WHERE s.id = ?
      `).get(id);

      res.json({ success: true, schedule: updated });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static deleteSchedule(req: Request, res: Response) {
    try {
      const { id } = req.params;
      db.prepare(`DELETE FROM staff_schedules WHERE id = ?`).run(id);
      res.json({ success: true, message: 'Schedule deleted' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // 3. Time Tracking (Zeiterfassung & Stempeluhr)
  static getTimeEntries(req: Request, res: Response) {
    try {
      const { startDate, endDate, staffId } = req.query;

      let query = `
        SELECT 
          t.*, w.name as staff_name, w.role as staff_role, w.department as staff_department
        FROM staff_time_entries t
        JOIN waiters w ON t.staff_id = w.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (startDate) {
        query += ` AND date(t.clock_in) >= ?`;
        params.push(startDate);
      }
      if (endDate) {
        query += ` AND date(t.clock_in) <= ?`;
        params.push(endDate);
      }
      if (staffId) {
        query += ` AND t.staff_id = ?`;
        params.push(staffId);
      }

      query += ` ORDER BY t.clock_in DESC`;

      const entries = db.prepare(query).all(...params);
      res.json({ success: true, entries });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static clockIn(req: Request, res: Response) {
    try {
      const { staff_id, notes } = req.body;
      if (!staff_id) {
        return res.status(400).json({ success: false, message: 'Staff member is required' });
      }

      // Check if already clocked in
      const existingActive = db.prepare(`
        SELECT id, clock_in FROM staff_time_entries
        WHERE staff_id = ? AND clock_out IS NULL
      `).get(staff_id) as any;

      if (existingActive) {
        return res.status(400).json({ 
          success: false, 
          message: 'Staff member is already clocked in since ' + new Date(existingActive.clock_in).toLocaleTimeString() 
        });
      }

      const staff = db.prepare('SELECT hourly_rate FROM waiters WHERE id = ?').get(staff_id) as any;
      const hourlyRate = staff?.hourly_rate || 0;
      const id = uuidv4();
      const clockInTime = new Date().toISOString();

      db.prepare(`
        INSERT INTO staff_time_entries (
          id, staff_id, clock_in, hourly_rate, notes, status
        ) VALUES (?, ?, ?, ?, ?, 'open')
      `).run(id, staff_id, clockInTime, hourlyRate, notes || null);

      const entry = db.prepare(`
        SELECT t.*, w.name as staff_name FROM staff_time_entries t
        JOIN waiters w ON t.staff_id = w.id
        WHERE t.id = ?
      `).get(id);

      res.status(201).json({ success: true, entry });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static clockOut(req: Request, res: Response) {
    try {
      const { entry_id, staff_id, break_minutes, notes } = req.body;

      let entry: any = null;
      if (entry_id) {
        entry = db.prepare(`SELECT * FROM staff_time_entries WHERE id = ?`).get(entry_id);
      } else if (staff_id) {
        entry = db.prepare(`
          SELECT * FROM staff_time_entries 
          WHERE staff_id = ? AND clock_out IS NULL 
          ORDER BY clock_in DESC LIMIT 1
        `).get(staff_id);
      }

      if (!entry) {
        return res.status(404).json({ success: false, message: 'No active clock-in found' });
      }

      const clockOutTime = new Date().toISOString();
      const inDate = new Date(entry.clock_in);
      const outDate = new Date(clockOutTime);
      const breakMin = Number(break_minutes) || 0;

      const durationMinutes = Math.max(0, ((outDate.getTime() - inDate.getTime()) / (1000 * 60)) - breakMin);
      const totalHours = Math.round((durationMinutes / 60) * 100) / 100;
      const totalWage = Math.round(totalHours * (entry.hourly_rate || 0) * 100) / 100;

      db.prepare(`
        UPDATE staff_time_entries 
        SET 
          clock_out = ?, break_minutes = ?, total_hours = ?, 
          total_wage = ?, notes = coalesce(?, notes), status = 'approved'
        WHERE id = ?
      `).run(clockOutTime, breakMin, totalHours, totalWage, notes || null, entry.id);

      const updated = db.prepare(`
        SELECT t.*, w.name as staff_name FROM staff_time_entries t
        JOIN waiters w ON t.staff_id = w.id
        WHERE t.id = ?
      `).get(entry.id);

      res.json({ success: true, entry: updated });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static createTimeEntry(req: Request, res: Response) {
    try {
      const { staff_id, clock_in, clock_out, break_minutes, notes, shift_type } = req.body;

      if (!staff_id || !clock_in || !clock_out) {
        return res.status(400).json({ success: false, message: 'Staff member, clock-in and clock-out are required' });
      }

      const staff = db.prepare('SELECT hourly_rate FROM waiters WHERE id = ?').get(staff_id) as any;
      const hourlyRate = staff?.hourly_rate || 0;
      const breakMin = Number(break_minutes) || 0;

      const inDate = new Date(clock_in);
      const outDate = new Date(clock_out);
      const durationMinutes = Math.max(0, ((outDate.getTime() - inDate.getTime()) / (1000 * 60)) - breakMin);
      const totalHours = Math.round((durationMinutes / 60) * 100) / 100;
      const totalWage = Math.round(totalHours * hourlyRate * 100) / 100;

      const id = uuidv4();
      db.prepare(`
        INSERT INTO staff_time_entries (
          id, staff_id, clock_in, clock_out, break_minutes, total_hours, 
          hourly_rate, total_wage, shift_type, notes, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved')
      `).run(
        id, staff_id, clock_in, clock_out, breakMin, totalHours, 
        hourlyRate, totalWage, shift_type || 'regular', notes || null
      );

      const created = db.prepare(`
        SELECT t.*, w.name as staff_name FROM staff_time_entries t
        JOIN waiters w ON t.staff_id = w.id
        WHERE t.id = ?
      `).get(id);

      res.status(201).json({ success: true, entry: created });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static updateTimeEntry(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { clock_in, clock_out, break_minutes, notes, status, shift_type } = req.body;

      const existing = db.prepare(`SELECT * FROM staff_time_entries WHERE id = ?`).get(id) as any;
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Time entry not found' });
      }

      const newClockIn = clock_in || existing.clock_in;
      const newClockOut = clock_out !== undefined ? clock_out : existing.clock_out;
      const breakMin = break_minutes !== undefined ? Number(break_minutes) : existing.break_minutes;

      let totalHours = existing.total_hours;
      let totalWage = existing.total_wage;

      if (newClockIn && newClockOut) {
        const inDate = new Date(newClockIn);
        const outDate = new Date(newClockOut);
        const durationMinutes = Math.max(0, ((outDate.getTime() - inDate.getTime()) / (1000 * 60)) - breakMin);
        totalHours = Math.round((durationMinutes / 60) * 100) / 100;
        totalWage = Math.round(totalHours * (existing.hourly_rate || 0) * 100) / 100;
      }

      db.prepare(`
        UPDATE staff_time_entries 
        SET 
          clock_in = ?, clock_out = ?, break_minutes = ?, total_hours = ?, 
          total_wage = ?, notes = ?, status = ?, shift_type = ?
        WHERE id = ?
      `).run(
        newClockIn, newClockOut, breakMin, totalHours, totalWage,
        notes !== undefined ? notes : existing.notes,
        status || existing.status,
        shift_type || existing.shift_type,
        id
      );

      const updated = db.prepare(`
        SELECT t.*, w.name as staff_name FROM staff_time_entries t
        JOIN waiters w ON t.staff_id = w.id
        WHERE t.id = ?
      `).get(id);

      res.json({ success: true, entry: updated });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static deleteTimeEntry(req: Request, res: Response) {
    try {
      const { id } = req.params;
      db.prepare(`DELETE FROM staff_time_entries WHERE id = ?`).run(id);
      res.json({ success: true, message: 'Time entry deleted' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // 4. Hours Summary & Payroll Analytics (Stundenübersicht)
  static getHoursSummary(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;

      const allStaff = db.prepare(`
        SELECT id, name, role, department, hourly_rate, target_weekly_hours, phone, is_active
        FROM waiters
        ORDER BY role ASC, name ASC
      `).all() as any[];

      let dateFilterTime = '';
      let dateFilterSchedule = '';
      const paramsTime: any[] = [];
      const paramsSched: any[] = [];

      if (startDate && endDate) {
        dateFilterTime = ` AND date(clock_in) >= ? AND date(clock_in) <= ?`;
        paramsTime.push(startDate, endDate);
        dateFilterSchedule = ` AND shift_date >= ? AND shift_date <= ?`;
        paramsSched.push(startDate, endDate);
      }

      // Actual worked hours per staff
      const actualHoursRows = db.prepare(`
        SELECT 
          staff_id, 
          COUNT(id) as shift_count,
          SUM(total_hours) as actual_hours,
          SUM(total_wage) as total_wage
        FROM staff_time_entries
        WHERE clock_out IS NOT NULL ${dateFilterTime}
        GROUP BY staff_id
      `).all(...paramsTime) as any[];

      const actualMap = new Map<string, any>();
      for (const row of actualHoursRows) {
        actualMap.set(row.staff_id, row);
      }

      // Planned hours per staff
      const plannedHoursRows = db.prepare(`
        SELECT 
          staff_id, 
          COUNT(id) as scheduled_shift_count,
          SUM(planned_hours) as planned_hours
        FROM staff_schedules
        WHERE status != 'absent' ${dateFilterSchedule}
        GROUP BY staff_id
      `).all(...paramsSched) as any[];

      const plannedMap = new Map<string, any>();
      for (const row of plannedHoursRows) {
        plannedMap.set(row.staff_id, row);
      }

      // Compile comprehensive employee report
      let grandTotalActualHours = 0;
      let grandTotalPlannedHours = 0;
      let grandTotalWages = 0;
      let grandTotalShifts = 0;

      const staffSummaries = allStaff.map(s => {
        const actual = actualMap.get(s.id) || { actual_hours: 0, total_wage: 0, shift_count: 0 };
        const planned = plannedMap.get(s.id) || { planned_hours: 0, scheduled_shift_count: 0 };

        const actualHours = Math.round((Number(actual.actual_hours) || 0) * 10) / 10;
        const plannedHours = Math.round((Number(planned.planned_hours) || 0) * 10) / 10;
        const totalWage = Math.round((Number(actual.total_wage) || (actualHours * (s.hourly_rate || 0))) * 100) / 100;
        const diffHours = Math.round((actualHours - plannedHours) * 10) / 10;

        grandTotalActualHours += actualHours;
        grandTotalPlannedHours += plannedHours;
        grandTotalWages += totalWage;
        grandTotalShifts += actual.shift_count;

        return {
          id: s.id,
          name: s.name,
          role: s.role,
          department: s.department,
          hourly_rate: s.hourly_rate || 0,
          target_weekly_hours: s.target_weekly_hours || 40,
          phone: s.phone,
          is_active: s.is_active,
          actual_hours: actualHours,
          planned_hours: plannedHours,
          diff_hours: diffHours,
          total_wage: totalWage,
          shift_count: actual.shift_count,
          scheduled_shift_count: planned.scheduled_shift_count
        };
      });

      res.json({
        success: true,
        summary: {
          totalActualHours: Math.round(grandTotalActualHours * 10) / 10,
          totalPlannedHours: Math.round(grandTotalPlannedHours * 10) / 10,
          totalWagesKES: Math.round(grandTotalWages * 100) / 100,
          totalShifts: grandTotalShifts,
          staffCount: allStaff.length
        },
        staff: staffSummaries
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // 5. Automatic synchronization of POS Waiter Shifts into Hours log
  static syncWaiterShifts(_req: Request, res: Response) {
    try {
      const closedShifts = db.prepare(`
        SELECT ws.*, w.hourly_rate FROM waiter_shifts ws
        JOIN waiters w ON ws.waiter_id = w.id
        WHERE ws.status = 'closed' AND ws.end_time IS NOT NULL
      `).all() as any[];

      let syncedCount = 0;
      const insertTime = db.prepare(`
        INSERT INTO staff_time_entries (
          id, staff_id, clock_in, clock_out, break_minutes, total_hours, 
          hourly_rate, total_wage, shift_type, notes, status, shift_id
        ) VALUES (?, ?, ?, ?, 0, ?, ?, ?, 'regular', 'POS Waiter Shift', 'approved', ?)
      `);

      for (const s of closedShifts) {
        const alreadySynced = db.prepare(`
          SELECT id FROM staff_time_entries WHERE shift_id = ?
        `).get(s.id);

        if (!alreadySynced) {
          const inDate = new Date(s.start_time);
          const outDate = new Date(s.end_time);
          const durationMinutes = Math.max(0, (outDate.getTime() - inDate.getTime()) / (1000 * 60));
          const totalHours = Math.round((durationMinutes / 60) * 100) / 100;
          const rate = s.hourly_rate || 300;
          const totalWage = Math.round(totalHours * rate * 100) / 100;

          insertTime.run(
            uuidv4(), s.waiter_id, s.start_time, s.end_time, 
            totalHours, rate, totalWage, s.id
          );
          syncedCount++;
        }
      }

      res.json({ success: true, syncedCount, message: `Synced ${syncedCount} shifts.` });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}
