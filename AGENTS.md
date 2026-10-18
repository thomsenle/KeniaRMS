# KeniaRMS - Agent Guidelines & System Architecture

Welcome to **KeniaRMS**, a modular, multi-client Restaurant Management & POS System tailored for the hospitality industry in **Kenya** (multi-currency capable, native KES support, 16% VAT, 2% Catering Levy).

This document serves as the single source of truth for AI agents and developers working on this codebase.

---

## 1. Project Overview & Core Mission

KeniaRMS is designed to run reliably on local restaurant hardware (e.g., Mini-PC or Raspberry Pi via **Docker**) to ensure zero downtime during internet outages, while providing an app-like PWA experience on smartphones, tablets, touch terminals, and advertising screens.

### Core Modules
1. **Lagerverwaltung (Inventory Module):**
   - Tracks drinks, ingredients, and consumables.
   - Dynamic unit conversions (e.g. bottle 0.75l to 2cl / 4cl shots, kg to grams).
   - Real-time minimum stock alert system.
   - Automatic daily shopping list (Einkaufszettel) generation for items at or below minimum threshold.
2. **Rezeptdatenbank (Recipe & Menu Module):**
   - Dishes, drinks, and combos with photos, descriptions, allergens, and cost calculations.
   - Exact mapping of recipes to stock ingredients for automatic inventory consumption.
3. **Kellner-Bestell- & Abrechnungsmodul (POS & Waiter Service):**
   - Interactive table map (rooms, outdoor/terrace, status indicators).
   - Table opening, closing, transfer, and flexible **bill splitting**.
   - **Duale Haupt-Zahlungsarten (Bar & M-Pesa):**
     - **Barzahlung (Cash):** Schnelle Erfassung von gegebenem Betrag (*Gegeben*), automatische Rückgeld-Berechnung (*Change*) und Trinkgeld-Trennung.
     - **M-Pesa (Safaricom Kenya):** Vollwertige, integrierte Mobilfunk-Zahlung direkt am Gast-Tisch:
       - *Lipa na M-Pesa Online (STK Push):* USSD-PIN-Aufforderung wird direkt an das Smartphone des Gastes gesendet (`07...` / `254...`). Gast autorisiert Zahlung per M-Pesa PIN.
       - *Buy Goods Till / Paybill:* Manuelle Eingabe des M-Pesa SMS-Codes (z.B. `QJD782JK10`) bei Zahlung über Restaurant-Till-Nummer.
       - *Split-Bill fähig:* Beliebige Kombinationen aus Barzahlung, M-Pesa und Karte auf demselben Tisch möglich.
   - **Kellner-Geldbeutel & Abrechnung (Waiter Wallet Management):**
     - Eingabe des Schicht-Grundstocks (*Starting Cash Float*).
     - Saubere Trennung von Bargeld-Bestand und bargeldlosen M-Pesa-Umsätzen.
     - Schichtabschluss (*Kassensturz*) mit Cent-genauer Abrechnung von Soll-Bargeld, Ist-Bargeld, Differenz und erarbeitetem Trinkgeld (*Tip*).
4. **Display-Modul (Digital Signage):**
   - Fullscreen digital menu board and advertising view (`/display/:screenId`) for TVs/monitors.
   - Pulls active dishes, photos, and daily specials dynamically from the recipe database.
   - Automatically hides items when critical ingredients are out of stock.
5. **Universal Printer Module (ESC/POS):**
   - Universal network printing over TCP/IP (Port 9100) directly from backend to receipt printers.
   - Smart routing: Drinks $\rightarrow$ Bar printer, Food $\rightarrow$ Kitchen printer, Invoices $\rightarrow$ Guest receipt printer.
   - In-browser print fallback / preview.
6. **Tages- & Monatsabschluss (Closing, Reports, Printer & PDF):**
   - **Tagesabschluss (Z-Bon):**
     - **Drucker-Anbindung:** Kann direkt über den Kassen-Bondrucker (ESC/POS Port 9100 / Web-Druck) gedruckt werden.
     - **PDF-Generierung & Versand:** Kann direkt als PDF exportiert, gespeichert oder an die Geschäftsleitung / Buchhaltung versendet werden.
     - Revisionssichere Archivierung im System mit Steuerausweis (16% VAT, 2% Catering Levy).
   - **Monatsabschluss:**
     - Taggenaue Monatsauswertung (Umsätze, Steuern, Kellner-Umsätze, Bar, M-Pesa, Karte).
     - CSV- und PDF-Export.
