# **BA Financial Analysis - Requirements Specification**

Version: 0.8 (Updated Session 10)

Date: November 27, 2025

# **1. System Architecture & Data Strategy**

## **1.1 Scenario-Based Data Model**

- **Core Concept:** Financial data is encapsulated within Scenarios rather than global state. Each Simulation, Profile, Loan, and Asset configuration belongs to an active Scenario context.
- **Root Structure:**

- scenarios: Comprehensive financial snapshots (Income, Expenses, Loans, Assets, Market Rates).
- profiles: Reusable partial configurations for Income and Expense setups.

- **Data Persistence:**

- **Local Storage:** The application automatically saves the full state to the browser's localStorage on every change to prevent data loss on refresh.
- **Export:** Users can export the active Scenario as a JSON file.
- **Linked Profiles:** The exported JSON must bundle the **Scenario Data**, **Linked Profiles**, and **Projection Output** (Year-by-Year Cash Flow & Net Worth) to ensure the file is portable and self-contained for reporting.

- **Importing:**

- **"Upload to Current":** Overwrites the active scenario with data from a file.
- **"Upload as New":** Creates a new scenario from a file.

## **1.2 Global User Interface (App Shell)**

- **Sidebar Navigation:**

- **Global Actions Menu:** Save, Export, Upload, Create Blank, Clear.
- **Scenario Selector:** Dropdown with Rename, Clone, and Delete capabilities.
- **Module Links:** Dashboard, Income, Expenses, Loans, Assets & Property, Assumptions.

- **Top Bar (Time Machine):**

- **Global Date Engine:** Displays "Scenario Start Date" and "Current Model Month" (e.g., Jan 2026).
- **Persistence:** The "Current Model Month" cursor is saved to the scenario data.
- **Time Travel:** Forward/Back arrows with "Press & Hold" acceleration (Month -> Quarter -> Year jumps).

# **2. Financial Modules**

## **2.1 Loans & Debt Manager**

- **Loan Types:**

- **Mortgage:** Treated mathematically as a Fixed loan but grouped separately in Expenses.
- **Fixed:** Standard amortization (Auto, Personal).
- **Revolving:** Interest-calculated (HELOC, Credit Cards).
- **Reverse Mortgage (R-HELOC):** System-generated loan type (see Section 3.2).

- **Payoff Profiles (Strategies):**

- Multiple payoff strategies per loan.
- **Drag-to-Fill:** Batch-fill "Extra Principal" payments in the grid.

- **Status & Visibility:**

- **Active Toggle:** Soft delete capability.
- **Visibility:** All Active loans appear in the "Other Loans" summary in Expenses.
- **Reverse Mortgage View:** Expandable view showing projected start year, annual balance, and % of total home equity.

## **2.2 Income Manager**

- **Components:**

- **Base Salary:** Net monthly pay for Person A and Person B.
- **Annual Bonus:** Input for Net Amount and Payout Month.
- **Work Status Trajectory:** 10-year table defining FTE (0.0 - 1.0) for each person, driving income scaling.

- **Profile Management:** Time-phased profiles for "Mix-and-Match" modeling.

## **2.3 Expenses Manager**

- **Projections:**

- **Expense Summary:** 35-year bar chart (Fixed scale $300k) with "overflow" indicators.
- **Logic:** Must use the **Financial Engine** (or shared utility) to ensure projections match the global Net Worth model.

- **Categorization Logic:**

1. **Recurring Bills:** Utilities, subscriptions.
2. **Mortgage & Impounds:** Property Tax, Insurance, Active Mortgages.
3. **Home Expenses:** HOA, Landscaping.
4. **Living Expenses:** Variable spending.
5. **Other Loans:** Aggregate monthly debt service.

- **Rules:**

- **Medicare:** Add $6,000/yr (indexed at 5% medical inflation) after full retirement age.
- **Prop 19:** Cap Property Tax growth at 2% globally.

## **2.4 Extra Expense Planning**

- **Specific Planned Items:** "One-Off" capital outlays (Weddings, Renovations).
- **Long-Term Fun Money Rules:**

- **Rule-Based Input:** Annual budgets for "Fun Money" defined by 5-year age brackets starting at Age 65 (e.g., 65-69, 70-74...).
- **Age Context:** Display corresponding Calendar Years for these brackets.

## **2.5 Assets & Property Manager (New in v0.8)**

### **A. Asset Types & Rules**

The UI must list active accounts under their respective type boxes.

