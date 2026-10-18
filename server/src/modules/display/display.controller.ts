import { Request, Response } from 'express';
import { db } from '../../db/index.js';
import { io } from '../../index.js';
import { v4 as uuidv4 } from 'uuid';

interface ScreenZone {
  id: string;
  title: string;
  icon?: string;
  categories: string[];
  station?: 'all' | 'bar' | 'kitchen';
  style: 'classic_list' | 'cards' | 'hero_slider' | 'compact_split';
  show_images: boolean;
  show_descriptions: boolean;
  show_prices: boolean;
  show_badges: boolean;
  max_items: number;
  sort_by: 'highlight_first' | 'price_asc' | 'price_desc' | 'name_asc';
  items?: any[];
}

export class DisplayController {
  // Helper to fetch and verify stock availability for recipes
  private static getAvailableRecipes(): any[] {
    const recipes = db.prepare(`
      SELECT * FROM recipes 
      WHERE is_active = 1 AND display_on_board = 1
      ORDER BY display_highlight DESC, category ASC, name ASC
    `).all() as any[];

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

    return recipes.map(r => ({
      ...r,
      is_in_stock: !outOfStockRecipeIds.has(r.id)
    }));
  }

  // Helper to resolve items for a set of zones
  private static resolveZoneItems(zones: ScreenZone[], allRecipes: any[]): ScreenZone[] {
    return zones.map(zone => {
      let filtered = allRecipes.filter(r => r.is_in_stock);

      // Filter by category if categories are specified
      if (zone.categories && zone.categories.length > 0) {
        filtered = filtered.filter(r => zone.categories.includes(r.category));
      }

      // Filter by station
      if (zone.station && zone.station !== 'all') {
        filtered = filtered.filter(r => r.station === zone.station);
      }

      // Sort
      if (zone.sort_by === 'price_asc') {
        filtered.sort((a, b) => a.price - b.price);
      } else if (zone.sort_by === 'price_desc') {
        filtered.sort((a, b) => b.price - a.price);
      } else if (zone.sort_by === 'name_asc') {
        filtered.sort((a, b) => a.name.localeCompare(b.name));
      } else {
        // highlight_first
        filtered.sort((a, b) => (b.display_highlight || 0) - (a.display_highlight || 0));
      }

      // Max items limit
      const max = zone.max_items > 0 ? zone.max_items : 12;
      const items = filtered.slice(0, max);

      return {
        ...zone,
        items
      };
    });
  }

