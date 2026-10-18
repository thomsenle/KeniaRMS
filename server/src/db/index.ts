import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const dataDir = process.env.DATA_DIR || path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'kenia_rms.db');
export const db = new Database(dbPath);

// Enable WAL mode for high concurrency & speed
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    -- Waiters & Staff
    CREATE TABLE IF NOT EXISTS waiters (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      pin TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'waiter',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Waiter Shifts (Float & Cash drawer settlement)
    CREATE TABLE IF NOT EXISTS waiter_shifts (
      id TEXT PRIMARY KEY,
      waiter_id TEXT NOT NULL,
      start_time TEXT NOT NULL DEFAULT (datetime('now')),
      end_time TEXT,
      starting_float REAL NOT NULL DEFAULT 0.0,
      counted_cash REAL,
      calculated_sales_cash REAL NOT NULL DEFAULT 0.0,
      calculated_sales_card REAL NOT NULL DEFAULT 0.0,
      calculated_sales_mpesa REAL NOT NULL DEFAULT 0.0,
      calculated_tips REAL NOT NULL DEFAULT 0.0,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      FOREIGN KEY (waiter_id) REFERENCES waiters(id)
    );

    -- Inventory: Drinks & Ingredients
    CREATE TABLE IF NOT EXISTS inventory_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      unit TEXT NOT NULL,
      current_stock REAL NOT NULL DEFAULT 0.0,
      min_stock REAL NOT NULL DEFAULT 5.0,
      optimal_stock REAL NOT NULL DEFAULT 20.0,
      cost_per_unit REAL NOT NULL DEFAULT 0.0,
      supplier TEXT,
      last_restocked TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Inventory Movement History
    CREATE TABLE IF NOT EXISTS inventory_logs (
      id TEXT PRIMARY KEY,
      inventory_item_id TEXT NOT NULL,
      change_amount REAL NOT NULL,
      new_stock REAL NOT NULL,
      reason TEXT NOT NULL,
      reference_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id)
    );

    -- Recipes & Menu Items
    CREATE TABLE IF NOT EXISTS recipes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL,
      tax_rate REAL NOT NULL DEFAULT 16.0,
      catering_levy REAL NOT NULL DEFAULT 2.0,
      description TEXT,
      image_url TEXT,
      station TEXT NOT NULL DEFAULT 'kitchen',
      is_active INTEGER NOT NULL DEFAULT 1,
      display_on_board INTEGER NOT NULL DEFAULT 1,
      display_highlight INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Link Recipe to Inventory Items (Ingredients consumed upon order send)
    CREATE TABLE IF NOT EXISTS recipe_ingredients (
      id TEXT PRIMARY KEY,
      recipe_id TEXT NOT NULL,
      inventory_item_id TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
      FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE RESTRICT
    );

    -- Restaurant Areas (Manager-configurable dining areas)
    CREATE TABLE IF NOT EXISTS restaurant_areas (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Tables
    CREATE TABLE IF NOT EXISTS tables (
      id TEXT PRIMARY KEY,
      table_number INTEGER NOT NULL UNIQUE,
      name TEXT NOT NULL,
      area TEXT NOT NULL DEFAULT 'Restaurant',
      status TEXT NOT NULL DEFAULT 'free',
      active_waiter_id TEXT,
      guests_count INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (active_waiter_id) REFERENCES waiters(id)
    );

    -- Orders
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      table_id TEXT NOT NULL,
      waiter_id TEXT NOT NULL,
      shift_id TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      total_net REAL NOT NULL DEFAULT 0.0,
      total_tax REAL NOT NULL DEFAULT 0.0,
      total_levy REAL NOT NULL DEFAULT 0.0,
      total_gross REAL NOT NULL DEFAULT 0.0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      closed_at TEXT,
      FOREIGN KEY (table_id) REFERENCES tables(id),
      FOREIGN KEY (waiter_id) REFERENCES waiters(id),
      FOREIGN KEY (shift_id) REFERENCES waiter_shifts(id)
    );

    -- Order Items
    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      recipe_id TEXT NOT NULL,
      recipe_name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'in_cart',
      station TEXT NOT NULL DEFAULT 'kitchen',
      notes TEXT,
      sent_to_station_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (recipe_id) REFERENCES recipes(id)
    );

    -- Bills & Split Payments
    CREATE TABLE IF NOT EXISTS bills (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      table_id TEXT NOT NULL,
      waiter_id TEXT NOT NULL,
      shift_id TEXT,
      subtotal REAL NOT NULL,
      tax_amount REAL NOT NULL,
      levy_amount REAL NOT NULL,
      total_amount REAL NOT NULL,
      paid_amount REAL NOT NULL,
      change_amount REAL NOT NULL DEFAULT 0.0,
      tip_amount REAL NOT NULL DEFAULT 0.0,
      payment_method TEXT NOT NULL DEFAULT 'cash',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (waiter_id) REFERENCES waiters(id),
      FOREIGN KEY (shift_id) REFERENCES waiter_shifts(id)
    );

    -- Bill item linking for split bills
    CREATE TABLE IF NOT EXISTS bill_items (
      id TEXT PRIMARY KEY,
      bill_id TEXT NOT NULL,
      order_item_id TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      price REAL NOT NULL,
      FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
      FOREIGN KEY (order_item_id) REFERENCES order_items(id)
    );

    -- Daily Closing (Z-Report)
    CREATE TABLE IF NOT EXISTS daily_closings (
      id TEXT PRIMARY KEY,
      closing_date TEXT NOT NULL UNIQUE,
      closed_at TEXT NOT NULL DEFAULT (datetime('now')),
      closed_by_waiter_id TEXT,
      total_gross_sales REAL NOT NULL DEFAULT 0.0,
      total_net_sales REAL NOT NULL DEFAULT 0.0,
      total_tax_16 REAL NOT NULL DEFAULT 0.0,
      total_levy_2 REAL NOT NULL DEFAULT 0.0,
      total_cash REAL NOT NULL DEFAULT 0.0,
      total_card REAL NOT NULL DEFAULT 0.0,
      total_mpesa REAL NOT NULL DEFAULT 0.0,
      total_tips REAL NOT NULL DEFAULT 0.0,
      total_orders_count INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      FOREIGN KEY (closed_by_waiter_id) REFERENCES waiters(id)
    );

    -- Printer Settings
    CREATE TABLE IF NOT EXISTS printer_settings (
      id TEXT PRIMARY KEY,
      station TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      printer_type TEXT NOT NULL DEFAULT 'browser_preview',
      ip_address TEXT,
      port INTEGER NOT NULL DEFAULT 9100,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    -- M-Pesa Transactions & STK Push Logs
    CREATE TABLE IF NOT EXISTS mpesa_transactions (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      checkout_request_id TEXT UNIQUE,
      merchant_request_id TEXT,
      phone_number TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      mpesa_receipt_number TEXT,
      result_code INTEGER,
      result_desc TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    -- M-Pesa Business Settings (Till, Paybill, API Keys)
    CREATE TABLE IF NOT EXISTS mpesa_settings (
      id TEXT PRIMARY KEY,
      business_type TEXT NOT NULL DEFAULT 'till',
      shortcode TEXT NOT NULL DEFAULT '174379',
      till_number TEXT NOT NULL DEFAULT '543210',
      passkey TEXT,
      consumer_key TEXT,
      consumer_secret TEXT,
      environment TEXT NOT NULL DEFAULT 'sandbox'
    );

    -- Staff Schedules & Shift Roster (Dienstplan)
    CREATE TABLE IF NOT EXISTS staff_schedules (
      id TEXT PRIMARY KEY,
      staff_id TEXT NOT NULL,
      shift_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      planned_hours REAL NOT NULL DEFAULT 8.0,
      station TEXT NOT NULL DEFAULT 'service',
      status TEXT NOT NULL DEFAULT 'scheduled',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (staff_id) REFERENCES waiters(id) ON DELETE CASCADE
    );

    -- Staff Time Tracking & Actual Work Hours (Zeiterfassung & Stundenübersicht)
    CREATE TABLE IF NOT EXISTS staff_time_entries (
      id TEXT PRIMARY KEY,
      staff_id TEXT NOT NULL,
      clock_in TEXT NOT NULL,
      clock_out TEXT,
      break_minutes INTEGER NOT NULL DEFAULT 0,
      total_hours REAL NOT NULL DEFAULT 0.0,
      hourly_rate REAL NOT NULL DEFAULT 0.0,
      total_wage REAL NOT NULL DEFAULT 0.0,
      shift_type TEXT NOT NULL DEFAULT 'regular',
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'approved',
      shift_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (staff_id) REFERENCES waiters(id) ON DELETE CASCADE
    );

    -- Application & AI Pricing Settings
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Digital Signage & Bar Display Screens (WYSIWYG Screen Builder)
    CREATE TABLE IF NOT EXISTS display_screens (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT,
      theme TEXT NOT NULL DEFAULT 'midnight',
      font_size TEXT NOT NULL DEFAULT 'large',
      layout_type TEXT NOT NULL DEFAULT '3_columns',
      zones_json TEXT NOT NULL,
      ticker_enabled INTEGER NOT NULL DEFAULT 1,
      ticker_text TEXT,
      ticker_speed TEXT NOT NULL DEFAULT 'normal',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Ensure waiters has full employee management columns
  try {
    const waiterCols = db.prepare(`PRAGMA table_info(waiters)`).all() as any[];
    if (!waiterCols.some(c => c.name === 'phone')) {
      db.prepare(`ALTER TABLE waiters ADD COLUMN phone TEXT`).run();
    }
    if (!waiterCols.some(c => c.name === 'email')) {
      db.prepare(`ALTER TABLE waiters ADD COLUMN email TEXT`).run();
    }
    if (!waiterCols.some(c => c.name === 'hourly_rate')) {
      db.prepare(`ALTER TABLE waiters ADD COLUMN hourly_rate REAL NOT NULL DEFAULT 0.0`).run();
    }
    if (!waiterCols.some(c => c.name === 'target_weekly_hours')) {
      db.prepare(`ALTER TABLE waiters ADD COLUMN target_weekly_hours REAL NOT NULL DEFAULT 40.0`).run();
    }
    if (!waiterCols.some(c => c.name === 'hire_date')) {
      db.prepare(`ALTER TABLE waiters ADD COLUMN hire_date TEXT`).run();
    }
    if (!waiterCols.some(c => c.name === 'notes')) {
      db.prepare(`ALTER TABLE waiters ADD COLUMN notes TEXT`).run();
    }
    if (!waiterCols.some(c => c.name === 'department')) {
      db.prepare(`ALTER TABLE waiters ADD COLUMN department TEXT NOT NULL DEFAULT 'service'`).run();
    }
  } catch (err) {
    // Ignore migration error
  }

  // Ensure mpesa_transactions has items_json, waiter_id, shift_id
  try {
    const cols = db.prepare(`PRAGMA table_info(mpesa_transactions)`).all() as any[];
    if (!cols.some(c => c.name === 'items_json')) {
      db.prepare(`ALTER TABLE mpesa_transactions ADD COLUMN items_json TEXT`).run();
    }
    if (!cols.some(c => c.name === 'waiter_id')) {
      db.prepare(`ALTER TABLE mpesa_transactions ADD COLUMN waiter_id TEXT`).run();
    }
    if (!cols.some(c => c.name === 'shift_id')) {
      db.prepare(`ALTER TABLE mpesa_transactions ADD COLUMN shift_id TEXT`).run();
    }
  } catch (err) {
    // Ignore migration error if already exists
  }

  // Ensure tables has is_active column
  try {
    const tableCols = db.prepare(`PRAGMA table_info(tables)`).all() as any[];
    if (!tableCols.some(c => c.name === 'is_active')) {
      db.prepare(`ALTER TABLE tables ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1`).run();
    }
  } catch (err) {
    // Ignore migration error
  }

  // Ensure restaurant_areas exists and default areas are seeded
  try {
    const areaCount = (db.prepare('SELECT COUNT(*) as count FROM restaurant_areas').get() as any)?.count || 0;
    if (areaCount === 0) {
      const distinctAreas = db.prepare('SELECT DISTINCT area FROM tables WHERE area IS NOT NULL').all() as any[];
      const standardAreas = ['Restaurant', 'Terrace & Garden', 'Bar', 'VIP'];
      const allToSeed = Array.from(new Set([...standardAreas, ...distinctAreas.map(d => d.area).filter(Boolean)]));

      let order = 1;
      for (const areaName of allToSeed) {
        db.prepare(`
          INSERT OR IGNORE INTO restaurant_areas (id, name, display_order)
          VALUES (?, ?, ?)
        `).run(uuidv4(), areaName, order++);
      }
    }
  } catch (err) {
    // Ignore migration error
  }

  // Ensure default mpesa_settings entry exists
  try {
    const mpesaCount = (db.prepare(`SELECT COUNT(*) as count FROM mpesa_settings`).get() as any)?.count || 0;
    if (mpesaCount === 0) {
      db.prepare(`
        INSERT INTO mpesa_settings (id, business_type, shortcode, till_number, passkey, environment)
        VALUES ('mpesa_default', 'till', '174379', '543210', 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919', 'sandbox')
      `).run();
    }
  } catch (err) {
    // Ignore
  }

  // Ensure default app_settings entries exist
  try {
    const insertSetting = db.prepare(`
      INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)
    `);
    insertSetting.run('pricing_location', 'Diani Beach');
    insertSetting.run('pricing_radius_km', '15');
    insertSetting.run('pricing_target_margin', '70');
    insertSetting.run('ai_gemini_api_key', '');
    insertSetting.run('ai_provider', 'gemini');
  } catch (err) {
    // Ignore
  }

  // Ensure admin user exists with role admin
  try {
    db.prepare(`UPDATE waiters SET role = 'admin' WHERE pin = '9999'`).run();
  } catch (err) {
    // Ignore
  }

  // Seed default staff details and sample schedule/hours if not populated
  try {
    const staffList = db.prepare('SELECT * FROM waiters').all() as any[];
    for (const s of staffList) {
      if (!s.hourly_rate || s.hourly_rate === 0) {
        let rate = 300;
        let dept = 'service';
        let phone = '0712345678';
        if (s.role === 'admin' || s.role === 'manager') {
          rate = 450;
          dept = 'management';
          phone = '0733112233';
        } else if (s.name.includes('Brian')) {
          rate = 280;
          dept = 'service';
          phone = '0722987654';
        }
        db.prepare(`
          UPDATE waiters 
          SET hourly_rate = ?, department = ?, phone = ?, target_weekly_hours = 40, hire_date = '2024-01-15'
          WHERE id = ?
        `).run(rate, dept, phone, s.id);
      }
    }

    // Add Chef and Bartender if only 3 waiters exist
    if (staffList.length <= 3) {
      const { v4: uuidv4 } = require('uuid');
      const chefId = uuidv4();
      const barId = uuidv4();
      db.prepare(`
        INSERT INTO waiters (id, name, pin, role, department, hourly_rate, target_weekly_hours, phone, email, hire_date, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).run(chefId, 'Juma Barasa (Head Chef)', '2345', 'kitchen', 'kitchen', 400, 42, '0720556677', 'juma@restaurant.ke', '2023-08-01');

      db.prepare(`
        INSERT INTO waiters (id, name, pin, role, department, hourly_rate, target_weekly_hours, phone, email, hire_date, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).run(barId, 'David Kamau (Bartender)', '3456', 'bar', 'bar', 320, 38, '0711443322', 'david@restaurant.ke', '2024-03-10');
    }

    // Seed sample schedule if staff_schedules is empty
    const scheduleCount = (db.prepare('SELECT COUNT(*) as count FROM staff_schedules').get() as any)?.count || 0;
    if (scheduleCount === 0) {
      const { v4: uuidv4 } = require('uuid');
      const allStaff = db.prepare('SELECT id, name, role, department FROM waiters WHERE is_active = 1').all() as any[];
      const today = new Date();
      // Generate schedule for current week days
      for (let offset = -2; offset <= 4; offset++) {
        const d = new Date(today);
        d.setDate(today.getDate() + offset);
        const dateStr = d.toISOString().split('T')[0];

        allStaff.forEach((st, idx) => {
          if ((offset + idx) % 5 !== 0) { // Off day on some days
            const isEvening = (idx + offset) % 2 === 0;
            const startTime = isEvening ? '14:00' : '08:00';
            const endTime = isEvening ? '22:30' : '16:30';
            const station = st.department || 'service';
            db.prepare(`
              INSERT INTO staff_schedules (id, staff_id, shift_date, start_time, end_time, planned_hours, station, status, notes)
              VALUES (?, ?, ?, ?, ?, 8.0, ?, 'scheduled', ?)
            `).run(
              uuidv4(),
              st.id,
              dateStr,
              startTime,
              endTime,
              station,
              isEvening ? 'Abendschicht / Dinner Service' : 'Frühschicht / Prep & Lunch'
            );
          }
        });
      }
    }

    // Seed sample completed time entries if empty
    const timeCount = (db.prepare('SELECT COUNT(*) as count FROM staff_time_entries').get() as any)?.count || 0;
    if (timeCount === 0) {
      const { v4: uuidv4 } = require('uuid');
      const allStaff = db.prepare('SELECT id, hourly_rate FROM waiters WHERE is_active = 1').all() as any[];
      const today = new Date();
      for (let offset = -5; offset <= -1; offset++) {
        const d = new Date(today);
        d.setDate(today.getDate() + offset);
        const dateStr = d.toISOString().split('T')[0];

        allStaff.forEach(st => {
          const rate = st.hourly_rate || 300;
          const clockIn = `${dateStr}T08:00:00`;
          const clockOut = `${dateStr}T16:30:00`;
          const breakMin = 30;
          const totalHours = 8.0;
          const totalWage = totalHours * rate;

          db.prepare(`
            INSERT INTO staff_time_entries (id, staff_id, clock_in, clock_out, break_minutes, total_hours, hourly_rate, total_wage, shift_type, notes, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'regular', 'Reguläre Schicht', 'approved')
          `).run(uuidv4(), st.id, clockIn, clockOut, breakMin, totalHours, rate, totalWage);
        });
      }
    }
  } catch (err) {
    console.warn('Staff seeding note:', err);
  }

  // Seed default display screens for bar digital signage
  try {
    const screenCount = (db.prepare('SELECT COUNT(*) as count FROM display_screens').get() as any)?.count || 0;
    if (screenCount === 0) {
      const insertScreen = db.prepare(`
        INSERT INTO display_screens (id, name, title, subtitle, theme, font_size, layout_type, zones_json, ticker_enabled, ticker_text, ticker_speed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      // Screen 1: Cocktails & Cold Beers (3 Columns)
      const screen1Zones = [
        {
          id: 'zone_cocktails',
          title: 'Signature Cocktails',
          icon: 'cocktail',
          categories: ['cocktails'],
          station: 'bar',
          style: 'classic_list',
          show_images: true,
          show_descriptions: true,
          show_prices: true,
          show_badges: true,
          max_items: 8,
          sort_by: 'highlight_first'
        },
        {
          id: 'zone_beers',
          title: 'Cold Beers & Ciders',
          icon: 'beer',
          categories: ['drinks'],
          station: 'bar',
          style: 'classic_list',
          show_images: true,
          show_descriptions: false,
          show_prices: true,
          show_badges: true,
          max_items: 8,
          sort_by: 'highlight_first'
        },
        {
          id: 'zone_hot',
          title: 'Chai & Specialty Coffee',
          icon: 'coffee',
          categories: ['coffee'],
          station: 'bar',
          style: 'classic_list',
          show_images: true,
          show_descriptions: true,
          show_prices: true,
          show_badges: true,
          max_items: 8,
          sort_by: 'highlight_first'
        }
      ];

      insertScreen.run(
        'screen_bar_1',
        'Bar Screen 1: Cocktails & Cold Beers',
        'SAVANNAH BAR & CRAFT COCKTAILS',
        'Handcrafted Cocktails • Ice-Cold Brews • Nairobi',
        'midnight',
        'large',
        '3_columns',
        JSON.stringify(screen1Zones),
        1,
        '🍹 Happy Hour täglich 17:00–19:00 Uhr: 20% Rabatt auf alle Signature Cocktails! 🍻 Eiskaltes Tusker & White Cap vom Fass 🎵 Live Acoustic Band jeden Freitag ab 19:30 Uhr!',
        'normal'
      );

      // Screen 2: Nyama Choma & Food Specials (Hero Split 38% / 62%)
      const screen2Zones = [
        {
          id: 'zone_specials_hero',
          title: "Chef's Daily Highlight",
          icon: 'star',
          categories: [],
          station: 'all',
          style: 'hero_slider',
          show_images: true,
          show_descriptions: true,
          show_prices: true,
          show_badges: true,
          max_items: 4,
          sort_by: 'highlight_first'
        },
        {
          id: 'zone_mains',
          title: 'Nyama Choma & Grill Mains',
          icon: 'food',
          categories: ['food'],
          station: 'kitchen',
          style: 'classic_list',
          show_images: true,
          show_descriptions: true,
          show_prices: true,
          show_badges: true,
          max_items: 6,
          sort_by: 'highlight_first'
        },
        {
          id: 'zone_bites',
          title: 'Bar Snacks & Tapas',
          icon: 'food',
          categories: ['food'],
          station: 'kitchen',
          style: 'cards',
          show_images: true,
          show_descriptions: false,
          show_prices: true,
          show_badges: true,
          max_items: 6,
          sort_by: 'highlight_first'
        }
      ];

      insertScreen.run(
        'screen_bar_2',
        'Bar Screen 2: Nyama Choma & Food Specials',
        'SAVANNAH GRILL & BAR BITES',
        'Fire-Roasted Nyama • Farm-Fresh Ingredients',
        'amber',
        'large',
        'hero_split',
        JSON.stringify(screen2Zones),
        1,
        '🔥 Frisch gegrilltes Prime Mbuzi Nyama Choma mit Kachumbari-Salat & scharfem Pili-Pili Dip • Karibu Chakula!',
        'normal'
      );

      // Screen 3: Full 4-Panel Drinks Board
      const screen3Zones = [
        {
          id: 'zone_cocktails_full',
          title: 'Cocktails & Dawa',
          icon: 'cocktail',
          categories: ['cocktails'],
          station: 'bar',
          style: 'classic_list',
          show_images: true,
          show_descriptions: false,
          show_prices: true,
          show_badges: true,
          max_items: 10,
          sort_by: 'name_asc'
        },
        {
          id: 'zone_beers_full',
          title: 'Cold Beers & Ciders',
          icon: 'beer',
          categories: ['drinks'],
          station: 'bar',
          style: 'classic_list',
          show_images: true,
          show_descriptions: false,
          show_prices: true,
          show_badges: true,
          max_items: 10,
          sort_by: 'name_asc'
        },
        {
          id: 'zone_coffee_full',
          title: 'Coffee & Teas',
          icon: 'coffee',
          categories: ['coffee'],
          station: 'bar',
          style: 'classic_list',
          show_images: true,
          show_descriptions: false,
          show_prices: true,
          show_badges: true,
          max_items: 10,
          sort_by: 'name_asc'
        },
        {
          id: 'zone_food_full',
          title: 'Bar Bites & Snacks',
          icon: 'food',
          categories: ['food'],
          station: 'kitchen',
          style: 'classic_list',
          show_images: true,
          show_descriptions: false,
          show_prices: true,
          show_badges: true,
          max_items: 10,
          sort_by: 'name_asc'
        }
      ];

      insertScreen.run(
        'screen_bar_3',
        'Bar Screen 3: Full 4-Panel Drinks Board',
        'THE SAVANNAH DRINKS & LOUNGE',
        'Full Spirits, Wines & Cold Brews Menu',
        'slate',
        'normal',
        '4_columns',
        JSON.stringify(screen3Zones),
        1,
        'Karibu The Savannah Lounge • Alle Preise verstehen sich inklusive 16% VAT & 2% Catering Levy • Zahlung bequem bar oder mit M-Pesa',
        'normal'
      );
    }
  } catch (err) {
    console.warn('Display screens seeding note:', err);
  }

  console.log('Database initialized successfully at:', dbPath);
}
