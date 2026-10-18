import { Router } from 'express';
import { ClosingController } from './closing.controller.js';

export const closingRouter = Router();

closingRouter.get('/today-preview', ClosingController.getTodayPreview);
closingRouter.post('/execute-daily', ClosingController.executeDailyClosing);
closingRouter.get('/history', ClosingController.getHistory);
closingRouter.get('/monthly-report', ClosingController.getMonthlyReport);
closingRouter.post('/reprint-today', ClosingController.reprintToday);
closingRouter.post('/reprint/:closingId', ClosingController.reprintClosing);
