# BA Financial Analysis – Requirements Specification

Version: **1.0** (Final Baseline – Incorporates Cash Flow Manager, Balance Sheet Dashboard, and Engine Hardening.)

Date: **November 30th, 2025**

---

## 0. Purpose And Planning Objective

- **Primary objective:**
  - Help the user (Brian + spouse) plan **not to run out of money before end of life**.
  - **End of life** = Brian’s current age + **Projection Horizon** (default 35 years, configurable in **Assumptions**).
  - System explicitly supports **iterative planning**: adjust parameters, run projections, inspect results, and re-tune.

- **Heirs / bequest assumption:**
  - No need to preserve principal for heirs; **goal is consumption safety**, not legacy.
  - It is acceptable (and expected) to **tap home equity**, including:
    - Reverse mortgage **line of credit** (R-HELOC).
    - **Selling the home** late in life to fund remaining expenses.

- **Scenario workflow:**
  1. User sets parameters in **Assumptions** and the various modules (Cash Flow, Liabilities, Assets & Property).
  2. User runs **Cash Flow & Net Worth Projection** via the **Financial Engine**.
  3. User reviews:
     - Monthly and annual cash flow (Green/Red bar chart).
     - Balance Sheet (Assets vs Liabilities).
     - Event log (retirement, SS start, IRA depletion, reverse mortgage events, home sale, out of money).
  4. User adjusts parameters (working years, spending levels, asset rules, etc.) and re-runs.
  5. When satisfied, user **saves the Scenario** and **exports all scenario + projection data as JSON**.

- **Design principle:**
  - **No hard-coded financial constants.** All numeric values (rates, thresholds, horizons, minimums, maximums) must be stored as **parameters** in:
    - **Global Assumptions** (if used across modules), or
    - The relevant module (if local to that module).

---

## 1. System Architecture & Data Strategy

### 1.1 Scenario-Based Data Model

- **Core concept:**
  - All financial configuration and output is captured in **Scenarios**. No global mutable state outside the active Scenario.

- **Root structure:**
  - `scenarios`: Comprehensive financial snapshots, each containing:
    - Income configurations (Salary, Bonus, Work Status).
    - Expense configurations (Recurring Bills, Housing, One-Offs, Fun Money).
    - Liabilities (Loans, Mortgages, HELOCs).
    - Assets & Property configurations.
    - Global Assumptions (rates, thresholds, tax schedules, etc.).
    - Financial Engine outputs (monthly/annual projections, net worth, event logs).
  - `profiles`: Reusable partial configurations for **Income** and **Expenses** that can be applied to multiple scenarios.

- **Data persistence:**
  - **Local storage:**
    - Application automatically saves the full active Scenario to browser `localStorage` whenever edits occur.
  - **Export:**
    - User can export the active Scenario to a **single JSON file**.
    - Export must bundle:
      - Scenario input data (Assumptions, Income, Expenses, Liabilities, Assets & Property).
      - Any **linked Profiles** (income/expense profiles used by this Scenario).
      - **Projection Output** from the Financial Engine:
        - First 5 years **monthly** cash-flow and net-worth details.
        - Remaining horizon **annual** details.
        - Event log entries.
  - **Import:**
    - **Upload to Current:** Overwrites the active scenario with data from a file.
    - **Upload as New:** Creates a new scenario from a file.

### 1.2 Global User Interface (App Shell)

- **Sidebar Navigation:**
  - **Global actions:** Save, Export Scenario, Export Full Source (Dev), Upload, Create Blank, Clear.
  - **Scenario selector:** Dropdown with:
    - Rename Scenario.
    - Clone Scenario.
    - Delete Scenario.
  - **Module links:**
    - Dashboard (Balance Sheet & Summary).
    - Cash Flow (Income & Expenses Unified).
    - Liabilities (Loans & Debt).
    - Assets & Property.
    - Assumptions.

