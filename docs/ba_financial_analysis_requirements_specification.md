# BA Financial Analysis – Requirements Specification

**Version:** 1.3 **Date:** December 3, 2025

------

## 0. Purpose And Planning Objective

- **Primary objective:**
  - Help the user (Primary + Spouse) plan **not to run out of money before end of life**.
  - **End of life** = Primary’s current age + **Projection Horizon** (default 35 years, configurable in **Assumptions**).
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

------

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
- **Schema Refactor (v1.3):**
  - **Generic Identity:** The system uses generic keys (`primary` and `spouse`) instead of hardcoded names (`dick`and `jane`) to support custom user labeling (e.g., "Brian" and "Andrea").
  - **Metadata:** All Scenarios and Profiles include a `description` field for user notes.
- **Data Persistence & Integrity:**
  - **Local Storage:** Automatically saves the full state to browser `localStorage` on any change. Uses **versioned keys** (e.g., `ba_financial_planner_v1.3_primary_spouse`) to prevent cache conflicts with older schemas.
  - **Data Integrity Engine:**
    - **Import Repair:** Validates imported JSON files for schema compatibility.
    - **Auto-Migration:** Automatically renames legacy keys (`dick` -> `primary`) to match the v1.3 schema.
    - **Interactive Fixes:** Prompts the user to supply missing critical data (Birth Year, Birth Month) during import to prevent calculation errors (`NaN`).
- **AI-Ready Export:**
  - **Format:** Single JSON file containing **ALL** saved scenarios.
  - **Enrichment:** The export process runs a full simulation for every scenario and embeds:
    - Full **Projection Timeline** (Net Worth, Cash Flow, Balances per year).
    - **Event Logs**.
    - **System Documentation:** A meta-block describing the engine's rules (Inflation, Taxes, Waterfall) to assist external AI analysis.

### 1.2 Global User Interface (App Shell)

- **Sidebar Navigation:**
  - **Global Actions:** Save Session, Export Full Data (AI), Import/Restore (with Validation), Create Blank, Reset to Defaults.
  - **Scenario Selector:**
    - Dropdown list of all scenarios.
    - Inline buttons for **Save As (Copy)**, **Rename**, and **Delete**.
    - **Safety Rule:** The system prevents deletion of the last scenario.
  - **Module Links:** Dashboard, Cash Flow, Liabilities, Assets, Assumptions.
- **Top bar – Global Date Engine:**
  - Displays **Scenario Start Date** and **Current Model Cursor** (Time Machine).
  - **Persistence:** Current Model Cursor is saved per scenario.

------

## 2. Financial Modules

### 2.1 Liabilities Manager

- **Loan types:** Mortgage, Fixed-rate, Revolving (HELOC).
- **System Reverse Mortgage:**
  - A virtual liability automatically created by the Financial Engine when specific triggers are met.
  - Only visible when active in the simulation.
  - **Auto-Payoff Rule:** When the Reverse Mortgage activates, the engine automatically **pays off any existing "Mortgage" type loans** and rolls their balance into the new Reverse Mortgage line.

### 2.2 Cash Flow Manager (Consolidated)

- **Unified Interface:**
  - A single view manages both **Income** (Salary, Bonus, Retirement Income) and **Expenses** (Bills, Housing, Living).
  - Replaces separate "Income" and "Expense" modules to ensure data synchronization.
- **Income Precision:**
  - **Birth Month:** Income configuration must capture the specific **Birth Month** for the Primary and Spouse.
  - **Proration:** FICA payments in the first eligible year are prorated starting from the birth month (or designated start month).
  - **Work Status:** If a projection year falls outside the defined Work Status table, the system defaults FTE to **0.0 (Retired)**.
- **RMD Handling:**
  - **Not Income:** Required Minimum Distributions (RMDs) from Inherited IRAs are **excluded** from "Total Operating Income" to prevent double-counting.
  - **Cash Injection:** RMDs are treated as a direct transfer from the IRA Asset to the Cash Savings bucket.
  - **Visualization:** RMDs appear in a separate, informational column ("Cash Inj.") in the Detailed Analysis Table.
- **Profile Editor Workflow (v1.3):**
  - **Independent Editing:** Users can load/edit any profile independently of the timeline active profile.
  - **Sync Status:** Visual indicator (Green/Amber) showing if local changes match the Master Profile.
  - **Liability Linking:** Expense profiles can explicitly **link or unlink** specific liabilities (e.g., exclude HELOC payments from a "Downsizing" profile). Unlinked loans remain active (accruing interest) but their payments are excluded from the operating cash flow.

### 2.3 Assets & Property Manager

