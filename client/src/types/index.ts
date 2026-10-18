export interface Waiter {
  id: string;
  name: string;
  role: 'waiter' | 'manager' | 'admin';
  pin?: string;
  is_active: number;
  created_at?: string;
}

export interface WaiterShift {
  id: string;
  waiter_id: string;
  start_time: string;
  end_time?: string;
  starting_float: number;
  counted_cash?: number;
  calculated_sales_cash: number;
  calculated_sales_card: number;
  calculated_sales_mpesa: number;
  calculated_tips: number;
  notes?: string;
  status: 'open' | 'closed';
  current_cash_sales?: number;
  current_card_sales?: number;
  current_mpesa_sales?: number;
  expected_cash?: number;
  bills_count?: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: 'beverage' | 'ingredient' | 'meat' | 'dairy' | 'produce' | 'dry_goods' | 'consumables';
  unit: string;
  current_stock: number;
  min_stock: number;
  optimal_stock: number;
  cost_per_unit: number;
  supplier?: string;
  last_restocked?: string;
  is_low_stock?: number;
  needed_quantity?: number;
  estimated_cost?: number;
}

export interface RecipeIngredient {
  id?: string;
  recipe_id?: string;
  inventory_item_id: string;
  quantity: number;
  unit: string;
  inventory_name?: string;
  inventory_unit?: string;
  current_stock?: number;
  cost_per_unit?: number;
}

export interface Recipe {
  id: string;
  name: string;
  category: 'food' | 'drinks' | 'dessert' | 'special' | 'cocktails' | 'coffee';
  price: number;
  tax_rate: number;
  catering_levy: number;
  description?: string;
  image_url?: string;
  station: 'kitchen' | 'bar' | 'counter';
  is_active: number;
  display_on_board: number;
  display_highlight: number;
  calculated_cost_kes?: number;
  gross_margin_percent?: number;
  is_available?: boolean;
  ingredients?: RecipeIngredient[];
}

export interface RestaurantArea {
  id: string;
  name: string;
  display_order?: number;
  tables_count?: number;
  created_at?: string;
}

export interface Table {
  id: string;
  table_number: number;
  name: string;
  area: string;
  status: 'free' | 'occupied' | 'bill_requested';
  active_waiter_id?: string;
  active_waiter_name?: string;
  active_order_id?: string;
  order_status?: string;
  order_total_gross?: number;
  guests_count: number;
  is_active?: number;
}

export interface OrderItem {
  id: string;
  order_id: string;
  recipe_id: string;
  recipe_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  status: 'in_cart' | 'sent_to_station' | 'served' | 'paid' | 'cancelled';
  station: 'kitchen' | 'bar';
  notes?: string;
  sent_to_station_at?: string;
  created_at: string;
  recipe_category?: string;
  image_url?: string;
}

export interface Order {
  id: string;
  table_id: string;
  waiter_id: string;
  table_name?: string;
  table_number?: number;
  waiter_name?: string;
  shift_id?: string;
  status: 'open' | 'partially_paid' | 'closed' | 'cancelled';
  total_net: number;
  total_tax: number;
  total_levy: number;
  total_gross: number;
  created_at: string;
  closed_at?: string;
}

export interface PrinterSetting {
  id: string;
  station: 'kitchen' | 'bar' | 'cashier';
  name: string;
  printer_type: 'network_escpos' | 'browser_preview';
  ip_address?: string;
  port: number;
  is_active: number;
}

export interface PrintTicketPayload {
  station: 'kitchen' | 'bar' | 'cashier';
  title: string;
  tableNumber: string | number;
  tableName: string;
  waiterName: string;
  orderNumber?: string;
  timestamp: string;
  items: Array<{
    name: string;
    quantity: number;
    price?: number;
    notes?: string;
  }>;
  subtotal?: number;
  tax16?: number;
  levy2?: number;
  total?: number;
  paymentMethod?: string;
  paidAmount?: number;
  changeAmount?: number;
  tipAmount?: number;
}

export interface MpesaSetting {
  id: string;
  business_type: 'till' | 'paybill';
  shortcode: string;
  till_number: string;
  passkey?: string;
  consumer_key?: string;
  consumer_secret?: string;
  environment: 'sandbox' | 'production';
}

