import { Request, Response } from 'express';
import { db } from '../../db/index.js';

export class DisplayController {
  static getMenuBoard(_req: Request, res: Response) {
    try {
      // Fetch recipes marked for display
      const recipes = db.prepare(`
        SELECT * FROM recipes 
        WHERE is_active = 1 AND display_on_board = 1
        ORDER BY display_highlight DESC, category ASC, name ASC
      `).all() as any[];

      // Check ingredient availability so we don't display items that can't be served
      const ingredients = db.prepare(`
        SELECT ri.recipe_id, ii.current_stock, ri.quantity
        FROM recipe_ingredients ri
        JOIN inventory_items ii ON ri.inventory_item_id = ii.id
      `).all() as any[];

      const outOfStockRecipeIds = new Set<string>();
      for (const ing of ingredients) {
        if (ing.current_stock < ing.quantity) {
          outOfStockRecipeIds.add(ing.recipe_id);
        }
      }

      // Add availability flag
      const availableItems = recipes.map(r => ({
        ...r,
        is_in_stock: !outOfStockRecipeIds.has(r.id)
      }));

      // Highlighted specials for top carousel
      const specials = availableItems.filter(r => r.display_highlight === 1 && r.is_in_stock);

      // Grouped by category
      const categories: Record<string, any[]> = {};
      for (const item of availableItems) {
        if (!categories[item.category]) categories[item.category] = [];
        categories[item.category].push(item);
      }

      res.json({
        success: true,
        restaurantName: 'The Savannah Bistro & Lounge',
        location: 'Nairobi, Kenya',
        currency: 'KES',
        vatRate: '16% Included',
        specials,
        categories,
        allItems: availableItems
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}
