import { Router } from 'express';
import { DisplayController } from './display.controller.js';

export const displayRouter = Router();

// Menu board data (with optional ?screen=id)
displayRouter.get('/menu-board', DisplayController.getMenuBoard);

// Screen Management CRUD for WYSIWYG Editor
displayRouter.get('/screens', DisplayController.getScreens);
displayRouter.get('/screens/:id', DisplayController.getScreenById);
displayRouter.post('/screens', DisplayController.createScreen);
displayRouter.put('/screens/:id', DisplayController.updateScreen);
displayRouter.delete('/screens/:id', DisplayController.deleteScreen);
displayRouter.post('/screens/reset', DisplayController.resetScreens);
