import { Request, Response } from 'express';
import { MpesaService } from './mpesa.service.js';
import { db } from '../../db/index.js';

export class MpesaController {
  static async initiateStkPush(req: Request, res: Response) {
    try {
      const { order_id, phone_number, amount, waiter_id, shift_id } = req.body;
      if (!order_id || !phone_number || !amount) {
        return res.status(400).json({ success: false, message: 'order_id, phone_number, and amount are required' });
      }

      const result = await MpesaService.initiateStkPush({
        orderId: order_id,
        phoneNumber: phone_number,
        amount: Number(amount),
        waiterId: waiter_id,
        shiftId: shift_id
      });

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // Safaricom Webhook Callback Endpoint
  static async handleCallback(req: Request, res: Response) {
    try {
      console.log('[M-Pesa Webhook Callback received]:', JSON.stringify(req.body));
      const stkCallback = req.body?.Body?.stkCallback;

      if (!stkCallback) {
        return res.json({ ResultCode: 1, ResultDesc: 'Invalid payload' });
      }

      const checkoutRequestId = stkCallback.CheckoutRequestID;
      const resultCode = stkCallback.ResultCode;
      const resultDesc = stkCallback.ResultDesc;

      let mpesaReceiptNumber = `MPESA_${Date.now()}`;
      if (resultCode === 0 && Array.isArray(stkCallback.CallbackMetadata?.Item)) {
        const item = stkCallback.CallbackMetadata.Item.find((i: any) => i.Name === 'MpesaReceiptNumber');
        if (item?.Value) {
          mpesaReceiptNumber = item.Value;
        }
      }

      await MpesaService.confirmPayment(checkoutRequestId, mpesaReceiptNumber, resultCode, resultDesc);

      res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    } catch (err: any) {
      console.error('[M-Pesa Callback Error]:', err);
      res.status(500).json({ ResultCode: 1, ResultDesc: err.message });
    }
  }

  // Simulate PIN approval for development / testing without live Safaricom credentials
  static async simulateApproval(req: Request, res: Response) {
    try {
      const { checkout_request_id } = req.body;
      const dummyReceipt = `QJD${Math.round(Math.random() * 1e7)}X`;
      const success = await MpesaService.confirmPayment(checkout_request_id, dummyReceipt, 0, 'Customer entered M-Pesa PIN successfully');

      res.json({ success, receipt: dummyReceipt, message: `M-Pesa payment simulated successfully (${dummyReceipt})` });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // Manual code entry (Buy Goods Till SMS)
  static async verifyManual(req: Request, res: Response) {
    try {
      const { order_id, receipt_code, amount } = req.body;
      const result = await MpesaService.verifyManualReceipt(order_id, receipt_code, Number(amount));
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // Settings
  static getSettings(_req: Request, res: Response) {
    try {
      const settings = db.prepare('SELECT * FROM mpesa_settings LIMIT 1').get();
      res.json({ success: true, settings });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static updateSettings(req: Request, res: Response) {
    try {
      const { business_type, shortcode, till_number, passkey, consumer_key, consumer_secret, environment } = req.body;
      db.prepare(`
        UPDATE mpesa_settings 
        SET business_type = ?, shortcode = ?, till_number = ?, passkey = ?, consumer_key = ?, consumer_secret = ?, environment = ?
      `).run(business_type, shortcode, till_number, passkey, consumer_key, consumer_secret, environment);

      const updated = db.prepare('SELECT * FROM mpesa_settings LIMIT 1').get();
      res.json({ success: true, settings: updated });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static async testStkPush(req: Request, res: Response) {
    try {
      const { phone_number } = req.body;
      if (!phone_number) {
        return res.status(400).json({ success: false, message: 'phone_number is required' });
      }
      const result = await MpesaService.testStkPush(phone_number);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}
