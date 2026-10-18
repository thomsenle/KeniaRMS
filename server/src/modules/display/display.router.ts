import { Router } from 'express';
import { DisplayController } from './display.controller.js';

export const displayRouter = Router();

displayRouter.get('/menu-board', DisplayController.getMenuBoard);