- **Top bar – Global Date Engine (Time Machine):**
  - Displays:
    - **Scenario Start Date** (Month/Year).
    - **Current Model Cursor** (Month/Year), which indicates the point in the projection currently being inspected.
  - **Persistence:**
    - Current Model Cursor is stored in Scenario data and restored on reload.
  - **Navigation controls:**
    - Back/Forward arrows.
    - **Press & Hold acceleration:**
      - Step 1: Month-by-month.
      - Step 2: Quarter jumps.
      - Step 3: Year jumps.
    - Optional manual Month/Year selector.

### 1.3 Profiles (Reusable Configurations)

- **Definition and scope:**
  - **Profiles** are reusable configuration objects that capture parameter sets for one module or sub-module (Income or Expenses).
  - A Profile is **module-scoped** but can be **reused across multiple Scenarios**.

- **Association to Scenarios:**
  - A Profile can be **linked** to one or more Scenarios.
  - Within a Scenario, **module-scoped Profiles** (especially Expense Profiles) may be attached as a **time-phased sequence**, where each Profile includes a Start Date and the Engine selects the active profile for each period.

- **Persistence model:**
  - Profiles are persisted via Scenario JSON exports/imports to maintain portability without a backend.

---

## 2. Financial Modules

### 2.1 Liabilities Manager (Formerly Loans)

- **Loan types:**
  1. **Mortgage** (linked to Property assets):
     - Mathematically a fixed-rate, fully amortizing loan.
     - Grouped separately in Expenses under “Mortgage & Impounds”.
  2. **Fixed-rate loans** (Auto, Personal, etc.):
     - Standard amortization.
  3. **Revolving loans** (HELOC, Credit Cards):
     - Interest is calculated on daily/monthly balance using a rate defined in Assumptions or at loan level.
  4. **System: Reverse Mortgage (R-HELOC):**
     - A special **system-generated** virtual liability created by the engine.
     - **Visibility:** Only appears in the list if active in the simulation.
     - **Details View:** Read-only table showing Year-by-Year balance, interest accrual, draws, and LTV ratio.

- **Payoff profiles (strategies):**
  - Each loan can have one or more **payoff strategies**, including:
    - Base amortization (standard schedule).
    - Extra Principal payments (monthly grid).
  - **Drag-to-Fill:** UI affordance to batch-fill Extra Principal values down a time grid.

- **Integration:** Extra Principal payments defined here are automatically injected into the **Cash Flow** module as read-only "Debt" expenses to ensure budget accuracy.

### 2.2 Cash Flow Manager

- **Unified Interface:** Tabbed view toggling between **Income** and **Expenses** with a top-level **Net Cash Flow Summary** (Green/Red bar chart) driven by the engine.

#### 2.2.1 Income Inputs
- **Base Salary & Bonus:** Inflation-adjusted annually.
- **Work Status:** 15-year trajectory of FTE (0.0 - 1.0).
- **Social Security:** Configurable Start Age and Amount. **First-Year Proration** based on birth month.
- **Pension:** Inflation-adjusted, auto-starts when FTE drops to 0.
- **Profiles:** Independent "Income Profiles" can be saved and sequenced.

#### 2.2.2 Expense Inputs
- **Recurring Bills:** Categorized (Bills, Home, Living, Impounds).
- **Liabilities Integration:** Auto-displays debt service (P&I + Extra Principal) from the Liabilities module.
- **Extra Expense Planning (Scenario-Driven):**
  - **One-Offs:** Specific future expenses (e.g., Wedding 2028).
  - **Retirement Fun Money:** Annual budgets defined by 5-year age brackets (Age 65-90). Changes here reflect immediately in projections.
- **Profiles:** "Expense Profiles" manage recurring bills and housing transitions.

### 2.3 Assets & Property Manager

- **Asset Types:** Cash, Joint Investment, Inherited IRA, Retirement (401k), Property.
- **Global Thresholds Integration:**
  - UI allows editing global engine rules directly within the relevant asset context:
    - **Cash:** `Cash Floor (Min)` and `Surplus Cap (Max)`.
    - **Joint:** `Depletion Floor`.
    - **Retirement:** `Safety Floor (RM Trigger)`.