export interface StaffMember {
  id: string;
  name: string;
  pin?: string;
  role: 'waiter' | 'manager' | 'admin' | 'kitchen' | 'bar' | string;
  department?: string;
  hourly_rate: number;
  target_weekly_hours?: number;
  phone?: string;
  email?: string;
  hire_date?: string;
  notes?: string;
  is_active: number;
  activeClockIn?: {
    id: string;
    staff_id: string;
    clock_in: string;
    notes?: string;
  } | null;
}

export interface StaffSchedule {
  id: string;
  staff_id: string;
  staff_name?: string;
  staff_role?: string;
  staff_department?: string;
  hourly_rate?: number;
  shift_date: string;
  start_time: string;
  end_time: string;
  planned_hours: number;
  station: string;
  status: 'scheduled' | 'confirmed' | 'completed' | 'absent' | 'sick' | 'holiday';
  notes?: string;
}

export interface StaffTimeEntry {
  id: string;
  staff_id: string;
  staff_name?: string;
  staff_role?: string;
  staff_department?: string;
  clock_in: string;
  clock_out?: string;
  break_minutes: number;
  total_hours: number;
  hourly_rate: number;
  total_wage: number;
  shift_type: string;
  notes?: string;
  status: string;
}

export interface StaffHoursSummary {
  id: string;
  name: string;
  role: string;
  department: string;
  hourly_rate: number;
  target_weekly_hours: number;
  phone?: string;
  is_active: number;
  actual_hours: number;
  planned_hours: number;
  diff_hours: number;
  total_wage: number;
  shift_count: number;
  scheduled_shift_count: number;
}

export type DisplayTheme = 'midnight' | 'slate' | 'emerald' | 'amber' | 'neon';
export type DisplayFontSize = 'normal' | 'large' | 'xlarge';
export type DisplayLayoutType = '1_column' | '2_columns' | '3_columns' | '4_columns' | 'hero_split';
export type DisplayZoneStyle = 'classic_list' | 'cards' | 'hero_slider' | 'compact_split';

export interface DisplayZone {
  id: string;
  title: string;
  icon?: string;
  categories: string[];
  station?: 'all' | 'bar' | 'kitchen';
  style: DisplayZoneStyle;
  show_images: boolean;
  show_descriptions: boolean;
  show_prices: boolean;
  show_badges: boolean;
  max_items: number;
  sort_by: 'highlight_first' | 'price_asc' | 'price_desc' | 'name_asc';
  items?: Recipe[];
}

export interface DisplayScreen {
  id: string;
  name: string;
  title: string;
  subtitle?: string;
  theme: DisplayTheme;
  font_size: DisplayFontSize;
  layout_type: DisplayLayoutType;
  zones: DisplayZone[];
  ticker_enabled: boolean | number;
  ticker_text?: string;
  ticker_speed?: 'slow' | 'normal' | 'fast';
  is_active?: number;
  created_at?: string;
  updated_at?: string;
}

export interface AiMarketBenchmark {
  location: string;
  radius_km: number;
  min_price: number;
  avg_price: number;
  max_price: number;
  food_cost_kes: number;
  gross_margin_percent: number;
  rationale: string;
}

export interface AiGeneratedIngredient {
  name: string;
  category: 'meat' | 'ingredient' | 'dairy' | 'produce' | 'dry_goods' | 'beverage' | 'consumables';
  quantity: number;
  unit: string;
  cost_per_unit: number;
  portion_cost_kes: number;
  min_stock?: number;
  optimal_stock?: number;
  initial_stock?: number;
  supplier?: string;
}

export interface AiGeneratedDish {
  name: string;
  category: 'food' | 'drinks' | 'dessert' | 'special' | 'cocktails' | 'coffee';
  station: 'kitchen' | 'bar' | 'counter';
  description: string;
  suggested_price: number;
  tax_rate: number;
  catering_levy: number;
  display_on_board: number;
  display_highlight: number;
  market_benchmark: AiMarketBenchmark;
  ingredients: AiGeneratedIngredient[];
}

export interface AppSettings {
  pricing_location: string;
  pricing_radius_km: number;
  pricing_target_margin: number;
  has_gemini_key: boolean;
  gemini_key_masked?: string;
  ai_provider: string;
}

