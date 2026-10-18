import { Router } from 'express';
import { InventoryController } from './inventory.controller.js';

export const inventoryRouter = Router();

inventoryRouter.get('/', InventoryController.getAll);
inventoryRouter.get('/shopping-list', InventoryController.getShoppingList);
inventoryRouter.post('/', InventoryController.create);
inventoryRouter.put('/:id', InventoryController.update);
inventoryRouter.post('/:id/adjust', InventoryController.adjustStock);
inventoryRouter.delete('/:id', InventoryController.delete);