7. **Administrator- & Konfigurationsmodul (Admin Only / Rollenmodell):**
   - Geschützter Verwaltungsbereich, der **ausschließlich für Administratoren (`admin`)** zugänglich ist (über Rollenprüfung und Admin-PIN-Sperre).
   - Zentrale Steuerung aller kritischen Hardware- und Schnittstellenparameter:
     - **M-Pesa Safaricom Daraja API:** Shortcode, Till-Nummer, Passkey, Consumer Key/Secret, Sandbox/Production, Webhook URL.
     - **Bondrucker-Netzwerk:** IP-Adressen, TCP/IP Ports (9100), Stationen (Küche, Bar, Kasse) und Testdruck.
     - **Mitarbeiter- & Rollenverwaltung:** Anlegen von Kellnern (`waiter`), Schichtleitern (`manager`) und Administratoren (`admin`) inklusive PIN-Vergabe.
     - **Finanzparameter:** 16% VAT, 2% Tourism/Catering Levy, Währung KES.
8. **Personalplanung, Dienstplan & Zeiterfassung (Staff Scheduling & Hours Module):**
   - **Personalverwaltung & Mitarbeiter-Stammdaten:**
     - Umfassendes Mitarbeiterprofil: Name, Rolle (`waiter`, `kitchen`, `bar`, `manager`, `admin`), Abteilung, Safaricom-Telefonnummer (`07...`), E-Mail, Einstellungsdatum, Wochen-Sollstunden und individueller Stundenlohn in KES.
   - **Dienstplan & Schichtplanung (Roster):**
     - Interaktiver Wochenkalender (Mo–So) mit Vor- und Zurückblättern zwischen den Kalenderwochen.
     - Stationsgenaue Schichteinteilung (Küche, Bar, Service/Terrasse, Kasse, Schichtleitung, Reinigung) mit Status (Geplant, Bestätigt, Abgeschlossen, Krank, Urlaub).
   - **Zeiterfassung & Stundenübersicht (Time Tracking & Payroll Analytics):**
     - Live-Stempeluhr (Clock-In / Clock-Out) für jedes Teammitglied.
     - Automatische Übernahme und Synchronisation aus abgeschlossenen Kellner-Schichten (`waiter_shifts`).
     - Cent-genaue Stunden- und Lohnabrechnung in KES (Ist-Stunden × Stundenlohn) mit Ausweisung von Überstunden, Pausenabzug und Schichtzähler.
     - Filterbar nach Zeiträumen (Diese Woche, Letzte Woche, Dieser Monat, Letzter Monat) mit integrierter Druck- und PDF-Export-Funktion für die Lohnabrechnung.

---

## 2. Fundamental Business Rules (CRITICAL)

Agents working on KeniaRMS must strictly adhere to the following business rules:

1. **Lagerbuchung (Inventory Deduction Trigger):**
   > [!IMPORTANT]
   > Adding an item to the table's cart does **NOT** decrement inventory.
   > Inventory deduction **MUST ONLY OCCUR** when the waiter clicks **"Send to Bar/Kitchen"** (*An Bar/Küche senden*).
   > At that exact moment:
   > - The order items are marked as dispatched.
   > - Recipe ingredients are atomically deducted from current stock in the database.
   > - Print tickets are emitted to the respective bar/kitchen printers.

2. **Duale Zahlungsarten im Bestell-/Bezahlmodul (Barzahlung & M-Pesa):**
   > [!IMPORTANT]
   > M-Pesa ist in Kenia der dominierende Zahlungsstandard und muss im Bestell- und Bezahlmodul gleichberechtigt neben Barzahlung zur Verfügung stehen:
   > - **Barzahlung (Cash):** Berechnung von gegebenem Geld, exaktem Rückgeld und Trinkgeld (*Tip*).
   > - **M-Pesa STK Push:** Direkte Aufforderung auf das Handy des Gastes via Daraja API (Gast gibt PIN auf seinem Smartphone ein).
   > - **M-Pesa Till / Paybill:** Manuelle Erfassung des SMS-Transaktionscodes (z.B. `QJD782JK10`).
   > - **Tisch-Splitten:** Beliebige Kombination aus Bar, M-Pesa und Karte auf demselben Tisch.
   > - **Buchhalterische Trennung:** Bargeldbestand im Kellnerportemonnaie (*Grundstock* + Bareinnahmen) wird beim Kassensturz und Z-Bon strikt von M-Pesa-Zahlungen getrennt.

