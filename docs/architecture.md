# BA Financial Planning - Architecture Overview

**Version:** 7.0 ("Stay HGV" Scenario)
**Date:** November 22, 2025
**Status:** Phase 1 (Data Layer & Scaffold)

---

## 1. High-Level Design Pattern
The application follows a **Data-Driven Single Page Application (SPA)** architecture. It enforces a strict separation of concerns between the **Data State** (Truth), the **Calculation Engine** (Logic), and the **User Interface** (Presentation).

### Core Philosophy
1.  **Single Source of Truth:** The entire financial model is defined by a single JSON object (`hgv_data.json`).
2.  **Deterministic Calculation:** Given the same Input JSON, the Logic Engine will always produce the exact same Output (Cash Flow & Net Worth arrays).
3.  **Snapshot-Based History:** "What-if" scenarios are handled by deep-cloning the state and saving it to an internal history array, allowing for instant time-travel and comparison.

---

## 2. Technology Stack

### Frontend Framework
* **Core:** React 19 (Functional Components, Hooks).
* **Build Tool:** Vite 5 (Fast HMR, ES Modules).
* **Language:** JavaScript (ES6+).

### Styling & UI
* **CSS Framework:** Tailwind CSS 3 (Utility-first, Responsive).
* **Icons:** Lucide-React (Lightweight SVG icons).
* **Visualization:** Recharts (Composed Charts for projections).

### Data & Logic Libraries
* **State Management:** React Context API (`DataContext`).
* **Data Manipulation:** `lodash` (specifically `cloneDeep` for immutability and `set` for deep path updates).
* **Date Handling:** `date-fns` (for timeline generation).
* **Math:** Native JS (floating point handling managed via specific rounding utilities).

---

## 3. Data Architecture

### 3.1 The Data Context (`src/context/DataContext.jsx`)
The application is wrapped in a global `DataProvider` that exposes:
* `data`: The current active JSON configuration.
* `updateData(path, value)`: A universal setter that accepts a dot-notation path (e.g., `'income.brian.netSalary'`) and updates the state immutably.
* `saveSnapshot(name)`: Pushes the current state into a `history` array.
* `loadSnapshot(id)`: Replaces the current state with a saved version.

### 3.2 The Data Model (`hgv_data.json`)
The schema is divided into specific domains:
* **`meta`**: Versioning and scenario tags.
* **`globals`**: Economic drivers (Inflation, Market Returns, Tax Tiers).
* **`demographics`**: Birthdates, Social Security timing.
* **`income`**: Salary baselines, growth settings, work status sliders.
* **`expenses`**: Monthly burn rate and annual lumpy expenses.
* **`assets`**: Starting balances and allocation strategies.
* **`loans`**: Mortgage and HELOC terms.

---

## 4. The Logic Engine (Planned: `src/utils/financial_engine.js`)

To keep components pure, all financial math is offloaded to a utility engine. This engine runs on every significant data change.

### 4.1 Calculation Pipeline
1.  **Timeline Generator:** Creates an array of 360+ months (30 years) starting from `globals.startDate`.
2.  **Amortization Module:** Calculates monthly Principal, Interest, and Remaining Balance for Mortgage and HELOC.
3.  **Income & Tax Module:**
    * Applies inflation to salaries.
    * Calculates 401k contributions (capped by IRS limits).
    * Determines Net Income after taxes.
4.  **Cash Flow Aggregator:** `Net Income - Expenses - Debt Service = Monthly Surplus/Deficit`.
5.  **Asset Simulator:**
    * Distributes Surplus to Joint Accounts.
    * Handles Deficit funding (Waterfall: Cash -> Taxable -> Tax-Advantaged).
    * Applies Growth Rates (Market Return) to balances.

---

## 5. Directory Structure

```text
src/
├── assets/             # Static assets (images, svgs)
├── context/
│   └── DataContext.jsx # Global State Management
├── data/
│   └── hgv_data.json   # Initial State / Seed Data
├── utils/
│   └── financial_engine.js # (Planned) Core Math Logic
├── views/
│   ├── dashboard.jsx   # Main Visualization
│   ├── assumptions.jsx # Input Forms & Controls
│   ├── loans.jsx       # Debt Drill-down
│   └── cashflow.jsx    # Income/Expense Tables
├── components/         # Reusable UI elements (Cards, Tables, Inputs)
├── App.jsx             # Layout & Routing (Sidebar + Content Area)
└── main.jsx            # Entry Point