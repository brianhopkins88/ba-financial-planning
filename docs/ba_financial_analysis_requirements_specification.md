# BA Financial Analysis – Requirements Specification

Version: **1.1** (Includes Scenario Management, AI Interoperability, and Advanced Lifecycle Logic)

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
  5. When satisfied, user **saves the Scenario** or creates a new one via **Save As**.
  6. User **exports data** for external analysis (AI-Ready JSON).

- **Design principle:**
  - **No hard-coded financial constants.** All numeric values (rates, thresholds, horizons, minimums, maximums) must be stored as **parameters**.

---

## 1. System Architecture & Data Strategy

### 1.1 Scenario-Based Data Model

- **Core concept:**
  - All financial configuration and output is captured in **Scenarios**. The application maintains a registry of multiple scenarios in memory simultaneously.
  - **Default Scenario:** On fresh startup, the app loads a template named **"Example Scenario"**.

- **Root structure (`application_data.json`):**
  - `scenarios`: Comprehensive financial snapshots, each containing:
    - Income configurations (Salary, Bonus, Work Status).
    - Expense configurations (Recurring Bills, Housing, One-Offs, Fun Money).
    - Liabilities (Loans, Mortgages, HELOCs).
    - Assets & Property configurations.
    - Global Assumptions (rates, thresholds, tax schedules, etc.).
  - `profiles`: Reusable partial configurations for **Income** and **Expenses**.

- **Data persistence:**
  - **Local storage:** Automatically saves the full state to browser `localStorage` on any change.
  - **Scenario Management:**
    - **Save As (Clone):** Duplicate the active scenario into a new slot with a custom name.
    - **Rename/Delete:** Manage scenarios directly.
    - **Safety Rule:** The system **prevents deletion of the last scenario**. If attempted, it warns the user and resets the application to the default "Example Scenario".

- **AI-Ready Export:**
  - **Format:** Single JSON file containing **ALL** saved scenarios.
  - **Enrichment:** The export process runs a full simulation for every scenario and embeds:
    - Full **Projection Timeline** (Net Worth, Cash Flow, Balances per year).
    - **Event Logs**.
    - **System Documentation:** A meta-block describing the engine's rules (Inflation, Taxes, Waterfall) to assist external AI analysis.

- **Import Logic:**
  - **Merge Mode:** Adds imported scenarios to the current session (preserves existing work).
  - **Overwrite Mode:** Replaces the entire current session with the imported file.
  - **Sanitization:** Automatically strips heavy "AI metadata" (simulation outputs) during import to keep the application lightweight.

### 1.2 Global User Interface (App Shell)

- **Sidebar Navigation:**
  - **Global Actions:** Save Session, Export Full Data (AI), Import/Restore, Create Blank, Reset to Defaults.
  - **Scenario Selector:**
    - Dropdown list of all scenarios.
    - Inline buttons for **Save As (Copy)**, **Rename**, and **Delete**.
  - **Module Links:** Dashboard, Cash Flow, Liabilities, Assets, Assumptions.

- **Top bar – Global Date Engine:**
  - Displays **Scenario Start Date** and **Current Model Cursor** (Time Machine).
  - **Persistence:** Current Model Cursor is saved per scenario.

---

## 2. Financial Modules

### 2.1 Liabilities Manager

- **Loan types:** Mortgage, Fixed-rate, Revolving (HELOC).
- **System Reverse Mortgage:**
  - A virtual liability automatically created by the Financial Engine when specific triggers are met.
  - Only visible when active in the simulation.
  - **Auto-Payoff Rule:** When the Reverse Mortgage activates, the engine automatically **pays off any existing "Mortgage" type loans** and rolls their balance into the new Reverse Mortgage line.

### 2.2 Cash Flow Manager

- **Unified Interface:** Income and Expenses tabs with a "Net Cash Flow" summary chart.
- **Joint Account Logic:**
  - Deposits to the Joint Account are the sum of:
    1. **Cash Flow Surplus:** Any monthly income remaining after expenses and debt (once Cash Savings is full).
    2. **Asset Transfers:** Net proceeds from Inherited IRA RMDs or Property Sales.