1. **401K / 403B:** Standard growth; funds deficits only after Inherited IRA is depleted.
2. **Joint Investment:** The "Cash Hub". Surpluses deposit here; deficits draw from here first.
3. **Cash Savings:** Liquid buffer.
4. **Inherited IRA:**

- **10-Year Rule:** Must be zero balance by the defined End Date.
- **Withdrawal Logic:**

- User defined annual % withdrawal schedule (January).
- **Override:** If the Financial Engine detects a cash shortfall in the Joint account, it *must* accelerate withdrawals from here *before* touching 401k assets.
- **Tax:** Withholding % applied before deposit to Joint account.
- **Final Year:** Auto-withdraw 100% of remaining balance.

1. **Property:**

- **Active Window:** Only counts toward Net Worth if Current Model Date is between Start Date and Optimal Sell Date.
- **Sale Event:** When Model Date == Sell Date:

- Sell Value = Projected Market Value.
- Costs = 6% Transaction Fee.
- Action = Pay off linked Mortgage/HELOC, deposit equity to Cash Savings.

- **Force Sale Rule:** If LTV > 50% (Age < 80) or > 60% (Age > 80), trigger immediate sale.

### **B. Property Valuation Algorithm**

- **Model:** Age-sensitive appreciation.
- **Phases:**

- **New:** Baseline Growth + New Home Addon (Years 1-5).
- **Mid:** Baseline Growth + Mid Age Addon (Years 6-20).
- **Mature:** Baseline Growth + Mature Addon (Year 21+).

- **Inputs:** Current Value, Build Year, Zip Code, Location Factor.

### **C. Future Purchase Submodules**

1. **New Construction Planner:**

- **Inputs:** Name, Location, Loan Estimates (auto-create Loan).
- **Cost Worksheet:** Base + Structural + Design + Lot - Credits.
- **Closing Calc:** (Price + Closing Costs) - Deposits.
- **Funding Source:** User specifies amounts from specific asset accounts (e.g., "$50k from Joint"). Engine executes these transfers on closing date.

1. **Home Purchase Planner:** Simplified "Price + Closing Costs" model.

## **2.6 Global Assumptions & Personal Data**

- **Global Rates:** Inflation (General, Medical, Tax Cap), Market Returns (Initial, Terminal, Taper Age).
- **Personal Data:** Birth Years for Person A and Person B to drive age-based calculations.

# **3. Financial Engine & Projections**

This module is the central calculation hub. It runs on "Save", "Recalculate", or "Export".

## **3.1 Cash Flow Waterfall (Deficit Rules)**

When Monthly Expenses > Monthly Income, cover shortfall in this order:

1. **Joint Investment Account** (until empty or min threshold).
2. **Inherited IRA** (Accelerated withdrawals).
3. **401k / 403B** (Standard withdrawals).
4. **Reverse Mortgage** (Last resort - Auto-Trigger).

## **3.2 Automated Logic Triggers**

- **Minimum Cash Threshold:** If Total Liquid Cash < Assumption (e.g., $200k):

- **Action:** Create/Draw from Reverse Mortgage Line of Credit.

- **Reverse Mortgage (R-HELOC):**

- **Creation:** Automatically created by the Engine if cash falls below threshold.
- **Terms:** 6% Interest (Adjustable).
- **Behavior:** Accrues interest, balance rises over time.
- **Visualization:** "Loans Module" must show this loan's projected balance vs. Home Value.

- **Forced Sale (Doomsday):** Triggered by LTV limits (see 2.5.A.5).

## **3.3 Output Data**

- **Exports:** The module must generate a 35-year (adjustable) dataset of Income, Expenses, Asset Balances, and Net Worth.
- **Event Logging:** The system must include an "Event Notes" field in the export that records significant auto-events (e.g., "Inherited IRA Depleted in 2032", "Reverse Mortgage Started in 2038").

# **Version History**

- **0.8 (Session 10):** Added Asset Registry, Property Valuation Algo, Inherited IRA complex withdrawals, Reverse Mortgage logic, and Construction Planners.
- **0.7 (Session 9):** Expense Overhaul: Added 35-year Projections, Long-Term "Fun Money" Rules, and integrated Loan Amortization Engine.
- **0.6 (Session 8):** Finalized Expense Categorization rules, CRUD for Impounds, Future Expense Submodule.
- **0.5:** Added Global Date Engine, Dynamic Navigation, Profile Manager rules.