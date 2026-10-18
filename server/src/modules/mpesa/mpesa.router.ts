import { Router } from 'express';
import { MpesaController } from './mpesa.controller.js';

export const mpesaRouter = Router();

mpesaRouter.post('/stk-push', MpesaController.initiateStkPush);
mpesaRouter.post('/callback', MpesaController.handleCallback);
mpesaRouter.post('/simulate-approval', MpesaController.simulateApproval);
mpesaRouter.post('/verify-manual', MpesaController.verifyManual);
mpesaRouter.get('/settings', MpesaController.getSettings);
mpesaRouter.put('/settings', MpesaController.updateSettings);
mpesaRouter.post('/test-stk', MpesaController.testStkPush);
