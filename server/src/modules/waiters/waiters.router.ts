import { Router } from 'express';
import { WaitersController } from './waiters.controller.js';

export const waitersRouter = Router();

waitersRouter.get('/', WaitersController.getAll);
waitersRouter.post('/login', WaitersController.login);
waitersRouter.post('/shift/start', WaitersController.startShift);
waitersRouter.get('/shift/current/:waiterId', WaitersController.getShiftSummary);
waitersRouter.post('/shift/end', WaitersController.endShift);

// Admin PIN verification & RBAC Staff Management
waitersRouter.post('/verify-admin', WaitersController.verifyAdminPin);
waitersRouter.get('/all-staff', WaitersController.getAllStaff);
waitersRouter.post('/staff', WaitersController.createStaff);
waitersRouter.put('/staff/:id', WaitersController.updateStaff);
waitersRouter.delete('/staff/:id', WaitersController.deleteStaff);
