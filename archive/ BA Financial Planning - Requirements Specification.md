### **BA Financial Analysis - Requirements Specification**

**Version:** 8.5 (Comprehensive)
**Date:** November 25, 2025
**Scope:** Full Stack (Scenario Engine, App Shell, Loans, Income & Expenses, Dashboard)

# 1. System Architecture & Navigation

## 1.1 Scenario-Based Data Model

- **Core Concept:** The application never edits a "global" state directly. All financial data resides within specific "Scenarios" stored in the root `hgv_data.json` file.
- **Root Structure:**
  - `scenarios`: The primary registry of full financial snapshots (containing Income, Expenses, Loans, Assets, and Global Rates).
  - `profiles`: A library of partial configurations (e.g., "Expense Profile: Retirement Lean", "Income Profile: Early Exit") that can be injected into any scenario.
- **Data Attributes:**
  - **Active Flags:** Loans and major line items carry an `active: boolean` flag to support "soft deletes" and "what-if" modeling without permanent data loss.
  - **Profile Tracking:** Scenarios persist the `activeProfileId` for Income and Expenses modules to remember user selections (e.g., remembering that "Retirement Lean" is currently loaded).

## 1.2 Global User Interface (App Shell)

- **Structure:** The app uses a persistent **Sidebar Layout** (Left Navigation).
- **Navigation Menu:**
  1. **Dashboard:** High-level metrics (Net Worth, Liquidity, Solvency) - *Phase 4*.
  2. **Cash Flow:** Income & Expenses Manager (Burn Rate) - *Phase 3 (Active)*.
  3. **Loans & Debt:** Advanced liability management & Payoff Strategies - *Phase 2 (Complete)*.
  4. **Assets & Rates:** Starting Capital & Global Market Assumptions - *Phase 1*.
- **Scenario Controls (Sidebar):**
  - **Selector:** A dropdown to switch the "Active Scenario" instantly.
  - **New/Clone:** Ability to create a deep copy of the current scenario or a fresh blank one.
  - **Save Snapshot:** A distinct button to save the current state as a new named Scenario (e.g., "Baseline - Nov 2025") without overwriting the original.

# 2. Financial Modules

## Module 1: Income & Expenses Manager (Cash Flow)

**Concept:** A centralized hub for managing the household "Burn Rate". It supports **Profile-Based Modeling** for rapid A/B testing of lifestyle costs and income streams.

### 1.1 Profile Management ("Current Profile")

- **UI:** A dropdown selector in the module header showing the currently active profile (e.g., "Initial Expenses" or "Unsaved/Custom").
- **CRUD Actions:**
  - **Load Profile:** Apply a saved profile to the current scenario (overwrites current inputs for that specific module).
  - **Save Profile:** Save current inputs as a new reusable Profile in the global registry.
  - **Delete Profile:** Remove an obsolete profile from the registry.

### 1.2 Expenses (Outflows)

- **Categorization:**
  1. **Recurring Bills:** Fixed monthly obligations (Internet, Phone, Insurance).
  2. **Home Expenses:** Property-related fixed costs (Tax, HOA, Utilities, Security).
  3. **Living Expenses:** Variable costs (Groceries, Dining) and Annual Sinking Funds (Maintenance).
  4. **Debts (Dynamic Injection):** A read-only category that automatically calculates monthly debt service.
- **Debt Injection Logic:**
  - The module dynamically fetches loan data from the **Loans Module**.
  - **Inclusion Criteria:** Loan must be marked `Active` **AND** `Start Date` < `Current Model Date`.
  - **Calculation:** Sum of `Minimum Payment` + `Planned Extra Principal` (for the current month).
- **UI Requirement:** Categories must support an expandable/collapsible (Accordion) layout to manage long lists of expenses efficiently.

### 1.3 Income (Inflows)

- **Active Income:**
  - Inputs for Net Annual Salary (Person A & Person B).
  - **401k Configuration:** Gross Salary input specifically for calculating pre-tax contribution limits.
  - **Work Status Trajectory:** An editable table defining FTE (Full Time Equivalent, 0.0 - 1.0) per year to simulate retirement fade (e.g., going part-time at age 55).
- **Passive Income:**
  - Future placeholders for Social Security and Pension inputs (Start Age + Base Amount).

### 1.4 Visuals & Metrics

- **Burn Rate Summary:** A real-time summation header displaying Total Bills + Total Home + Total Living + Active Debt.
- **Net Cash Flow:** A visual bar chart (Green/Red) indicating monthly surplus or deficit.
- **Date Context:** A dynamic display of the "Current Model Month" (e.g., Nov 2025) to contextualize the data.

## Module 2: Loans & Debt Manager

