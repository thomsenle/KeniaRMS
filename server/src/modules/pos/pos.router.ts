import { Router } from 'express';
import { POSController } from './pos.controller.js';

export const posRouter = Router();

// Table Management
posRouter.get('/tables', POSController.getTables);
posRouter.post('/tables', POSController.createTable);
posRouter.put('/tables/:tableId', POSController.updateTable);
posRouter.delete('/tables/:tableId', POSController.deleteTable);
posRouter.post('/tables/:tableId/open', POSController.openTable);
posRouter.get('/orders/table/:tableId', POSController.getOrder);

// Dining Areas Management
posRouter.get('/areas', POSController.getAreas);
posRouter.post('/areas', POSController.createArea);
posRouter.put('/areas/:areaId', POSController.updateArea);
posRouter.delete('/areas/:areaId', POSController.deleteArea);

posRouter.post('/orders/:orderId/items', POSController.addItemToCart);
posRouter.put('/orders/items/:itemId', POSController.updateCartItem);
posRouter.delete('/orders/items/:itemId', POSController.removeCartItem);

// Critical trigger: Dispatch order to kitchen & bar and deduct stock
posRouter.post('/orders/:orderId/send-to-stations', POSController.sendToKitchenAndBar);

// Settle / Split bill
posRouter.post('/orders/:orderId/split-bill', POSController.splitAndPayBill);

// Transfer table
posRouter.post('/orders/:orderId/transfer-table', POSController.transferTable);