3. **Rollenbasiertes Berechtigungsmodell (RBAC) & Administrator-Schutz:**
   > [!IMPORTANT]
   > Die Anwendung unterscheidet strikt zwischen Mitarbeiter-Rollen:
   > - `waiter` (Kellner): Zugriff auf Tische, Bestellungen, Küchen-/Bar-Bons, Schicht-Grundstock, Abrechnung (Bar/M-Pesa) und Kellner-Kassensturz. Kein Zugriff auf das Konfigurationsmodul, keine Einsicht in sensible API-Keys.
   > - `manager` (Schichtleiter): Zusätzlicher Zugriff auf Lagerverwaltung, Rezeptpreise, Einkaufszettel und Tages-/Monatsabschluss.
   > - `admin` (Administrator): Exklusiver Vollzugriff auf das **Konfigurationsmodul** (Drucker-IPs, M-Pesa-Zugangsdaten, Mitarbeiter-PINs, Steuern). Standardkellner sehen diesen Bereich nicht bzw. werden durch einen Admin-PIN-Dialog gesperrt.

4. **Tagesabschluss (Z-Bon): Drucker-Ausgabe & PDF-Export/Versand:**
   > [!IMPORTANT]
   > Beim Tagesabschluss (Z-Bon) muss das Dokument zwingend:
   > 1. **Über den Bondrucker gedruckt werden können** (ESC/POS Port 9100 oder Web-Bondruck-Vorschau).
   > 2. **Als PDF generiert, heruntergeladen oder per E-Mail versendet werden können** (inkl. Ausweisung aller Kenia-Steuern: 16% VAT, 2% Catering Levy sowie Trennung von Bar-, M-Pesa- und Karteneinnahmen).

5. **Kenyan Financial Defaults:**
   - Primary Currency: **KES** (Kenyan Shillings, e.g. `KES 1,250.00`).
   - Default VAT Rate: **16%** (standard VAT in Kenya).
   - Default Tourism / Catering Levy: **2%** (where applicable, configurable).
   - All monetary calculations must use rounded integer cents or two-decimal fixed precision to prevent floating-point discrepancies.

6. **Flexible Deployment (Local On-Premise OR Cloud/Internet Server via Docker):**
   - The backend container is designed to run **either** locally in the restaurant network (e.g. Raspberry Pi / Mini-PC) **OR** on a remote Internet Cloud Server (VPS / Docker hosting).
   - **Universal Printing across Internet & Local:**
     - *Local Mode:* Server can connect directly via TCP/IP socket (`net.Socket`) to ESC/POS printers on the local subnet (e.g. `192.168.1.200:9100`).
     - *Cloud / Internet Mode:* Because cloud servers cannot directly access private LAN IPs, the server broadcasts print jobs via WebSockets (`socket.io`) and maintains an active print queue. Any client device (waiter smartphone, tablet, or POS terminal) inside the restaurant receives the ticket in real time and executes printing via Browser Print, WebPrint, or local printer bridge.

7. **Strict i18n Internationalization (MANDATORY - NO HARDCODED STRINGS):**
   > [!IMPORTANT]
   > **NO hardcoded user-facing strings are permitted in the source code (.tsx, .ts, .jsx)!**
   > All UI labels, button texts, table headers, toasts, modal titles, error messages, and placeholders MUST be defined in dedicated locale dictionary files:
   > - `client/src/i18n/locales/de.json` (German)
   > - `client/src/i18n/locales/en.json` (English - Official Kenyan Business)
   > - `client/src/i18n/locales/sw.json` (Kiswahili - Kenyan National)
   > All UI components must use `const { t } = useTranslation();` and translate via keys: `{t('pos.send_to_kitchen')}`, `{t('inventory.shopping_list')}`, etc.

---

## 3. Technology Stack