  // GET /api/display/screens - List all configured display screens
  static getScreens(_req: Request, res: Response) {
    try {
      const rows = db.prepare(`
        SELECT * FROM display_screens 
        ORDER BY created_at ASC
      `).all() as any[];

      const screens = rows.map(r => ({
        ...r,
        zones: JSON.parse(r.zones_json || '[]')
      }));

      res.json({ success: true, screens });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // GET /api/display/screens/:id - Get single screen with resolved zone items
  static getScreenById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const row = db.prepare(`
        SELECT * FROM display_screens WHERE id = ?
      `).get(id) as any;

      if (!row) {
        return res.status(404).json({ success: false, message: 'Display screen not found' });
      }

      const zones: ScreenZone[] = JSON.parse(row.zones_json || '[]');
      const allRecipes = DisplayController.getAvailableRecipes();
      const resolvedZones = DisplayController.resolveZoneItems(zones, allRecipes);

      res.json({
        success: true,
        screen: {
          ...row,
          zones: resolvedZones
        },
        allItems: allRecipes
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // POST /api/display/screens - Create new display screen
  static createScreen(req: Request, res: Response) {
    try {
      const {
        name,
        title,
        subtitle,
        theme = 'midnight',
        font_size = 'large',
        layout_type = '3_columns',
        zones = [],
        ticker_enabled = 1,
        ticker_text = '',
        ticker_speed = 'normal'
      } = req.body;

      const id = 'screen_' + uuidv4().slice(0, 8);

      db.prepare(`
        INSERT INTO display_screens (
          id, name, title, subtitle, theme, font_size, layout_type, zones_json, ticker_enabled, ticker_text, ticker_speed
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        name || 'New Bar Screen',
        title || 'SAVANNAH BAR',
        subtitle || '',
        theme,
        font_size,
        layout_type,
        JSON.stringify(zones),
        ticker_enabled ? 1 : 0,
        ticker_text,
        ticker_speed
      );

      const created = db.prepare('SELECT * FROM display_screens WHERE id = ?').get(id) as any;
      io.emit('display:updated', { screenId: id });

      res.status(201).json({
        success: true,
        screen: {
          ...created,
          zones: JSON.parse(created.zones_json || '[]')
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // PUT /api/display/screens/:id - Update display screen (WYSIWYG save)
  static updateScreen(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const {
        name,
        title,
        subtitle,
        theme,
        font_size,
        layout_type,
        zones,
        ticker_enabled,
        ticker_text,
        ticker_speed
      } = req.body;

      const existing = db.prepare('SELECT * FROM display_screens WHERE id = ?').get(id) as any;
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Screen not found' });
      }

      db.prepare(`
        UPDATE display_screens 
        SET name = COALESCE(?, name),
            title = COALESCE(?, title),
            subtitle = COALESCE(?, subtitle),
            theme = COALESCE(?, theme),
            font_size = COALESCE(?, font_size),
            layout_type = COALESCE(?, layout_type),
            zones_json = COALESCE(?, zones_json),
            ticker_enabled = COALESCE(?, ticker_enabled),
            ticker_text = COALESCE(?, ticker_text),
            ticker_speed = COALESCE(?, ticker_speed),
            updated_at = datetime('now')
        WHERE id = ?
      `).run(
        name,
        title,
        subtitle,
        theme,
        font_size,
        layout_type,
        zones ? JSON.stringify(zones) : null,
        ticker_enabled !== undefined ? (ticker_enabled ? 1 : 0) : null,
        ticker_text,
        ticker_speed,
        id
      );

      const updated = db.prepare('SELECT * FROM display_screens WHERE id = ?').get(id) as any;
      
      // Notify all connected displays & clients
      io.emit('display:updated', { screenId: id });

      res.json({
        success: true,
        screen: {
          ...updated,
          zones: JSON.parse(updated.zones_json || '[]')
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // DELETE /api/display/screens/:id - Delete screen
  static deleteScreen(req: Request, res: Response) {
    try {
      const { id } = req.params;
      db.prepare('DELETE FROM display_screens WHERE id = ?').run(id);
      io.emit('display:updated', { screenId: id });
      res.json({ success: true, message: 'Screen deleted' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // POST /api/display/screens/reset - Reset screens to defaults
  static resetScreens(_req: Request, res: Response) {
    try {
      db.prepare('DELETE FROM display_screens').run();

      const insertScreen = db.prepare(`
        INSERT INTO display_screens (id, name, title, subtitle, theme, font_size, layout_type, zones_json, ticker_enabled, ticker_text, ticker_speed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

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

      io.emit('display:updated', { reset: true });
      res.json({ success: true, message: 'Screens reset to defaults' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // GET /api/display/menu-board - Main menu board view (supports ?screen=screen_id)
  static getMenuBoard(req: Request, res: Response) {
    try {
      const screenId = (req.query.screen as string) || 'screen_bar_1';

      // Try to find the requested screen or fallback to the first active screen
      let screenRow = db.prepare(`SELECT * FROM display_screens WHERE id = ?`).get(screenId) as any;
      if (!screenRow) {
        screenRow = db.prepare(`SELECT * FROM display_screens ORDER BY created_at ASC LIMIT 1`).get() as any;
      }

      // If still no screen in DB, fallback to auto-generated default
      let zones: ScreenZone[] = [];
      if (screenRow) {
        zones = JSON.parse(screenRow.zones_json || '[]');
      } else {
        zones = [
          {
            id: 'z1',
            title: 'Cocktails',
            icon: 'cocktail',
            categories: ['cocktails'],
            style: 'classic_list',
            show_images: true,
            show_descriptions: true,
            show_prices: true,
            show_badges: true,
            max_items: 8,
            sort_by: 'highlight_first'
          },
          {
            id: 'z2',
            title: 'Cold Beers',
            icon: 'beer',
            categories: ['drinks'],
            style: 'classic_list',
            show_images: true,
            show_descriptions: false,
            show_prices: true,
            show_badges: true,
            max_items: 8,
            sort_by: 'highlight_first'
          },
          {
            id: 'z3',
            title: 'Food & Bites',
            icon: 'food',
            categories: ['food'],
            style: 'classic_list',
            show_images: true,
            show_descriptions: true,
            show_prices: true,
            show_badges: true,
            max_items: 8,
            sort_by: 'highlight_first'
          }
        ];
      }

      const allRecipes = DisplayController.getAvailableRecipes();
      const resolvedZones = DisplayController.resolveZoneItems(zones, allRecipes);
      const specials = allRecipes.filter(r => r.display_highlight === 1 && r.is_in_stock);

      // Grouped categories for fallback or filters
      const categories: Record<string, any[]> = {};
      for (const item of allRecipes) {
        if (!categories[item.category]) categories[item.category] = [];
        categories[item.category].push(item);
      }

      // All available screens for quick switcher
      const allScreens = db.prepare('SELECT id, name, title, layout_type, theme FROM display_screens ORDER BY created_at ASC').all() as any[];

      res.json({
        success: true,
        restaurantName: screenRow?.title || 'The Savannah Bistro & Lounge',
        subtitle: screenRow?.subtitle || 'Authentic Kenyan Hospitality • Nairobi',
        currency: 'KES',
        vatRate: '16% Included',
        cateringLevy: '2% Included',
        screen: screenRow ? {
          ...screenRow,
          zones: resolvedZones
        } : {
          id: 'default',
          name: 'Default Screen',
          title: 'The Savannah Bistro & Lounge',
          subtitle: 'Authentic Kenyan Hospitality • Nairobi',
          theme: 'midnight',
          font_size: 'large',
          layout_type: '3_columns',
          zones: resolvedZones,
          ticker_enabled: 1,
          ticker_text: 'Karibu Savannah Lounge • 16% VAT & 2% Catering Levy Included',
          ticker_speed: 'normal'
        },
        screens: allScreens,
        specials,
        categories,
        allItems: allRecipes
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}
