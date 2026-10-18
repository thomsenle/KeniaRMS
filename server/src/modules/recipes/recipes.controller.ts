import { Request, Response } from 'express';
import { db } from '../../db/index.js';
import { v4 as uuidv4 } from 'uuid';
import { io } from '../../index.js';

export class RecipesController {
  static getAll(req: Request, res: Response) {
    try {
      const recipes = db.prepare(`
        SELECT * FROM recipes ORDER BY category, name ASC
      `).all() as any[];

      const ingredients = db.prepare(`
        SELECT ri.*, ii.name as inventory_name, ii.unit as inventory_unit, ii.current_stock, ii.cost_per_unit
        FROM recipe_ingredients ri
        JOIN inventory_items ii ON ri.inventory_item_id = ii.id
      `).all() as any[];

      // Group ingredients by recipe_id
      const ingMap: Record<string, any[]> = {};
      for (const ing of ingredients) {
        if (!ingMap[ing.recipe_id]) ingMap[ing.recipe_id] = [];
        ingMap[ing.recipe_id].push(ing);
      }

      // Attach ingredients, cost calculation and out-of-stock check
      const fullRecipes = recipes.map(r => {
        const itemIngs = ingMap[r.id] || [];
        let calculatedCost = 0;
        let isAvailable = true;

        for (const ing of itemIngs) {
          calculatedCost += (ing.quantity || 0) * (ing.cost_per_unit || 0);
          if ((ing.current_stock || 0) < (ing.quantity || 0)) {
            isAvailable = false;
          }
        }

        const margin = r.price > 0 ? ((r.price - calculatedCost) / r.price) * 100 : 0;

        return {
          ...r,
          calculated_cost_kes: Math.round(calculatedCost * 100) / 100,
          gross_margin_percent: Math.round(margin * 10) / 10,
          is_available: isAvailable,
          ingredients: itemIngs
        };
      });

      res.json({ success: true, recipes: fullRecipes });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const recipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(id) as any;
      if (!recipe) {
        return res.status(404).json({ success: false, message: 'Recipe not found' });
      }

      const ingredients = db.prepare(`
        SELECT ri.*, ii.name as inventory_name, ii.unit as inventory_unit, ii.current_stock, ii.cost_per_unit
        FROM recipe_ingredients ri
        JOIN inventory_items ii ON ri.inventory_item_id = ii.id
        WHERE ri.recipe_id = ?
      `).all(id);

      res.json({ success: true, recipe: { ...recipe, ingredients } });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static create(req: Request, res: Response) {
    try {
      const { name, category, price, tax_rate, catering_levy, description, image_url, station, display_on_board, display_highlight, ingredients } = req.body;
      const recipeId = uuidv4();

      const createTx = db.transaction(() => {
        db.prepare(`
          INSERT INTO recipes (id, name, category, price, tax_rate, catering_levy, description, image_url, station, display_on_board, display_highlight)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          recipeId,
          name,
          category || 'food',
          Number(price) || 0,
          Number(tax_rate) ?? 16.0,
          Number(catering_levy) ?? 2.0,
          description || '',
          image_url || '',
          station || 'kitchen',
          display_on_board ? 1 : 0,
          display_highlight ? 1 : 0
        );

        if (Array.isArray(ingredients)) {
          const insertIng = db.prepare(`
            INSERT INTO recipe_ingredients (id, recipe_id, inventory_item_id, quantity, unit)
            VALUES (?, ?, ?, ?, ?)
          `);
          for (const ing of ingredients) {
            insertIng.run(uuidv4(), recipeId, ing.inventory_item_id, Number(ing.quantity), ing.unit);
          }
        }
      });

      createTx();

      io.emit('recipes:updated', { id: recipeId });
      res.status(201).json({ success: true, id: recipeId });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, category, price, tax_rate, catering_levy, description, image_url, station, display_on_board, display_highlight, ingredients } = req.body;

      const updateTx = db.transaction(() => {
        db.prepare(`
          UPDATE recipes 
          SET name = ?, category = ?, price = ?, tax_rate = ?, catering_levy = ?, description = ?, image_url = ?, 
              station = ?, display_on_board = ?, display_highlight = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(
          name,
          category,
          Number(price),
          Number(tax_rate),
          Number(catering_levy),
          description,
          image_url,
          station,
          display_on_board ? 1 : 0,
          display_highlight ? 1 : 0,
          id
        );

        if (Array.isArray(ingredients)) {
          db.prepare('DELETE FROM recipe_ingredients WHERE recipe_id = ?').run(id);
          const insertIng = db.prepare(`
            INSERT INTO recipe_ingredients (id, recipe_id, inventory_item_id, quantity, unit)
            VALUES (?, ?, ?, ?, ?)
          `);
          for (const ing of ingredients) {
            insertIng.run(uuidv4(), id, ing.inventory_item_id, Number(ing.quantity), ing.unit);
          }
        }
      });

      updateTx();

      io.emit('recipes:updated', { id });
      res.json({ success: true, id });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      db.prepare('DELETE FROM recipe_ingredients WHERE recipe_id = ?').run(id);
      db.prepare('DELETE FROM recipes WHERE id = ?').run(id);

      io.emit('recipes:deleted', { id });
      res.json({ success: true, id });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}
