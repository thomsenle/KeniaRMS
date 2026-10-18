import { Router } from 'express';
import { SettingsController } from './settings.controller.js';

export const settingsRouter = Router();

settingsRouter.get('/', SettingsController.get);
settingsRouter.put('/', SettingsController.update);
settingsRouter.post('/test-ai', SettingsController.testAiBenchmark);
