import { Request, Response } from 'express';
import { db } from '../../db/index.js';
import { v4 as uuidv4 } from 'uuid';
import { io } from '../../index.js';

export class InventoryController {
  static getAll(req: Request, res: Response) {
    try {
      const items = db.prepare(`
        SELECT *, 
          CASE WHEN current_stock <= min_stock THEN 1 ELSE 0 END as is_low_stock
        FROM inventory_items 
        ORDER BY category, name ASC
      `).all();

      res.json({ success: true, items });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static create(req: Request, res: Response) {
    try {
      const { name, category, unit, current_stock, min_stock, optimal_stock, cost_per_unit, supplier } = req.body;
      const id = uuidv4();

      db.prepare(`
        INSERT INTO inventory_items (id, name, category, unit, current_stock, min_stock, optimal_stock, cost_per_unit, supplier)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, 
        name, 
        category || 'ingredient', 
        unit || 'kg', 
        Number(current_stock) || 0, 
        Number(min_stock) || 5, 
        Number(optimal_stock) || 20, 
        Number(cost_per_unit) || 0, 
        supplier || ''
      );

      // Log movement
      db.prepare(`
        INSERT INTO inventory_logs (id, inventory_item_id, change_amount, new_stock, reason)
        VALUES (?, ?, ?, ?, ?)
      `).run(uuidv4(), id, Number(current_stock) || 0, Number(current_stock) || 0, 'Initial Stock Setup');

      const newItem = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(id);
      io.emit('inventory:updated', newItem);

      res.status(201).json({ success: true, item: newItem });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, category, unit, min_stock, optimal_stock, cost_per_unit, supplier } = req.body;

      db.prepare(`
        UPDATE inventory_items 
        SET name = ?, category = ?, unit = ?, min_stock = ?, optimal_stock = ?, cost_per_unit = ?, supplier = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(name, category, unit, Number(min_stock), Number(optimal_stock), Number(cost_per_unit), supplier, id);

      const updated = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(id);
      io.emit('inventory:updated', updated);

      res.json({ success: true, item: updated });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static adjustStock(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { change_amount, reason } = req.body;
      const change = Number(change_amount);

      if (isNaN(change)) {
        return res.status(400).json({ success: false, message: 'Invalid change amount' });
      }

      const item = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(id) as any;
      if (!item) {
        return res.status(404).json({ success: false, message: 'Item not found' });
      }

      const newStock = Math.max(0, item.current_stock + change);

      const updateTx = db.transaction(() => {
        db.prepare(`
          UPDATE inventory_items 
          SET current_stock = ?, last_restocked = datetime('now'), updated_at = datetime('now')
          WHERE id = ?
        `).run(newStock, id);

        db.prepare(`
          INSERT INTO inventory_logs (id, inventory_item_id, change_amount, new_stock, reason)
          VALUES (?, ?, ?, ?, ?)
        `).run(uuidv4(), id, change, newStock, reason || 'Manual Stock Adjustment');
      });

      updateTx();

      const updated = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(id);
      io.emit('inventory:updated', updated);

      res.json({ success: true, item: updated });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static getShoppingList(req: Request, res: Response) {
    try {
      // Find all items where current_stock <= min_stock
      const lowStockItems = db.prepare(`
        SELECT *,
          MAX(0, optimal_stock - current_stock) as needed_quantity,
          MAX(0, optimal_stock - current_stock) * cost_per_unit as estimated_cost
        FROM inventory_items
        WHERE current_stock <= min_stock
        ORDER BY supplier ASC, name ASC
      `).all() as any[];

      const totalEstimatedCost = lowStockItems.reduce((acc, item) => acc + (item.estimated_cost || 0), 0);

      // Group by supplier
      const groupedBySupplier: Record<string, any[]> = {};
      for (const item of lowStockItems) {
        const sup = item.supplier?.trim() || 'General / Local Market';
        if (!groupedBySupplier[sup]) groupedBySupplier[sup] = [];
        groupedBySupplier[sup].push(item);
      }

      res.json({
        success: true,
        generated_at: new Date().toISOString(),
        item_count: lowStockItems.length,
        total_estimated_cost_kes: Math.round(totalEstimatedCost * 100) / 100,
        items: lowStockItems,
        suppliers: groupedBySupplier
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static delete(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Check if linked to recipes
      const linked = db.prepare('SELECT COUNT(*) as count FROM recipe_ingredients WHERE inventory_item_id = ?').get(id) as { count: number };
      if (linked.count > 0) {
        return res.status(400).json({ 
          success: false, 
          message: `Cannot delete item because it is used in ${linked.count} recipe(s). Remove it from recipes first.` 
        });
      }

      db.prepare('DELETE FROM inventory_logs WHERE inventory_item_id = ?').run(id);
      db.prepare('DELETE FROM inventory_items WHERE id = ?').run(id);

      io.emit('inventory:deleted', { id });
      res.json({ success: true, id });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}