### 2.3 Assets & Property Manager

- **Inherited IRA Refinement:**
  - **Dates:**
    - **Inheritance Start Date:** Determines the 10-year depletion deadline.
    - **Current Balance Date:** The date of the entered balance (usually Scenario Start).
  - **10-Year Rule:** The system calculates the deadline (Start + 10 years).
  - **Schedule UI:**
    - Dynamically generates input boxes **only** for the years remaining between Scenario Start and the Deadline.
    - Inputs are keyed to **Calendar Years** (e.g., 2026, 2027), not relative indices.
    - **Default Value:** New/Empty years default to **20%** withdrawal to ensure the projection table populates immediately.
    - **Final Year Lock:** The 10th year is hard-locked to **100% (1.0)** to strictly enforce depletion.

- **Property Logic:**
  - **Linked Loans:** User can link specific liabilities to a property to calculate "Net Equity" in charts.
  - **Forced Sale:** If the Financial Engine triggers a sale (due to LTV limits), the asset is marked inactive for future years.

---

## 3. Financial Engine & Lifecycle Phases

The simulation logic is refactored into **Three Lifecycle Phases**, each with unique cash-flow rules.

### 3.1 Phase 1: Standard Retirement (Accumulation/Decumulation)
- **Condition:** Liquid assets exist, and 401k is above the **Safety Floor** (e.g., $300k).
- **Deficit Waterfall:**
  1. **Cash Savings** (down to `cashMin`).
  2. **Joint Investment** (down to `jointMin`).
  3. **Inherited IRA** (accelerated withdrawals beyond schedule).
  4. **401k / 403b** (taxable withdrawals, stop at `retirementMin`).

### 3.2 Phase 2: Reverse Mortgage (Active-RM)
- **Trigger:** Liquid assets depleted AND 401k hits `retirementMin`.
- **Actions:**
  - **Activate R-HELOC:** A new liability is created.
  - **Consolidate Debt:** Existing mortgages are paid off and added to the R-HELOC balance.
- **Waterfall Change:**
  - **401k withdrawals STOP** to preserve the safety floor.
  - All deficits are funded by drawing on the Reverse Mortgage.
  - Interest accrues monthly on the R-HELOC balance.

### 3.3 Phase 3: Post-Housing (Forced Sale / End-of-Life)
- **Trigger:** Reverse Mortgage Balance hits the age-based **LTV Limit** (e.g., 50% at age 80).
- **Actions:**
  - **Forced Sale:** The property is sold at current projected market value.
  - **Payoff:** Proceeds pay off the R-HELOC (and any other secured debt).
  - **Proceeds Distribution:**
    1. Top off **Cash Savings** (up to `cashMax`).
    2. Remaining funds deposited to **Joint Investment**.
- **Waterfall Change (Solvency Mode):**
  - The **401k Safety Floor is removed**.
  - Deficit Funding Order:
    1. **Joint Investment** (Sale proceeds).
    2. **401k** (Fully depletable).
    3. **Cash** (Fully depletable).
  - **Insolvency:** "Out of Money" is only flagged if all these sources reach $0.

---

## 4. Dashboard & Reporting

- **Balance Sheet Chart:**
  - Stacked Bar Chart: Assets (Positive) vs. Liabilities (Negative).
  - **Assets:** Cash, Joint, IRA, Retirement, Net Property Equity.
  - **Liabilities:** Standard Debt (Red), Reverse Mortgage (Orange).
- **Event Log:**
  - Logs transition events: "Reverse Mortgage Activated," "Mortgage Paid Off," "Forced Sale (LTV Limit Hit)," "401k Fully Depleted."

---

## 5. Version History

- **1.1:** (Current) Added Scenario Management (Save As/Rename), AI Export/Import, Lifecycle Phases (LTV Sale, Post-Sale Spend Down), and Inherited IRA Calendar Logic.
- **1.0:** Baseline. Unified Cash Flow, Balance Sheet, System Reverse Mortgage.