- **Future Assets:** Supports "Start Date" in the future (e.g., future inheritance). Balance is excluded from start (Day 0) and injected into the simulation when the date is reached.

#### 2.3.1 Visualization Requirements
- **Liquid Assets:** **Bi-Directional Stacked Bar Chart**.
  - Positive Stack: Opening Balance (Grey) + Annual Deposits (Blue) + Annual Growth (Green).
  - Negative Bar: Annual Withdrawals (Red).
  - **Start Bar:** Year 0 must explicitly show the initial balance using a derived "Opening Balance" calculation.
- **Property:** Stacked Bar (Net Equity vs Linked Debt).
- **Linked Liabilities:** Property assets allow checking/unchecking specific loans to calculate Net Equity dynamically.

#### 2.3.2 Inherited IRA
- **10-Year Rule:** Enforced depletion schedule.
- **Taxation:** Progressive tax tiers (32%, 40%, 48%) for large withdrawals.

#### 2.3.3 Retirement (401k) Contributions
- **Brian:** Employee Contribution + **Employer Match** (50% of the first 6% of salary).
- **Andrea:** Employee Contribution only (No Match).

---

## 3. Financial Engine & Projections

### 3.1 Timebase & Resolution
- **Hybrid:** Monthly for years 1-5, Annual for years 6-35.
- **Day 0 Snapshot:** Engine calculates a specific "Month 0" state to represent starting balances before any flows occur.

### 3.2 Cash Flow Waterfall (Deficit Rules)
When **Expenses > Income**:
1. **Cash Savings** (down to `cashMin`).
2. **Joint Investment** (down to `jointMin`).
3. **Inherited IRA** (accelerated withdrawals).
4. **401k / 403B** (tax-deferred withdrawals).
   - **Safety Floor:** If 401k hits `retirementMin` (default $300k) and deficit persists, stop withdrawing and trigger Reverse Mortgage.
5. **Reverse Mortgage (R-HELOC)** (if eligible).
6. **Forced Home Sale:** If R-HELOC hits LTV limit.

### 3.3 Reverse Mortgage Logic
- **Trigger:** 401k at Minimum Floor + Liquid Assets Depleted + Deficit Exists.
- **Tracking:** Interest and Draws are tracked separately. Interest compounds at `reverseMortgageRate`.
- **LTV Limits:** Age-based limits (40%/50%/60%) trigger forced sale.

### 3.4 Net Worth Calculation
- **Formula:** `(Cash + Joint + Inherited + Retirement + Property Value) - (System Reverse Mortgage + Sum of All Active Loan Balances)`.
- **Loan Balances:** Must include balances for all active loans, even if payments are deferred or 0 for a specific period.

### 3.5 Income Inflation Rule
- **Rule:** The Financial Engine must apply the **General Inflation Rate** annually to:
  - Base Salary.
  - Annual Bonus.
  - Social Security (or SS-specific rate).
  - Pension (if inflation-adjusted).

---

## 4. Dashboard & Reporting

- **Balance Sheet Chart:**
  - **Stacked Bar Chart** representing the Accounting Equation.
  - **Positive Stack (Assets):** Cash, Joint, IRA, Retirement, Property.
  - **Negative Stack (Liabilities):** Standard Debt (Red), Reverse Mortgage (Orange).
  - **Line Overlay:** Net Worth.
- **Event Log:**
  - Logs critical life events: Retirement, SS Start, Loan Payoffs (Monthly or Annual detection), Asset Depletion, RM Activation, Insolvency.
- **Solvency Check:** "Out of Money" event if all assets are depleted and deficit persists.

---

## 5. Version History

- **1.0:** Final Baseline. Unified Cash Flow, Balance Sheet Dashboard, Hardened Engine (Match Rules, 401k Floor), Liabilities Module renaming.
- **0.96:** Asset Stacked Visualization, Component Tracking.
- **0.95:** Income Inflation, Detailed IRA Rules.
- **0.91:** Integrated time-phased Expense Profiles and housing transition model.
- **0.9:** Introduced hybrid timebase, cash-flow waterfall, and IARRA.