**Concept:** The "Source of Truth" for all liability logic. This module calculates amortization schedules and feeds payment data to the Cash Flow module.

### 2.1 Loan Configuration

- **CRUD:** Create, Read, Update, Delete loans.
- **Active Toggle:** A boolean toggle to mark a loan as "Inactive" (excluded from calculations) without deleting the data.
- **Start Date:** A mandatory field defining when the loan originated. Used by the Cash Flow module to determine if payments should be included.
- **Loan Types:**
  - **Fixed:** Standard amortization (Mortgage, Auto). Requires Principal, Rate, Term. Auto-calculates Payment.
  - **Revolving:** Interest-only or custom payment (HELOC, Credit Cards). Requires Balance, Rate, Planned Payment.

### 2.2 Strategy Engine

- **Multiple Strategies:** Users can define multiple payoff plans per loan (e.g., "Base Strategy" vs "Aggressive Payoff").
- **Grid Interface:** An Excel-style table showing the amortization schedule.
- **Drag-to-Fill:** Users can enter an "Extra Principal" payment in one month and drag a handle to batch-apply that value to future months.

## Module 3: Assets & Market Assumptions

**Concept:** Manages Starting Capital and Global Economic Rates. This module defines the "Starting Line" for the simulation.

### 3.1 Asset Inputs

- **Joint Account:** The central "Liquidity Hub". Surpluses flow here; deficits drain from here.
- **Retirement (Pre-Tax):** Combined 401k/403b/IRA balances. Subject to RMDs and Tax Tiers in the engine.
- **Roth/Post-Tax:** Inherited IRAs or Brokerage accounts.
- **Property Value:** Current market value of the primary residence (used for LTV calculations).

### 3.2 Global Economic Rates

- **Inflation:**
  - `General CPI`: Applies to Living Expenses.
  - `Medical Inflation`: Applies to specific future medical costs.
  - `Property Tax Cap`: Limits the annual growth of property tax expenses (e.g., Prop 13).
- **Market Returns:**
  - `Initial Return`: Growth rate during the accumulation phase.
  - `Terminal Return`: Growth rate during the drawdown/retirement phase.
  - `Taper Age`: The age at which the return transitions from Initial to Terminal.

## Module 4: The Financial Engine (Phase 4 Logic)

**Concept:** The "Invisible Hand" that processes the inputs from Modules 1-3 to generate a long-term projection.

### 4.1 Time Series Generation

- The engine generates a monthly array from `Start Date` to `End Date` (e.g., Age 95).

### 4.2 Cash Flow Waterfall (Monthly Calculation)

1.  **Inflow:**
    - Calculate Active Income: `(Salary_A * FTE_A) + (Salary_B * FTE_B)`.
    - Calculate Passive Income: `SS + Pension` (if Age > Start Age).
    - Apply Taxes: Deduct effective tax rate based on total inflow tiers.
2.  **Outflow:**
    - Fetch Total Monthly Burn from Module 1 (Expenses + Debt).
    - Apply Inflation: Adjust expense amounts based on `CPI ^ Years_Elapsed`.
3.  **Net Result:**
    - Calculate `Net_Surplus = Inflow - Outflow`.

### 4.3 Net Worth Waterfall (Asset Logic)

1.  **Surplus Allocation:**
    - If `Net_Surplus > 0`: Add 100% to **Joint Account (Liquidity)**. (Future: Spillover to Brokerage).
2.  **Deficit Coverage:**
    - If `Net_Surplus < 0`:
        - Step 1: Withdraw from **Joint Account** until $0.
        - Step 2: Withdraw from **Inherited IRA/Brokerage**.
        - Step 3: Withdraw from **401k/Retirement** (Applying penalty if Age < 59.5).
3.  **Investment Growth:**
    - Apply monthly `Market Rate` to all remaining asset balances.

### 4.4 Solvency Triggers

- **Insolvency:** Flag the simulation if Total Liquid Assets < $0.
- **Liquidation Event:** Trigger a "Force Sell" event if Home LTV > 66% (Reverse Mortgage limit).

# 3. User Interface & Experience Requirements

### 3.1 Visual Dashboard (Phase 4)

- **Net Worth Chart:** A line chart showing Total Assets vs. Total Liabilities over time.
- **Liquidity Gauge:** A visual indicator of "Years of Expenses Saved".
- **Solvency Status:** A clear "Safe / Danger" indicator based on the simulation outcome.

### 3.2 Usability Enhancements (Planned)

- **Vertical Accordion (Expenses):** To handle large lists of expenses, categories should be collapsible.
- **Dynamic Date Header:** The application must display the current simulation date (e.g., "Nov 2025") prominently, rather than a static default.