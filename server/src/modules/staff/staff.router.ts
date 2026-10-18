import { Router } from 'express';
import { StaffController } from './staff.controller.js';

export const staffRouter = Router();

// Staff Directory (Mitarbeiterverwaltung)
staffRouter.get('/', StaffController.getAllStaff);
staffRouter.get('/:id', StaffController.getStaffById);
staffRouter.post('/', StaffController.createStaff);
staffRouter.put('/:id', StaffController.updateStaff);
staffRouter.post('/:id/toggle-active', StaffController.toggleStaffActive);

// Shift Scheduling & Roster (Dienstplan)
staffRouter.get('/schedules/all', StaffController.getSchedules);
staffRouter.post('/schedules', StaffController.createSchedule);
staffRouter.put('/schedules/:id', StaffController.updateSchedule);
staffRouter.delete('/schedules/:id', StaffController.deleteSchedule);

// Time Tracking (Zeiterfassung & Stempeluhr)
staffRouter.get('/time-entries/all', StaffController.getTimeEntries);
staffRouter.post('/time-entries', StaffController.createTimeEntry);
staffRouter.put('/time-entries/:id', StaffController.updateTimeEntry);
staffRouter.delete('/time-entries/:id', StaffController.deleteTimeEntry);
staffRouter.post('/clock-in', StaffController.clockIn);
staffRouter.post('/clock-out', StaffController.clockOut);

// Hours Summary & Payroll Overview (Stundenübersicht)
staffRouter.get('/analytics/hours-summary', StaffController.getHoursSummary);
staffRouter.post('/sync-waiter-shifts', StaffController.syncWaiterShifts);
