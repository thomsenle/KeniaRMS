# Changelog

All notable changes to the **KeniaRMS** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
