# BA Financial Analysis - Requirements Specification

**Version:** 8.0 (Scenario & Loans Complete)
**Date:** November 23, 2025
**Scope:** "Stay HGV" Scenario + Scenario Management + Advanced Debt Logic

# 1. System Capabilities & Navigation

## 1.1 Scenario Management (New)
- **Data Structure:** All data belongs to a specific "Scenario."
- **Default Scenario:** "Current Home HGV".
- **Naming Convention:** The system must automatically append the "Month Year" of the data date to the display name (e.g., "Current Home HGV - Nov 2025").
- **Scenario Actions:**
  - **Selector:** A dropdown in the Sidebar to switch between saved scenarios.
  - **Create New:** User can define a name; system clones current state to a new ID.
  - **Save:** Updates are persisted to the active scenario immediately (or on blur).

## 1.2 Global Interface Standards
- **Date Awareness:**
  - Every view must display a "Data as of: [Date]" header.
  - This date represents the `lastUpdated` timestamp of the active scenario.
- **Navigation Menu:**
  1.  **Dashboard:** High-level metrics (Net Worth, Liquidity).
  2.  **Expenses:** (New) Categorized monthly obligations.
  3.  **Loans:** (New) Advanced debt management and payoff modeling.
  4.  **Assumptions:** (Refactored) Income, Assets, and Global Rates only.
  5.  **Strategies:** (Future) RMDs and Solvency Waterfalls.

---

# 2. Financial Modules

## Module 1: Expenses Manager (New)
- **Concept:** Granular tracking of monthly outflows, distinct from the "General Living" lump sum.
- **Categorization:**
  - **Bills:** Recurring fixed costs (Utilities, Subs, Insurance).
    - *Subcategories:* Security, Internet, Cable, Water, Electric, Gas, Car Ins, Cell, Trash, Pet Ins, Subscriptions.
  - **Home:** Property-related fixed costs.
    - *Subcategories:* Property Tax, Home Insurance, HOA.
  - **Living:** Variable lifestyle costs.
    - *Subcategories:* General Living (Groceries/Dining), Landscaping/Housekeeping, Annual Fees (amortized).
  - **Loans:** Read-Only summary.
    - *Logic:* Aggregates the monthly payments defined in **Module 2**. Users cannot edit loan payments here; they must go to the Loans module.

## Module 2: Loans & Debt Strategies (New)
- **Concept:** A dedicated engine for modeling debt payoff with "Sub-scenarios" for extra payments.

### 2.1 Fixed Rate Loans (Mortgage)
- **Inputs:** Loan Name, Origination Date, Original Principal, Current Principal, Interest Rate, Required Monthly Payment.
- **Amortization Engine:**
  - Calculate monthly Interest/Principal schedule.
  - **Highlight:** Visually indicate the row corresponding to the Current Date.
- **Payoff Strategy (Sub-scenarios):**
  - Users can create named "Payment Strategies" (e.g., "Aggressive Payoff", "Standard").
  - **Input:** Users enter "Extra Principal Payment" into specific months in the amortization table.
  - **Output:** Recalculate "Payoff Date" and "Total Interest Saved" dynamically.

### 2.2 Revolving Loans (HELOC)
- **Inputs:** Current Balance, Interest Rate, Planned Minimum Payment.
- **Simulation Engine:**
  - Calculate Interest = `Balance * (Rate / 12)`.
  - Calculate Principal Paid = `Payment - Interest`.
  - Project forward until Balance = 0.
- **Payoff Strategy:**
  - Similar to Fixed loans, allow named strategies to inject extra payments in specific months to see the impact on payoff time.

---

## Module 3: Income & Assets (Refactored Assumptions)

### 3.1 Income Logic
- **Active Income:** Net Salary inputs (Tax logic bypassed for Salary).
- **Work Status:** Year-by-Year slider (0.0 to 1.0) impacting Salary.
- **Passive Income:** SS/Pension (Gross) - subject to Tax Tiers.

### 3.2 Asset Logic
- **Joint Account:** The "Hub" for surplus/deficits.
- **Retirement Accounts:** 401k/IRA balances growing at market rates.
- **Property Value:** Grows by inflation; crucial for LTV calculations in Module 4.

---

## Module 4: Net Worth & Solvency (The "Brain")
*Note: This runs 'behind the scenes' to power the Dashboard.*

### 4.1 The Cash Flow Waterfall
1.  **Income Inflow:** Salary + Bonus + Passive.
2.  **Mandatory Outflow:** Expenses (Module 1) + Loan Payments (Module 2).
3.  **Net Result:**
    - *Surplus:* Adds to Joint Account.
    - *Deficit:* Triggers Withdrawal Logic.

### 4.2 Withdrawal Logic (Deficit Funding)
1.  **Liquidity Buffer Check:** Ensure Joint Account > Target ($50k).
2.  **Source Order:**
    - 1st: Inherited IRA (until depleted).
    - 2nd: 401k/403b (Tax Gross-up applied).

### 4.3 Solvency Triggers
- **Reverse Mortgage:** Triggered if Retirement Balances are critical.
- **Liquidation:** Triggered if LTV > 66% (Sell Home, Rent).