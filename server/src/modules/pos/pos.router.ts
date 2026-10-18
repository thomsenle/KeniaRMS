import { Router } from 'express';
import { POSController } from './pos.controller.js';

export const posRouter = Router();

posRouter.get('/tables', POSController.getTables);
posRouter.post('/tables/:tableId/open', POSController.openTable);
posRouter.get('/orders/table/:tableId', POSController.getOrder);

posRouter.post('/orders/:orderId/items', POSController.addItemToCart);
posRouter.put('/orders/items/:itemId', POSController.updateCartItem);
posRouter.delete('/orders/items/:itemId', POSController.removeCartItem);

// Critical trigger: Dispatch order to kitchen & bar and deduct stock
posRouter.post('/orders/:orderId/send-to-stations', POSController.sendToKitchenAndBar);

// Settle / Split bill
posRouter.post('/orders/:orderId/split-bill', POSController.splitAndPayBill);

// Transfer table
posRouter.post('/orders/:orderId/transfer-table', POSController.transferTable);
