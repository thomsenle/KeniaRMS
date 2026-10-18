# Changelog

All notable changes to the **KeniaRMS** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] - 2026-10-18

### Minor Release: Table & Area Management, AI Recipe Benchmarking & WYSIWYG Digital Signage Studio

#### Added
- **Tisch- & Bereichsverwaltung (Table & Dining Area Management):**
  - Dynamic restaurant areas (`restaurant_areas`) with custom names, sort order, and active status toggling.
  - Interactive table management modal for creating, editing, renaming, capacity configuration, and area assignments.
  - Non-destructive soft-delete (`is_active = 0`) ensuring complete historical integrity of past orders, receipts, and Z-reports.
  - Real-time POS table grid integration with dynamic area tabs and instant WebSocket updates.

- **KI-Rezeptassistent & Regionale Preisbildung (AI Recipe Assistant & Regional Market Benchmarking):**
  - Generative AI recipe & cocktail creator supporting natural language prompts with fallback to local Kenyan Coast culinary knowledge base.
  - Regional competitor price benchmarking centered on configurable reference location (default: Diani Beach) and radius.
  - Food cost calculation in KES, target gross margin percentage, and competitor price bracket comparison (Budget, Average, Beachfront).
  - Automated inventory ingestion: missing ingredients are automatically added to `inventory_items` and mapped to recipes upon import.

- **WYSIWYG Bar-Display & Digital Signage Studio:**
  - Visual 16:9 Live Canvas Signage Studio for configuring restaurant and bar digital menu boards (`display_screens`).
  - Flexible layout engine: 1, 2, 3, 4 columns, Hero Promo Split, and curated color themes (Midnight, Slate, Emerald Lounge, Sunset Amber, High-Contrast Neon).
  - High-legibility typography scaling (Normal, Large, Extra Large) optimized for 55" to 65"+ bar TV screens.
  - Classic bar chalkboard layout with dotted price leader lines, image card grid, and promo sliders.
  - Configurable bottom marquee ticker banner for venue events and Happy Hour specials.
  - Multi-screen display capability (`/display` or `?mode=display&screen=:screenId`).

- **Settings & User Experience Enhancements:**
  - New Admin & Manager settings sections for "KI & Standortpreise" and "Tisch- & Bereichsverwaltung".
  - Auto-submit 4-digit PIN authentication in touch keypad modal for rapid waiter and manager switching.
  - 100% strict i18n localization in German, English, and Kiswahili across all new views and modals.

---

## [1.0.0] - 2026-10-18

### Initial Release: Full Production Restaurant POS & ERP System for Kenya

#### Added
- **Core Architecture:**
  - Modern TypeScript monorepo with Express backend (`better-sqlite3` in WAL mode) and React Vite touch-first frontend.
  - Multi-platform deployment: On-premise local server (Raspberry Pi / Mini-PC) or Cloud VPS via Docker containerization.
  - Strict i18n Internationalization (German, English, Kiswahili) without hardcoded strings in application code.

- **Dual Payment Module (Cash & Safaricom M-Pesa):**
  - Cash payment with tendered cash input, change calculation, and tip recording.
  - Full Safaricom Daraja M-Pesa API integration:
    - Lipa na M-Pesa Online (STK Push) prompt directly to guest smartphone (`07...` / `254...`).
    - Buy Goods Till / Paybill manual verification with customer SMS receipt codes.
    - Automatic WebSocket synchronization and receipt printing on payment authorization.
    - Flexible split-bill settlement: arbitrary combinations of cash, card, and M-Pesa on the same table.

- **POS & Waiter Service Module:**
  - Interactive table map with live occupancy indicators (Restaurant, Garden/Terrace, Bar, VIP).
  - Mobile waiter handheld terminal with PWA standalone mode and touch-first layout.
  - Waiter shift management: starting cash float, strict separation of cash and cashless M-Pesa sales, and shift balance (*Kassensturz*).

- **Inventory Module & Business Logic (CRITICAL):**
  - Atomic inventory deduction triggered exclusively when the waiter clicks "Send to Bar/Kitchen".
  - Drink and recipe ingredient consumption tracking with unit conversions.
  - Minimum stock threshold warnings and automatic daily shopping list generator (*Einkaufszettel*) with cost estimation.

- **Universal Printer Module (ESC/POS):**
  - Smart print job routing: Drink tickets $\rightarrow$ Bar printer, Food orders $\rightarrow$ Kitchen printer, Tax invoices $\rightarrow$ Cashier receipt printer.
  - Dual print mode: Direct network TCP/IP socket printing (Port 9100) for local LAN and browser preview / WebPrint queue for remote cloud setups.

- **Daily & Monthly Closing (Z-Report):**
  - Compliant Kenyan fiscal reporting with 16% VAT and 2% Catering Tourism Levy tax breakdowns.
  - Direct ESC/POS thermal receipt printing and clean CSS `@media print` PDF export and email archiving.

- **Staff Scheduling, Hours Tracking & HR Module:**
  - Staff directory with employee profiles, Kenyan phone numbers, hourly rates in KES, and weekly target hours.
  - Interactive 7-day shift roster (Mo–So) with station assignment (Kitchen, Bar, Service, Cashier, Cleaning, Management).
  - Time tracking with live Clock-In / Clock-Out punch clock, overtime calculation, and automatic POS shift synchronization.

- **Digital Signage (Display Module):**
  - Fullscreen TV digital menu board (`/display/:screenId`) with dynamic rotation, dish photos, prices, and automated out-of-stock hiding.

- **Security & Role-Based Access Control (RBAC):**
  - Role separation: `waiter`, `kitchen`, `bar`, `manager`, `admin`.
  - Admin configuration area protected by role checks and 4-digit PIN verification.