- **Inherited IRA Refinement:**
  - **Dates:** Inheritance Start Date (starts 10-year clock) vs. Current Balance Date.
  - **10-Year Rule:** The system calculates the deadline (Start + 10 years).
  - **Schedule UI:** Dynamically generates input boxes only for the years remaining.
  - **Final Year Lock:** The 10th year is hard-locked to **100% (1.0)** to strictly enforce depletion.
- **Property Logic:**
  - **Linked Loans:** User can link specific liabilities to a property to calculate "Net Equity" in charts.
  - **Forced Sale:** If the Financial Engine triggers a sale (due to LTV limits), the asset is marked inactive for future years.

------

## 3. Financial Engine & Lifecycle Phases

The simulation logic uses a **Strict Monthly Engine** (420 steps) to ensure precision and prevent compounding errors.

### 3.1 Core Simulation Logic

- **Timebase:** 35 Years x 12 Months = 420 discrete calculation steps.
- **State Management:**
  - **Monthly Reset:** Income and expenses are calculated fresh each month.
  - **Annual Reset:** Accumulators for the "Detailed Analysis Table" are reset every January.
- **Inflation:**
  - Calculated based on `(Total Elapsed Months / 12)` for smooth, stateless compounding.
- **Taxation Rules (Refined v1.3):**
  - **Employment Income:** Treated as **Net (Take-Home)**.
  - **Social Security & Pension:** Treated as **Gross**. The engine applies the effective tax rate (derived from Work Status tiers) before adding to Net Cash Flow.
  - **Retirement Withdrawals:** Treated as **Gross**. Taxes are deducted dynamically upon withdrawal.
- **Debt Filtering:** The engine respects `linkedLoanIds` in Expense Profiles. Unlinked loans are excluded from monthly operating expense calculations.

### 3.2 Phase 1: Standard Retirement (Accumulation/Decumulation)

- **Condition:** Liquid assets exist, and 401k is above the **Safety Floor** (e.g., $300k).
- **Deficit Waterfall:**
  1. **Cash Savings** (down to `cashMin`).
  2. **Joint Investment** (down to `jointMin`).
  3. **Inherited IRA** (accelerated withdrawals beyond schedule).
  4. **401k / 403b** (taxable withdrawals, stop at `retirementMin`).

### 3.3 Phase 2: Reverse Mortgage (Active-RM)

- **Trigger:** Liquid assets depleted AND 401k hits `retirementMin`.
- **Actions:**
  - **Activate R-HELOC:** A new liability is created.
  - **Consolidate Debt:** Existing mortgages are paid off and added to the R-HELOC balance.
- **Waterfall Change:**
  - **401k withdrawals STOP** to preserve the safety floor.
  - All deficits are funded by drawing on the Reverse Mortgage.
  - Interest accrues monthly on the R-HELOC balance.

### 3.4 Phase 3: Post-Housing (Forced Sale / End-of-Life)

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
    1. **Joint Investment**.
    2. **401k** (Fully depletable).
    3. **Cash** (Fully depletable).
  - **Insolvency:** "Out of Money" is only flagged if all these sources reach $0.

------

## 4. Dashboard & Reporting

- **Detailed Analysis Table:**
  - Displays **Annual Aggregates** derived from the monthly simulation.
  - **Expense Categories** must strictly match input modules (Bills, Mortgage, Home, Living, etc.).
  - **Operating Net Flow:** Defined as `(Employment + SS + Pension) - (Total Expenses)`. Does **not** include asset transfers like RMDs.
- **Balance Sheet Chart:**
  - Stacked Bar Chart: Assets (Positive) vs. Liabilities (Negative).
  - **Assets:** Cash, Joint, IRA, Retirement, Net Property Equity.
  - **Liabilities:** Standard Debt (Red), Reverse Mortgage (Orange).
- **Event Log:**
  - Logs transition events: "Reverse Mortgage Activated," "Mortgage Paid Off," "Forced Sale (LTV Limit Hit)," "401k Fully Depleted," "Inherited IRA Depleted."

------

## 5. Version History

- **1.3:** (Current) Identity Refactor (Primary/Spouse keys), Data Integrity Engine (Import Repair & Validation), Profile Editor with Sync Status, Taxation & Debt Linking refinements.
- **1.2:** Strict Monthly Engine (420 steps), Consolidated Cash Flow View, Precise Birth Month Logic, RMD Cash Injection separation.
- **1.1:** Added Scenario Management, AI Export/Import, Lifecycle Phases.
- **1.0:** Baseline. Unified Cash Flow, Balance Sheet, System Reverse Mortgage.