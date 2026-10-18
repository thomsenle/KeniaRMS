# KeniaRMS 🍽️🇰🇪

[![Version](https://img.shields.io/badge/version-1.1.0-amber.svg)](https://github.com/thomsenle/KeniaRMS)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Currency](https://img.shields.io/badge/Currency-KES%20(Kenyan%20Shilling)-emerald.svg)]()
[![VAT Rate](https://img.shields.io/badge/Kenya%20VAT-16%25-orange.svg)]()
[![Catering Levy](https://img.shields.io/badge/Catering%20Levy-2%25-indigo.svg)]()
[![Payments](https://img.shields.io/badge/M--Pesa-Safaricom%20Daraja%20API-34d399.svg)]()

> **KeniaRMS** is an all-in-one Restaurant Management & POS System specifically tailored for the hospitality industry in **Kenya**. Built to run reliably on local hardware (Mini-PC or Raspberry Pi via Docker) with zero internet downtime dependencies, or scalable to remote Cloud Servers.

---

## 🌟 Key Highlights & Kenyan Standards

- 🇰🇪 **Kenyan Financial Engine:** Native **KES** currency support, **16% VAT** and **2% Catering / Tourism Levy** calculation.
- 📱 **Dual Payment System (Cash & M-Pesa):**
  - **Cash:** Tendered amount tracking, exact change calculation, and tip separation.
  - **Safaricom Daraja M-Pesa API:**
    - *Lipa na M-Pesa Online (STK Push):* Sends USSD PIN prompt directly to customer's phone (`07...` / `254...`).
    - *Buy Goods Till / Paybill:* Manual SMS transaction code verification (e.g. `QJD782JK10`).
    - *Split Bill:* Arbitrary combinations of Cash, Card, and M-Pesa on the same table.
- 📦 **Smart Inventory Trigger:** Adding items to cart does **not** deduct stock. Inventory is atomically deducted **only** when items are dispatched to the kitchen/bar.
- 🖨️ **Universal ESC/POS Printing:** Network printing over TCP/IP (Port 9100) with automatic routing (Kitchen $\rightarrow$ Food, Bar $\rightarrow$ Drinks, Cashier $\rightarrow$ Invoices). In-browser print fallback / preview included.
- 📊 **Z-Report Daily Closing:** Printable on ESC/POS thermal receipt printers and exportable/sendable as compliant PDF with tax breakdowns.
- 👥 **Personalplanung & Zeiterfassung (Staff Scheduling & Hours):**
  - Interactive 7-day staff roster (Mo–So) by station (Kitchen, Bar, Service, Cashier).
  - Time tracking with live Clock-In / Clock-Out, overtime analytics, and payroll estimation in KES (`Hourly Rate × Actual Hours`).
- 📺 **Digital Signage (Display Module):** Fullscreen rotating menu board (`/display/:screenId`) for TVs, auto-hiding dishes when ingredients are out of stock.
- 🔒 **Role-Based Access Control (RBAC):** Strict separation between `waiter`, `kitchen`, `bar`, `manager`, and `admin` with PIN gates.
- 🌐 **Strict i18n Internationalization:** Multi-language support with zero hardcoded UI strings:
  - 🇩🇪 German (`de`)
  - 🇬🇧 English (`en`)
  - 🇰🇪 Kiswahili (`sw`)

---

## 🏗️ System Architecture

```text
KeniaRMS/
├── AGENTS.md                  # System architecture & core business rules
├── CHANGELOG.md               # Version history & releases
├── docker-compose.yml         # Container orchestration
├── server/                    # Node.js TypeScript Backend
│   ├── src/
│   │   ├── config/            # Tax rates, currency, port configuration
│   │   ├── db/                # SQLite connection (WAL mode), migrations, seed data
│   │   ├── modules/
│   │   │   ├── inventory/     # Stock items, unit conversions, shopping list
│   │   │   ├── recipes/       # Dishes, ingredients mapping, margins, allergens
│   │   │   ├── pos/           # Tables, carts, dispatch, dual settlement (Cash & M-Pesa)
│   │   │   ├── mpesa/         # Safaricom Daraja STK Push, callbacks, Till verification
│   │   │   ├── waiters/       # Float management, waiter wallet, tip audit
│   │   │   ├── staff/         # Staff roster, time tracking, hours & payroll analytics
│   │   │   ├── printers/      # ESC/POS universal driver, network dispatcher
│   │   │   ├── closing/       # Z-Report daily & monthly closing, PDF export
│   │   │   └── display/       # Signage API & live TV menu board sync
│   │   ├── sockets/           # Bi-directional live sync with socket.io
│   │   └── index.ts           # Server entry point
└── client/                    # React Vite Frontend (PWA ready)
    └── src/
        ├── api/               # API client & WebSocket listener
        ├── components/        # Reusable touch UI components & modals
        ├── i18n/              # Dedicated JSON dictionaries (de, en, sw)
        ├── pages/             # POSPage, InventoryPage, RecipesPage, ShiftPage,
        │                      # ClosingPage, StaffPage, DisplayPage, SettingsPage
        └── styles/            # Design system, touch controls, dark mode
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js 20+
- npm or yarn

### 1. Install & Run Backend
```bash
cd server
npm install
npm run dev
```
Backend runs on **http://localhost:5000** (SQLite database created automatically with seed data).

### 2. Install & Run Frontend
```bash
cd client
npm install
npm run dev
```
Frontend runs on **http://localhost:3000**.

---

## 🐳 Docker Deployment (Production)

Deploy on local restaurant hardware (Mini-PC / Raspberry Pi) or a remote Internet VPS:

```bash
docker compose up -d --build
```

- Web POS & App: `http://<server-ip>:3000`
- API & Socket Server: `http://<server-ip>:5000`
- TV Digital Signage: `http://<server-ip>:3000/display/1`

---

## 🔐 Demo Credentials (PIN Login)

| Role | Name | Demo PIN | Permissions |
|---|---|---|---|
| **Admin** | Grace Mwangi | `9999` | Full access (Printers, M-Pesa keys, Staff PINs, Tax settings) |
| **Manager** | Grace Mwangi | `9999` | Inventory, Recipes, Closings, Staff Roster & Hours |
| **Waiter** | Amina Odhiambo | `1234` | Tables, Orders, Dual Payments (Cash / M-Pesa), Shift Float |
| **Waiter** | Brian Kiprono | `5678` | Tables, Orders, Dual Payments (Cash / M-Pesa), Shift Float |
| **Head Chef** | Juma Barasa | `2345` | Kitchen Display, Time Clock |
| **Bartender** | David Kamau | `3456` | Bar Display, Time Clock |

---

## 📜 Versioning & Releases

KeniaRMS adheres to [Semantic Versioning (SemVer)](https://semver.org/):
- `MAJOR` version: Incompatible API or business logic changes.
- `MINOR` version: Backwards-compatible functionality additions (e.g. new modules).
- `PATCH` version: Backwards-compatible bug fixes.

See [CHANGELOG.md](CHANGELOG.md) for full release history.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
