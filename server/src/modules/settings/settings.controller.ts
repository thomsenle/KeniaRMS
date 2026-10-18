import { Request, Response } from 'express';
import { SettingsService } from './settings.service.js';
import { RecipesAiService } from '../recipes/recipes-ai.service.js';

export class SettingsController {
  static get(req: Request, res: Response) {
    try {
      const settings = SettingsService.getAppSettings();
      res.json({ success: true, settings });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static update(req: Request, res: Response) {
    try {
      const updated = SettingsService.updateAppSettings(req.body);
      res.json({ success: true, settings: updated });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async testAiBenchmark(req: Request, res: Response) {
    try {
      const { query, location, radius_km, target_margin } = req.body;
      const testDish = await RecipesAiService.generateRecipe({
        prompt: query || 'Fresh Diani Seafood Curry',
        locationOverride: location,
        targetMargin: target_margin ? Number(target_margin) : undefined
      });

      res.json({ success: true, dish: testDish });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}
