import { Request, Response } from 'express';
import { db } from '../../db/index.js';
import { v4 as uuidv4 } from 'uuid';
import { io } from '../../index.js';
import { PrinterService, PrintTicketItem } from '../printers/printer.service.js';

export class POSController {
  static getTables(_req: Request, res: Response) {
    try {
      const tables = db.prepare(`
        SELECT t.*, w.name as active_waiter_name,
               o.id as active_order_id, o.status as order_status, o.total_gross as order_total_gross
        FROM tables t
        LEFT JOIN waiters w ON t.active_waiter_id = w.id
        LEFT JOIN orders o ON t.id = o.table_id AND o.status IN ('open', 'partially_paid')
        ORDER BY t.table_number ASC
      `).all();

      res.json({ success: true, tables });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static openTable(req: Request, res: Response) {
    try {
      const { tableId } = req.params;
      const { waiter_id, shift_id, guests_count } = req.body;

      const table = db.prepare('SELECT * FROM tables WHERE id = ?').get(tableId) as any;
      if (!table) {
        return res.status(404).json({ success: false, message: 'Table not found' });
      }

      // Check if order already open
      let order = db.prepare(`
        SELECT * FROM orders WHERE table_id = ? AND status IN ('open', 'partially_paid')
      `).get(tableId) as any;

      if (!order) {
        const orderId = uuidv4();
        db.prepare(`
          INSERT INTO orders (id, table_id, waiter_id, shift_id, status)
          VALUES (?, ?, ?, ?, 'open')
        `).run(orderId, tableId, waiter_id, shift_id || null);

        db.prepare(`
          UPDATE tables 
          SET status = 'occupied', active_waiter_id = ?, guests_count = ?
          WHERE id = ?
        `).run(waiter_id, Number(guests_count) || 1, tableId);

        order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
      }

      io.emit('tables:updated');
      res.json({ success: true, table, order });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static getOrder(req: Request, res: Response) {
    try {
      const { tableId } = req.params;
      const order = db.prepare(`
        SELECT o.*, t.name as table_name, t.table_number, w.name as waiter_name
        FROM orders o
        JOIN tables t ON o.table_id = t.id
        JOIN waiters w ON o.waiter_id = w.id
        WHERE o.table_id = ? AND o.status IN ('open', 'partially_paid')
        ORDER BY o.created_at DESC LIMIT 1
      `).get(tableId) as any;

      if (!order) {
        return res.json({ success: true, order: null, items: [] });
      }

      const items = db.prepare(`
        SELECT oi.*, r.category as recipe_category, r.image_url
        FROM order_items oi
        JOIN recipes r ON oi.recipe_id = r.id
        WHERE oi.order_id = ?
        ORDER BY oi.created_at ASC
      `).all(order.id);

      res.json({ success: true, order, items });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // Add item to cart (DOES NOT DEDUCT INVENTORY YET)
  static addItemToCart(req: Request, res: Response) {
    try {
      const orderId = req.params.orderId as string;
      const { recipe_id, quantity, notes } = req.body;
      const qty = Math.max(1, Number(quantity) || 1);

      const recipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(recipe_id) as any;
      if (!recipe) {
        return res.status(404).json({ success: false, message: 'Recipe item not found' });
      }

      // Check if item already in cart (not yet sent to station)
      const existingInCart = db.prepare(`
        SELECT * FROM order_items 
        WHERE order_id = ? AND recipe_id = ? AND status = 'in_cart' AND (notes = ? OR (notes IS NULL AND ? IS NULL))
      `).get(orderId, recipe_id, notes || null, notes || null) as any;

      if (existingInCart) {
        const newQty = existingInCart.quantity + qty;
        const newTotal = newQty * recipe.price;
        db.prepare(`
          UPDATE order_items 
          SET quantity = ?, total_price = ?
          WHERE id = ?
        `).run(newQty, newTotal, existingInCart.id);
      } else {
        const itemId = uuidv4();
        db.prepare(`
          INSERT INTO order_items (id, order_id, recipe_id, recipe_name, quantity, unit_price, total_price, status, station, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'in_cart', ?, ?)
        `).run(itemId, orderId, recipe.id, recipe.name, qty, recipe.price, qty * recipe.price, recipe.station || 'kitchen', notes || null);
      }

      POSController.recalculateOrderTotals(orderId);
      io.emit('order:cart_updated', { orderId });

      res.json({ success: true, message: 'Item added to cart (awaiting dispatch to bar/kitchen)' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static updateCartItem(req: Request, res: Response) {
    try {
      const { itemId } = req.params;
      const { quantity, notes } = req.body;
      const qty = Number(quantity);

      const item = db.prepare('SELECT * FROM order_items WHERE id = ?').get(itemId) as any;
      if (!item) {
        return res.status(404).json({ success: false, message: 'Item not found' });
      }

      if (item.status !== 'in_cart') {
        return res.status(400).json({ success: false, message: 'Cannot edit an item that has already been sent to kitchen/bar or paid' });
      }

      if (qty <= 0) {
        db.prepare('DELETE FROM order_items WHERE id = ?').run(itemId);
      } else {
        db.prepare(`
          UPDATE order_items 
          SET quantity = ?, total_price = ? * unit_price, notes = ?
          WHERE id = ?
        `).run(qty, qty, notes !== undefined ? notes : item.notes, itemId);
      }

      POSController.recalculateOrderTotals(item.order_id);
      io.emit('order:cart_updated', { orderId: item.order_id });

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static removeCartItem(req: Request, res: Response) {
    try {
      const { itemId } = req.params;
      const item = db.prepare('SELECT * FROM order_items WHERE id = ?').get(itemId) as any;
      if (!item) {
        return res.status(404).json({ success: false, message: 'Item not found' });
      }

      if (item.status !== 'in_cart') {
        return res.status(400).json({ success: false, message: 'Item was already sent to station. Void/Storno required.' });
      }

      db.prepare('DELETE FROM order_items WHERE id = ?').run(itemId);
      POSController.recalculateOrderTotals(item.order_id);
      io.emit('order:cart_updated', { orderId: item.order_id });

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * CRITICAL BUSINESS LOGIC:
   * "Die Lagerbuchung muss erst passieren wenn der Kellner die Bestellung an die Bar/Küche schickt."
   * Triggered when waiter presses "Send to Bar/Kitchen".
   */
  static async sendToKitchenAndBar(req: Request, res: Response) {
    try {
      const orderId = req.params.orderId as string;

      const order = db.prepare(`
        SELECT o.*, t.name as table_name, t.table_number, w.name as waiter_name
        FROM orders o
        JOIN tables t ON o.table_id = t.id
        JOIN waiters w ON o.waiter_id = w.id
        WHERE o.id = ?
      `).get(orderId) as any;

      if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }

      // 1. Get all items that are currently 'in_cart'
      const pendingItems = db.prepare(`
        SELECT oi.*, r.station as recipe_station
        FROM order_items oi
        JOIN recipes r ON oi.recipe_id = r.id
        WHERE oi.order_id = ? AND oi.status = 'in_cart'
      `).all(orderId) as any[];

      if (pendingItems.length === 0) {
        return res.status(400).json({ success: false, message: 'No new items in cart to send' });
      }

      // Group for printing
      const kitchenItems: PrintTicketItem[] = [];
      const barItems: PrintTicketItem[] = [];
      const lowStockAlerts: string[] = [];

      // 2. Atomic Transaction: Update items status & DECREMENT INVENTORY
      const dispatchTx = db.transaction(() => {
        const markSent = db.prepare(`
          UPDATE order_items 
          SET status = 'sent_to_station', sent_to_station_at = datetime('now')
          WHERE id = ?
        `);

        const getRecipeIngredients = db.prepare(`
          SELECT ri.*, ii.name as inventory_name, ii.current_stock, ii.min_stock
          FROM recipe_ingredients ri
          JOIN inventory_items ii ON ri.inventory_item_id = ii.id
          WHERE ri.recipe_id = ?
        `);

        const decrementStock = db.prepare(`
          UPDATE inventory_items 
          SET current_stock = current_stock - ?, updated_at = datetime('now')
          WHERE id = ?
        `);

        const logStockMovement = db.prepare(`
          INSERT INTO inventory_logs (id, inventory_item_id, change_amount, new_stock, reason, reference_id)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        for (const item of pendingItems) {
          markSent.run(item.id);

          // Build print items
          const printItem: PrintTicketItem = {
            name: item.recipe_name,
            quantity: item.quantity,
            notes: item.notes
          };

          if (item.station === 'bar' || item.recipe_station === 'bar') {
            barItems.push(printItem);
          } else {
            kitchenItems.push(printItem);
          }

          // Fetch ingredients and deduct from inventory
          const ingredients = getRecipeIngredients.all(item.recipe_id) as any[];
          for (const ing of ingredients) {
            const consumedQty = ing.quantity * item.quantity;
            decrementStock.run(consumedQty, ing.inventory_item_id);

            const updatedItem = db.prepare('SELECT current_stock, min_stock, name FROM inventory_items WHERE id = ?').get(ing.inventory_item_id) as any;
            logStockMovement.run(
              uuidv4(), 
              ing.inventory_item_id, 
              -consumedQty, 
              updatedItem.current_stock, 
              `Order Sent: Table ${order.table_name} (${item.quantity}x ${item.recipe_name})`, 
              order.id
            );

            if (updatedItem.current_stock <= updatedItem.min_stock) {
              lowStockAlerts.push(`${updatedItem.name} is now low in stock (${updatedItem.current_stock} left)!`);
            }
          }
        }
      });

      dispatchTx();

      POSController.recalculateOrderTotals(orderId);

      // 3. Dispatch to universal ESC/POS printers / Web preview
      const now = new Date().toISOString();
      if (kitchenItems.length > 0) {
        await PrinterService.printTicket({
          station: 'kitchen',
          title: 'KITCHEN ORDER',
          tableNumber: order.table_number,
          tableName: order.table_name,
          waiterName: order.waiter_name,
          timestamp: now,
          items: kitchenItems
        });
      }

      if (barItems.length > 0) {
        await PrinterService.printTicket({
          station: 'bar',
          title: 'BAR DRINKS ORDER',
          tableNumber: order.table_number,
          tableName: order.table_name,
          waiterName: order.waiter_name,
          timestamp: now,
          items: barItems
        });
      }

      // 4. Broadcast live Socket.io events
      io.emit('order:sent', { orderId, tableId: order.table_id });
      io.emit('inventory:updated_all');
      if (lowStockAlerts.length > 0) {
        io.emit('inventory:low_stock_warning', { alerts: lowStockAlerts });
      }

      res.json({
        success: true,
        message: `Order sent to stations! Inventory deducted for ${pendingItems.length} items.`,
        sentItemsCount: pendingItems.length,
        kitchenItemsCount: kitchenItems.length,
        barItemsCount: barItems.length,
        lowStockAlerts
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // Split bill & payment settlement
  static async splitAndPayBill(req: Request, res: Response) {
    try {
      const { orderId } = req.params;
      const { items, payment_method, paid_amount, tip_amount, waiter_id, shift_id } = req.body;

      const order = db.prepare(`
        SELECT o.*, t.name as table_name, t.table_number, w.name as waiter_name
        FROM orders o
        JOIN tables t ON o.table_id = t.id
        JOIN waiters w ON o.waiter_id = w.id
        WHERE o.id = ?
      `).get(orderId) as any;

      if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, message: 'Select at least one item to pay for' });
      }

      // 1. Calculate items and amounts first
      const itemsToSettle: Array<{
        orderItem: any;
        payQty: number;
        itemPrice: number;
      }> = [];

      let subtotal = 0;
      for (const it of items) {
        const orderItem = db.prepare('SELECT * FROM order_items WHERE id = ? AND order_id = ?').get(it.order_item_id, orderId) as any;
        if (orderItem) {
          const payQty = Math.min(orderItem.quantity, Math.max(1, Number(it.quantity) || orderItem.quantity));
          const itemPrice = orderItem.unit_price * payQty;
          subtotal += itemPrice;

          itemsToSettle.push({
            orderItem,
            payQty,
            itemPrice
          });
        }
      }

      if (itemsToSettle.length === 0) {
        return res.status(400).json({ success: false, message: 'No valid items found to pay for' });
      }

      // 2. Kenyan Tax Calculation (16% VAT + 2% Catering Levy)
      const total = subtotal;
      const tax16 = Math.round((total * (16 / 118)) * 100) / 100;
      const levy2 = Math.round((total * (2 / 118)) * 100) / 100;
      const netSubtotal = total - tax16 - levy2;

      const tip = Number(tip_amount) || 0;
      const paid = Number(paid_amount) || total;
      const change = Math.max(0, paid - total);

      // 3. Sanitize foreign keys (waiter_id, shift_id) to prevent FK constraint failures
      let validWaiterId = waiter_id || order.waiter_id;
      const waiterExists = db.prepare('SELECT id FROM waiters WHERE id = ?').get(validWaiterId);
      if (!waiterExists) {
        validWaiterId = order.waiter_id;
      }

      let validShiftId: string | null = (shift_id || order.shift_id) || null;
      if (validShiftId) {
        const shiftExists = db.prepare('SELECT id FROM waiter_shifts WHERE id = ?').get(validShiftId);
        if (!shiftExists) {
          validShiftId = null;
        }
      }

      const billId = uuidv4();
      const printItems: PrintTicketItem[] = [];

      // 4. Perform atomic settlement in transaction: INSERT BILL FIRST, THEN BILL_ITEMS!
      const settleTx = db.transaction(() => {
        const insertBill = db.prepare(`
          INSERT INTO bills (id, order_id, table_id, waiter_id, shift_id, subtotal, tax_amount, levy_amount, total_amount, paid_amount, change_amount, tip_amount, payment_method)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const insertBillItem = db.prepare(`
          INSERT INTO bill_items (id, bill_id, order_item_id, quantity, price)
          VALUES (?, ?, ?, ?, ?)
        `);

        const updateOrderItemStatus = db.prepare(`
          UPDATE order_items SET status = 'paid' WHERE id = ?
        `);

        // INSERT BILL FIRST to satisfy FOREIGN KEY (bill_id) REFERENCES bills(id)
        insertBill.run(
          billId,
          orderId,
          order.table_id,
          validWaiterId,
          validShiftId,
          netSubtotal,
          tax16,
          levy2,
          total,
          paid,
          change,
          tip,
          payment_method || 'cash'
        );

        // THEN INSERT BILL ITEMS (and handle partial split item quantities cleanly)
        for (const entry of itemsToSettle) {
          const { orderItem, payQty, itemPrice } = entry;
          
          if (payQty < orderItem.quantity) {
            const remainingQty = orderItem.quantity - payQty;
            db.prepare(`UPDATE order_items SET quantity = ?, total_price = ? WHERE id = ?`).run(
              remainingQty,
              remainingQty * orderItem.unit_price,
              orderItem.id
            );
            const paidPieceId = uuidv4();
            db.prepare(`
              INSERT INTO order_items (id, order_id, recipe_id, recipe_name, quantity, unit_price, total_price, status, station, notes, sent_to_station_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, 'paid', ?, ?, ?)
            `).run(
              paidPieceId,
              orderId,
              orderItem.recipe_id,
              orderItem.recipe_name,
              payQty,
              orderItem.unit_price,
              itemPrice,
              orderItem.station,
              orderItem.notes,
              orderItem.sent_to_station_at
            );
            insertBillItem.run(uuidv4(), billId, paidPieceId, payQty, itemPrice);
          } else {
            insertBillItem.run(uuidv4(), billId, orderItem.id, payQty, itemPrice);
            updateOrderItemStatus.run(orderItem.id);
          }

          printItems.push({
            name: orderItem.recipe_name,
            quantity: payQty,
            price: orderItem.unit_price
          });
        }
      });

      settleTx();

      // Check if any unpaid items remain on the order
      const remainingUnpaid = db.prepare(`
        SELECT COUNT(*) as count FROM order_items 
        WHERE order_id = ? AND status != 'paid' AND status != 'cancelled'
      `).get(orderId) as { count: number };

      let isFullyPaid = false;
      if (remainingUnpaid.count === 0) {
        isFullyPaid = true;
        db.prepare(`UPDATE orders SET status = 'closed', closed_at = datetime('now') WHERE id = ?`).run(orderId);
        db.prepare(`UPDATE tables SET status = 'free', active_waiter_id = NULL WHERE id = ?`).run(order.table_id);
      } else {
        db.prepare(`UPDATE orders SET status = 'partially_paid' WHERE id = ?`).run(orderId);
      }

      // Guest Receipt Printout
      const totalAmount = total;

      await PrinterService.printTicket({
        station: 'cashier',
        title: 'TAX INVOICE / RECEIPT',
        tableNumber: order.table_number,
        tableName: order.table_name,
        waiterName: order.waiter_name,
        orderNumber: billId.substring(0, 8).toUpperCase(),
        timestamp: new Date().toISOString(),
        items: printItems,
        subtotal: totalAmount - tax16 - levy2,
        tax16,
        levy2,
        total: totalAmount,
        paymentMethod: payment_method || 'cash',
        paidAmount: Number(paid_amount) || totalAmount,
        changeAmount: Math.max(0, (Number(paid_amount) || totalAmount) - totalAmount),
        tipAmount: Number(tip_amount) || 0
      });

      io.emit('tables:updated');
      io.emit('order:cart_updated', { orderId });

      res.json({
        success: true,
        billId,
        isFullyPaid,
        tableStatus: isFullyPaid ? 'free' : 'occupied',
        message: isFullyPaid ? 'Bill fully settled! Table is now free.' : 'Partial bill settled successfully.'
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // Transfer table to another table
  static transferTable(req: Request, res: Response) {
    try {
      const { orderId } = req.params;
      const { targetTableId } = req.body;

      const targetTable = db.prepare('SELECT * FROM tables WHERE id = ?').get(targetTableId) as any;
      if (!targetTable) {
        return res.status(404).json({ success: false, message: 'Target table not found' });
      }

      if (targetTable.status !== 'free') {
        return res.status(400).json({ success: false, message: 'Target table is already occupied' });
      }

      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
      if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }

      const transferTx = db.transaction(() => {
        // Free old table
        db.prepare('UPDATE tables SET status = \'free\', active_waiter_id = NULL WHERE id = ?').run(order.table_id);
        // Occupy new table
        db.prepare('UPDATE tables SET status = \'occupied\', active_waiter_id = ? WHERE id = ?').run(order.waiter_id, targetTableId);
        // Update order
        db.prepare('UPDATE orders SET table_id = ? WHERE id = ?').run(targetTableId, orderId);
      });

      transferTx();

      io.emit('tables:updated');
      res.json({ success: true, message: `Order successfully transferred to ${targetTable.name}` });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  private static recalculateOrderTotals(orderId: string) {
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ? AND status != \'cancelled\'').all(orderId) as any[];
    const grossTotal = items.reduce((acc, it) => acc + (it.total_price || 0), 0);
    const tax16 = Math.round((grossTotal * (16 / 118)) * 100) / 100;
    const levy2 = Math.round((grossTotal * (2 / 118)) * 100) / 100;
    const net = grossTotal - tax16 - levy2;

    db.prepare(`
      UPDATE orders 
      SET total_net = ?, total_tax = ?, total_levy = ?, total_gross = ?
      WHERE id = ?
    `).run(net, tax16, levy2, grossTotal, orderId);
  }
}
