### **BA Financial Analysis - Requirements Specification**



**Version:** 8.2 (Consolidated) **Date:** November 23, 2025 **Scope:** Full Stack (Scenario Engine, App Shell, Loans, Expenses, Dashboard)

------



# 1. System Architecture & Navigation





## 1.1 Scenario-Based Data Model



- **Core Concept:** The application never edits a "global" state directly. All data resides within specific "Scenarios" stored in `hgv_data.json`.
- **Default Scenario:** "Current Home HGV".
- **Naming Convention:** System automatically tracks `created` and `lastUpdated` timestamps for every scenario.
- **Scenario Actions:**
  - **Selector:** A dropdown in the global Sidebar allows instant switching between saved scenarios.
  - **Clone/Snapshot:** A "New / Clone" button allows the user to deep-copy the active scenario to a new unique ID (e.g., `scen_1732389102`) to test hypothetical changes without losing the original state.
  - **Persistence:** All edits must trigger a generic `updateScenarioData` action that updates the `lastUpdated`timestamp.



## 1.2 Global User Interface (App Shell)



- **Structure:** The app uses a persistent **Sidebar Layout**.
- **Navigation Menu:**
  1. **Dashboard:** High-level metrics (Net Worth, Liquidity) - *Phase 4*.
  2. **Expenses:** Categorized monthly obligations - *Phase 3*.
  3. **Loans & Debt:** Advanced liability management and payoff modeling - *Phase 2 (Complete)*.
  4. **Assumptions:** Income, Assets, and Global Rates - *Phase 1 (Complete)*.
- **Data Awareness:** The sidebar must display a "Data as of: [Date]" footer derived from the active scenario's timestamp.

------



# 2. Financial Modules





## Module 1: Expenses Manager (Phase 3 Focus)



**Concept:** A dedicated module for granular tracking of monthly outflows, distinct from the "General Living" lump sum.



### 1.1 Categories & Logic



The system must support three distinct expense arrays. The logic engine aggregates these into a single "Monthly Burn" figure.

1. **Bills:** Recurring fixed costs.
   - *Standard Items:* Utilities, Internet/Cable, Cell Phone, Trash, Subscriptions, Pet Insurance, Security.
2. **Home:** Property-related fixed costs.
   - *Standard Items:* Property Tax, Home Insurance, HOA.
3. **Living:** Variable lifestyle costs.
   - *Standard Items:* General Living (Groceries/Dining), Landscaping/Housekeeping.



### 1.2 Functionality



- **CRUD Operations:** Users can Add, Edit, and Delete individual line items within these categories.
- **Data Structure:** Each item is an object: `{ id, name, amount }`.

------



## Module 2: Loans & Debt Manager (Completed)



**Concept:** A centralized hub for managing liabilities. Users create, configure, and model complex payoff strategies here.



### 2.1 Loan Management (CRUD)



- **Sidebar List:** Displays all loans in the scenario.
- **Fail-Safe Selection:** If the currently selected loan is deleted, the view must automatically switch to the next available loan (or show a "No Accounts" state) to prevent UI crashes.
- **Loan Types:**
  - **Fixed (Mortgage/Auto):**
    - *Inputs:* Principal, Interest Rate, Start Date, Term (Months).
    - *Auto-Calculation:* Changing Principal, Rate, or Term **automatically calculates** the required "Monthly Payment" using the amortization formula (P⋅(1+r)n−1r(1+r)n).
  - **Revolving (CC/HELOC):**
    - *Inputs:* Current Balance, Interest Rate, Planned Monthly Payment.
    - *Logic:* Payment is user-defined but must be ≥ Interest to prevent negative amortization.



### 2.2 Advanced Strategy Engine



- **Strategy Architecture:**
  - A Loan can hold multiple named "Strategies" (sub-scenarios).
  - **Base Strategy:** A protected "Minimum Payment" strategy that **cannot be deleted**.
  - **Custom Strategies:** Users can Create (name) and Delete custom strategies (e.g., "Aggressive Payoff").
- **Amortization Grid Interactions:**
  - **Extra Principal Column:** Users can input one-time lump sums into specific months.
  - **Drag-to-Fill (Excel-Style):** Users can select an "Extra Principal" cell and drag the handle down to batch-apply that value to a range of future months.
  - **Performance:** This batch action must be handled by a specific `batchUpdateLoanPayments` reducer to avoid performance penalties from multiple re-renders.

------



## Module 3: Assumptions (Income & Assets)



**Concept:** Manages the "Top of the Funnel" inputs (Inflow) and Starting Capital.



### 3.1 Income Logic



- **Active Income:** Net Salary inputs (Tax logic bypassed for Salary).
- **Work Status:** Year-by-Year slider (0.0 to 1.0) impacting Salary availability.
- **Passive Income:** SS/Pension (Gross) - subject to Tax Tiers.



### 3.2 Asset Logic



- **Joint Account:** The "Hub" for surplus/deficits.
- **Retirement Accounts:** 401k/IRA balances growing at market rates.
- **Property Value:** Grows by inflation; crucial for LTV calculations in Solvency Logic.
- **Global Rates:** User-defined General Inflation, Medical Inflation, and Market Returns (Initial/Terminal).

------



# 3. The Financial Engine (Phase 4 Logic)



**Concept:** This runs 'behind the scenes' to power the Dashboard visualizations.



### 3.1 Cash Flow Waterfall



1. **Income Inflow:** Salary (adjusted by Work Status) + Bonus + Passive.
2. **Mandatory Outflow:** Expenses (Module 1) + Loan Payments (Module 2).
3. **Net Result:**
   - *Surplus:* Adds to Joint Account.
   - *Deficit:* Triggers Withdrawal Logic.



### 3.2 Withdrawal Logic (Deficit Funding)



1. **Liquidity Buffer Check:** Ensure Joint Account > Target ($50k).
2. **Source Order:**
   - 1st: Inherited IRA (until depleted).
   - 2nd: 401k/403b (Tax Gross-up applied).



### 3.3 Solvency Triggers



- **Reverse Mortgage:** Triggered if Retirement Balances are critical.
- **Liquidation:** Triggered if LTV > 66% (Sell Home, Rent).