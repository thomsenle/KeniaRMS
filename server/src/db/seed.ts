import { db, initDatabase } from './index.js';
import { v4 as uuidv4 } from 'uuid';

export function seedDatabase() {
  initDatabase();

  const waiterCount = db.prepare('SELECT COUNT(*) as count FROM waiters').get() as { count: number };
  if (waiterCount.count > 0) {
    console.log('Database already contains data, skipping seed.');
    return;
  }

  console.log('Seeding initial Kenyan restaurant data...');

  const insertWaiter = db.prepare(`
    INSERT INTO waiters (id, name, pin, role) VALUES (?, ?, ?, ?)
  `);

  const w1 = uuidv4();
  const w2 = uuidv4();
  const wAdmin = uuidv4();

  insertWaiter.run(w1, 'Amina Odhiambo', '1234', 'waiter');
  insertWaiter.run(w2, 'Brian Kiprono', '5678', 'waiter');
  insertWaiter.run(wAdmin, 'Grace Mwangi (Manager)', '9999', 'manager');

  // Tables
  const insertTable = db.prepare(`
    INSERT INTO tables (id, table_number, name, area, status) VALUES (?, ?, ?, ?, ?)
  `);

  const tables = [
    { num: 1, name: 'Table 1', area: 'Restaurant' },
    { num: 2, name: 'Table 2', area: 'Restaurant' },
    { num: 3, name: 'Table 3', area: 'Restaurant' },
    { num: 4, name: 'Table 4', area: 'Restaurant' },
    { num: 5, name: 'Garden 1', area: 'Terrace & Garden' },
    { num: 6, name: 'Garden 2', area: 'Terrace & Garden' },
    { num: 7, name: 'Garden 3', area: 'Terrace & Garden' },
    { num: 8, name: 'Bar Counter 1', area: 'Bar' },
    { num: 9, name: 'Bar Counter 2', area: 'Bar' },
    { num: 10, name: 'VIP Lounge', area: 'VIP' }
  ];

  for (const t of tables) {
    insertTable.run(uuidv4(), t.num, t.name, t.area, 'free');
  }

  // Inventory Items (Drinks & Ingredients)
  const insertInv = db.prepare(`
    INSERT INTO inventory_items (id, name, category, unit, current_stock, min_stock, optimal_stock, cost_per_unit, supplier)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const invItems = [
    { id: uuidv4(), name: 'Tusker Lager 500ml Bottle', category: 'beverage', unit: 'bottle', current: 48, min: 24, opt: 120, cost: 180, sup: 'EABL Kenya' },
    { id: uuidv4(), name: 'White Cap Lager 500ml', category: 'beverage', unit: 'bottle', current: 18, min: 20, opt: 60, cost: 190, sup: 'EABL Kenya' },
    { id: uuidv4(), name: 'Stoney Tangawizi Soda 300ml', category: 'beverage', unit: 'can', current: 15, min: 24, opt: 72, cost: 65, sup: 'Coca-Cola Beverages' },
    { id: uuidv4(), name: 'Konyagi Spirit 750ml', category: 'beverage', unit: 'bottle', current: 4.5, min: 3, opt: 10, cost: 950, sup: 'East Africa Distillers' },
    { id: uuidv4(), name: 'Fresh Limes', category: 'produce', unit: 'kg', current: 3.0, min: 5.0, opt: 15.0, cost: 120, sup: 'Wakulima Market' },
    { id: uuidv4(), name: 'Pure Raw Acacia Honey', category: 'ingredient', unit: 'kg', current: 4.0, min: 2.0, opt: 8.0, cost: 750, sup: 'Baringo Honey Co.' },
    { id: uuidv4(), name: 'Fresh Ginger (Tangawizi)', category: 'produce', unit: 'kg', current: 1.5, min: 3.0, opt: 8.0, cost: 200, sup: 'Wakulima Market' },
    { id: uuidv4(), name: 'Kenyan AA Coffee Beans', category: 'ingredient', unit: 'kg', current: 8.0, min: 4.0, opt: 15.0, cost: 1400, sup: 'Nyeri Farmers Coop' },
    { id: uuidv4(), name: 'Kenyan Gold Tea Leaves', category: 'ingredient', unit: 'kg', current: 5.0, min: 3.0, opt: 10.0, cost: 600, sup: 'Kericho Tea Estates' },
    { id: uuidv4(), name: 'Fresh Whole Cow Milk', category: 'dairy', unit: 'l', current: 12.0, min: 10.0, opt: 30.0, cost: 75, sup: 'Brookside Dairies' },
    { id: uuidv4(), name: 'Prime Goat Meat (Mbuzi)', category: 'meat', unit: 'kg', current: 14.0, min: 10.0, opt: 35.0, cost: 680, sup: 'Kiserian Meat Suppliers' },
    { id: uuidv4(), name: 'Fresh Lake Victoria Tilapia', category: 'meat', unit: 'pcs', current: 8, min: 15, opt: 40, cost: 350, sup: 'Kisumu Fishery Hub' },
    { id: uuidv4(), name: 'Unga wa Ugali (Maize Flour)', category: 'dry_goods', unit: 'kg', current: 25.0, min: 20.0, opt: 60.0, cost: 95, sup: 'Unga Limited' },
    { id: uuidv4(), name: 'Fresh Sukuma Wiki (Collard Greens)', category: 'produce', unit: 'kg', current: 4.0, min: 6.0, opt: 18.0, cost: 60, sup: 'Limuru Greens' },
    { id: uuidv4(), name: 'Red Onions', category: 'produce', unit: 'kg', current: 12.0, min: 10.0, opt: 30.0, cost: 110, sup: 'Wakulima Market' },
    { id: uuidv4(), name: 'Ripe Salad Tomatoes', category: 'produce', unit: 'kg', current: 9.0, min: 8.0, opt: 25.0, cost: 130, sup: 'Wakulima Market' }
  ];

  const invMap: Record<string, string> = {};
  for (const item of invItems) {
    insertInv.run(item.id, item.name, item.category, item.unit, item.current, item.min, item.opt, item.cost, item.sup);
    invMap[item.name] = item.id;
  }

  // Recipes & Menu Items
  const insertRecipe = db.prepare(`
    INSERT INTO recipes (id, name, category, price, tax_rate, catering_levy, description, image_url, station, display_on_board, display_highlight)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertRecipeIng = db.prepare(`
    INSERT INTO recipe_ingredients (id, recipe_id, inventory_item_id, quantity, unit)
    VALUES (?, ?, ?, ?, ?)
  `);

  const recipes = [
    {
      name: 'Nyama Choma Special (1kg Mbuzi)',
      category: 'food',
      price: 1350.0,
      station: 'kitchen',
      desc: 'Tender fire-roasted Kenyan goat meat with kachumbari salad and spicy dip.',
      image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80',
      board: 1,
      highlight: 1,
      ingredients: [
        { invName: 'Prime Goat Meat (Mbuzi)', qty: 1.0, unit: 'kg' },
        { invName: 'Red Onions', qty: 0.15, unit: 'kg' },
        { invName: 'Ripe Salad Tomatoes', qty: 0.15, unit: 'kg' }
      ]
    },
    {
      name: 'Whole Fried Tilapia with Ugali & Sukuma',
      category: 'food',
      price: 950.0,
      station: 'kitchen',
      desc: 'Crispy whole Lake Victoria Tilapia served with traditional steaming hot Ugali and seasoned Sukuma Wiki.',
      image: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=600&auto=format&fit=crop&q=80',
      board: 1,
      highlight: 1,
      ingredients: [
        { invName: 'Fresh Lake Victoria Tilapia', qty: 1, unit: 'pcs' },
        { invName: 'Unga wa Ugali (Maize Flour)', qty: 0.25, unit: 'kg' },
        { invName: 'Fresh Sukuma Wiki (Collard Greens)', qty: 0.2, unit: 'kg' },
        { invName: 'Ripe Salad Tomatoes', qty: 0.1, unit: 'kg' }
      ]
    },
    {
      name: 'Famous Kenyan Dawa Cocktail',
      category: 'cocktails',
      price: 650.0,
      station: 'bar',
      desc: 'The iconic Kenyan remedy: East African spirit, crushed fresh limes, brown cane sugar and a honey-coated dawa stick.',
      image: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=600&auto=format&fit=crop&q=80',
      board: 1,
      highlight: 1,
      ingredients: [
        { invName: 'Konyagi Spirit 750ml', qty: 0.08, unit: 'bottle' }, // approx 60ml
        { invName: 'Fresh Limes', qty: 0.08, unit: 'kg' },
        { invName: 'Pure Raw Acacia Honey', qty: 0.03, unit: 'kg' }
      ]
    },
    {
      name: 'Tusker Premium Lager (500ml Cold)',
      category: 'drinks',
      price: 350.0,
      station: 'bar',
      desc: 'Kenyan pride since 1922. Crisp, refreshing golden lager served ice cold.',
      image: 'https://images.unsplash.com/photo-1608270119853-270f2095f0ad?w=600&auto=format&fit=crop&q=80',
      board: 1,
      highlight: 0,
      ingredients: [
        { invName: 'Tusker Lager 500ml Bottle', qty: 1, unit: 'bottle' }
      ]
    },
    {
      name: 'White Cap Lager (500ml Cold)',
      category: 'drinks',
      price: 360.0,
      station: 'bar',
      desc: 'Crisp, smooth Kenyan lager with a clean malt finish.',
      image: 'https://images.unsplash.com/photo-1618886614638-80e3c103d31a?w=600&auto=format&fit=crop&q=80',
      board: 1,
      highlight: 0,
      ingredients: [
        { invName: 'White Cap Lager 500ml', qty: 1, unit: 'bottle' }
      ]
    },
    {
      name: 'Authentic Kenyan Chai Masala',
      category: 'coffee',
      price: 220.0,
      station: 'bar',
      desc: 'Slow-brewed highland tea with farm fresh milk, crushed ginger and aromatic spices.',
      image: 'https://images.unsplash.com/photo-1561336313-0bd5e0b27ec8?w=600&auto=format&fit=crop&q=80',
      board: 1,
      highlight: 0,
      ingredients: [
        { invName: 'Kenyan Gold Tea Leaves', qty: 0.015, unit: 'kg' },
        { invName: 'Fresh Whole Cow Milk', qty: 0.2, unit: 'l' },
        { invName: 'Fresh Ginger (Tangawizi)', qty: 0.02, unit: 'kg' }
      ]
    },
    {
      name: 'Kenyan AA Single Origin Filter Coffee',
      category: 'coffee',
      price: 280.0,
      station: 'bar',
      desc: 'World renowned Nyeri AA grade arabica with bright blackcurrant acidity and rich body.',
      image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&auto=format&fit=crop&q=80',
      board: 1,
      highlight: 0,
      ingredients: [
        { invName: 'Kenyan AA Coffee Beans', qty: 0.025, unit: 'kg' }
      ]
    },
    {
      name: 'Stoney Tangawizi Cold Can (300ml)',
      category: 'drinks',
      price: 150.0,
      station: 'bar',
      desc: 'Extra pungent, fiery Kenyan ginger beer soda served chilled.',
      image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=600&auto=format&fit=crop&q=80',
      board: 1,
      highlight: 0,
      ingredients: [
        { invName: 'Stoney Tangawizi Soda 300ml', qty: 1, unit: 'can' }
      ]
    }
  ];

  for (const r of recipes) {
    const recipeId = uuidv4();
    insertRecipe.run(recipeId, r.name, r.category, r.price, 16.0, 2.0, r.desc, r.image, r.station, r.board, r.highlight);
    for (const ing of r.ingredients) {
      const invId = invMap[ing.invName];
      if (invId) {
        insertRecipeIng.run(uuidv4(), recipeId, invId, ing.qty, ing.unit);
      }
    }
  }

  // Printers
  const insertPrinter = db.prepare(`
    INSERT INTO printer_settings (id, station, name, printer_type, ip_address, port)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertPrinter.run(uuidv4(), 'kitchen', 'Kitchen Food Printer', 'browser_preview', '192.168.1.201', 9100);
  insertPrinter.run(uuidv4(), 'bar', 'Bar & Drinks Printer', 'browser_preview', '192.168.1.202', 9100);
  insertPrinter.run(uuidv4(), 'cashier', 'Main Guest Receipt Printer', 'browser_preview', '192.168.1.200', 9100);

  // M-Pesa Business Configuration
  db.prepare(`
    INSERT INTO mpesa_settings (id, business_type, shortcode, till_number, passkey, environment)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    uuidv4(),
    'till',
    '174379',
    '543210',
    'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919',
    'sandbox'
  );

  console.log('Seed completed successfully!');
}

if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  seedDatabase();
}
