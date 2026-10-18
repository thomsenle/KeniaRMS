import { Request, Response } from 'express';
import { db } from '../../db/index.js';
import { v4 as uuidv4 } from 'uuid';
import { io } from '../../index.js';
import { RecipesAiService } from './recipes-ai.service.js';

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

  static async generateAi(req: Request, res: Response) {
    try {
      const { prompt, category, station, location, target_margin } = req.body;
      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ success: false, message: 'Dish prompt is required' });
      }

      const dish = await RecipesAiService.generateRecipe({
        prompt: prompt.trim(),
        category,
        station,
        locationOverride: location,
        targetMargin: target_margin ? Number(target_margin) : undefined
      });

      res.json({ success: true, dish });
    } catch (error: any) {
      console.error('[RecipesController.generateAi] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async importAiRecipe(req: Request, res: Response) {
    try {
      const {
        name,
        category,
        price,
        tax_rate,
        catering_levy,
        description,
        image_url,
        station,
        display_on_board,
        display_highlight,
        ingredients
      } = req.body;

      if (!name || !price) {
        return res.status(400).json({ success: false, message: 'Name and price are required' });
      }

      const recipeId = uuidv4();
      const newlyCreatedIngredients: string[] = [];
      const linkedIngredients: any[] = [];

      const tx = db.transaction(() => {
        // 1. Insert recipe
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

        // 2. Process ingredients & auto-create in inventory
        if (Array.isArray(ingredients)) {
          const insertRecipeIng = db.prepare(`
            INSERT INTO recipe_ingredients (id, recipe_id, inventory_item_id, quantity, unit)
            VALUES (?, ?, ?, ?, ?)
          `);

          const findExistingItem = db.prepare(`
            SELECT id, name, unit, cost_per_unit, current_stock 
            FROM inventory_items 
            WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))
          `);

          const insertInventoryItem = db.prepare(`
            INSERT INTO inventory_items (id, name, category, unit, current_stock, min_stock, optimal_stock, cost_per_unit, supplier)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          const logInventory = db.prepare(`
            INSERT INTO inventory_logs (id, inventory_item_id, change_amount, new_stock, reason)
            VALUES (?, ?, ?, ?, ?)
          `);

          for (const ing of ingredients) {
            const ingName = String(ing.name || '').trim();
            if (!ingName) continue;

            let inventoryItemId = ing.inventory_item_id;

            // Check if already in inventory
            if (!inventoryItemId) {
              const existing = findExistingItem.get(ingName) as any;
              if (existing) {
                inventoryItemId = existing.id;
                // If existing item cost was 0 and we have a valid cost, update it
                if ((!existing.cost_per_unit || existing.cost_per_unit === 0) && Number(ing.cost_per_unit) > 0) {
                  db.prepare('UPDATE inventory_items SET cost_per_unit = ? WHERE id = ?').run(Number(ing.cost_per_unit), existing.id);
                }
              } else {
                // Auto-create new inventory item!
                inventoryItemId = uuidv4();
                const initialStock = Number(ing.initial_stock) >= 0 ? Number(ing.initial_stock) : 5.0;
                const minStock = Number(ing.min_stock) || 2.0;
                const optimalStock = Number(ing.optimal_stock) || 10.0;
                const costPerUnit = Number(ing.cost_per_unit) || 0;
                const unit = ing.unit || 'kg';
                const cat = ing.category || 'ingredient';
                const supplier = ing.supplier || 'Local Market Supplier';

                insertInventoryItem.run(
                  inventoryItemId,
                  ingName,
                  cat,
                  unit,
                  initialStock,
                  minStock,
                  optimalStock,
                  costPerUnit,
                  supplier
                );

                logInventory.run(
                  uuidv4(),
                  inventoryItemId,
                  initialStock,
                  initialStock,
                  `Initial setup via AI Recipe: ${name}`
                );

                newlyCreatedIngredients.push(ingName);
              }
            }

            // Link in recipe_ingredients
            const quantity = Number(ing.quantity) || 0.1;
            const unit = ing.unit || 'kg';
            insertRecipeIng.run(uuidv4(), recipeId, inventoryItemId, quantity, unit);
            linkedIngredients.push({ name: ingName, inventoryItemId, quantity, unit });
          }
        }
      });

      tx();

      // Emit WebSockets so POS, Inventory & TV displays update in real time
      io.emit('recipes:updated', { id: recipeId });
      if (newlyCreatedIngredients.length > 0) {
        io.emit('inventory:updated_all', {});
      }

      res.status(201).json({
        success: true,
        id: recipeId,
        recipe_name: name,
        newly_created_ingredients: newlyCreatedIngredients,
        total_ingredients: linkedIngredients.length
      });
    } catch (error: any) {
      console.error('[RecipesController.importAiRecipe] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
}