### Backend (`/server`)
- **Runtime:** Node.js 22+ with TypeScript.
- **Server Framework:** Express with modular routers.
- **Database:** SQLite (`better-sqlite3`) in WAL mode (`PRAGMA journal_mode = WAL;`) for maximum local performance, ACID compliance, and zero maintenance.
- **Real-Time:** `socket.io` for bi-directional live sync.
- **Printing:** Raw ESC/POS byte generator over raw TCP sockets (`net.Socket`) to target printer IP:9100.
- **Containerization:** `Dockerfile` and `docker-compose.yml`.

### Frontend (`/client`)
- **Framework:** React 18/19 with TypeScript & Vite.
- **Styling:** Modern, touch-first responsive design (warm hospitality palette, dark mode, high contrast, glassmorphism, fluid micro-interactions).
- **Icons:** `lucide-react`.
- **Target Devices:** Smartphones (Waiters), Tablets/iPads (Waiters & Bar), Touch Terminals (Stationary Cashier), HDMI TV screens (Digital Signage).

---

## 4. Repository & Directory Structure

```text
KeniaRMS/
├── AGENTS.md                  # This specification document
├── docker-compose.yml         # Container orchestration for local deployment
├── server/                    # Node.js TypeScript Backend
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── data/                  # SQLite database file (mounted volume in Docker)
│   ├── uploads/               # Uploaded dish/drink photos
│   └── src/
│       ├── config/            # Tax rates, currency, port configuration
│       ├── db/                # SQLite connection, schema, migrations, seed data
│       ├── modules/
│       │   ├── inventory/     # Ingredients, stock levels, min-thresholds, shopping list
│       │   ├── recipes/       # Dishes, ingredients mapping, allergens, costs
│       │   ├── pos/           # Tables, orders, dispatch to kitchen/bar, dual settlement (Cash & M-Pesa)
│       │   ├── mpesa/         # Safaricom Daraja STK Push, callbacks, Till verification, settings
│       │   ├── waiters/       # Waiter accounts, roles (waiter/manager/admin), shift float, tips
│       │   ├── printers/      # ESC/POS universal driver, network socket dispatcher
│       │   ├── closing/       # Z-Report daily/monthly closing, tax breakdowns
│       │   ├── display/       # Signage API & live broadcast for TV menu boards
│       │   └── staff/         # Staff roster, employee profiles, time tracking, hours analytics
│       ├── sockets/           # WebSocket event handlers
│       └── index.ts           # Server entry point
└── client/                    # React Vite Frontend
    ├── Dockerfile
    ├── package.json
    ├── vite.config.ts
    ├── index.html
    └── src/
        ├── api/               # API client & WebSocket listener
        ├── components/        # Reusable UI components (Modals, Tables, Badge, Inputs, PIN Login)
        ├── context/           # Global state (Active Waiter, Tables, Cart, Alerts)
        ├── pages/
        │   ├── POSPage.tsx        # Waiter view: Tables, Order taking, Dual payment (Cash / M-Pesa)
        │   ├── InventoryPage.tsx  # Stock list, Quick adjustment, Shopping list generator
        │   ├── RecipesPage.tsx    # Recipe catalog, Photo upload, Ingredient linker
        │   ├── ShiftPage.tsx      # Waiter cash float, Kassensturz, Tip summary
        │   ├── ClosingPage.tsx    # Daily Z-Report & Monthly closing
        │   ├── StaffPage.tsx      # Staff scheduling (Roster), Hours tracking & HR directory
        │   ├── DisplayPage.tsx    # Fullscreen TV menu board / rotating ads
        │   └── SettingsPage.tsx   # Admin Configuration: Printers, M-Pesa Daraja, Staff PINs (RBAC Protected)
        └── styles/            # Design system, CSS variables, touch UI utilities
```

---

## 5. Development & Deployment Commands

### Local Development
```powershell
# In /server:
npm install
npm run dev

# In /client:
npm install
npm run dev
```

### Docker Deployment
```bash
docker compose up -d --build
```

---

## 6. Extending KeniaRMS (Adding New Modules)

To add a future module (e.g. KRA eTIMS Tax Fiscalization, Table Reservations, Guest Loyalty Points):
1. Create a new directory in `server/src/modules/<new-module>`.
2. Define SQLite tables in `server/src/db/schema.ts` (or `server/src/db/index.ts`).
3. Provide REST routes and WebSocket broadcast events.
4. Add the corresponding navigation tab and view in `client/src/pages/`.
5. Register role-based permissions in `waiter.role` (`waiter` vs `manager` vs `admin`).
