# BA Financial Analysis - Requirements Specification

**Version:** 7.0 (Final Build Standard) **Date:** November 21, 2025 **Scope:** "Stay HGV" Scenario (Modules 1-4)

# 1. Architectural Requirements

## 1.1 Technology Stack

- **Framework:** React (Single Page Application).
- **Styling:** Tailwind CSS (Responsive, Clean UI).
- **Visualization:** Recharts (Composed Charts for Net Worth, Area Charts for Wealth).
- **Icons:** Lucide-React.
- **Environment:** Client-side logic; data loaded from `hgv_data.json`.

## 1.2 Data Management

- **Separation of Concerns:**
  - **Data Layer:** `hgv_data.json` (Single Source of Truth).
  - **Logic Layer:** Pure JavaScript functions (`financial_engine.js`) process the data.
  - **UI Layer:** React components render the output.
- **History & Snapshots:**
  - The app must store an array of "Snapshots" (Input configurations).
  - Users can "Save Current State" to local storage/history.
  - Users can "Restore" or "Compare" previous snapshots.

## 1.3 User Interface Standards

- **Navigation:** Persistent Sidebar (Dashboard, Loans, Cash Flow, Assets, Strategies).
- **Dual-View Tables:** All data grids must support toggling between **Monthly** (Granular) and **Annual** (Summary) views.
- **Inline Editing:** Key inputs (Work Status, Extra Payments, IRA %) must be editable directly in the tables.

# 2. Financial Modules (Logic Engine)

## Module 1: HGV Mortgage

- **Type:** Fixed Rate Amortization.
- **Input:** $801k Orig, 3.25%, 30 Years, Start Oct 2019.
- **Output:** Monthly Principal & Interest schedule.

## Module 2: HELOC Manager

- **Type:** Variable Line of Credit.
- **Input:** $160.2k Bal (Nov 2025), 8.25% Rate.
- **Logic:** User can input "Extra Principal" per month.
- **Constraint:** Minimum Payment ($1350) floor.

## Module 3: Cash Flow Engine

### 3.1 Income Logic

- **Active Income (Salary):**
  - **Input:** **NET Salary** (After-tax actuals).
  - **Tax Rule:** Do **NOT** apply tax rates to Salary inputs (user provides Net).
  - **Growth:** Net Salary grows by `Inflation Rate` annually.
  - **Work Status:** Year-by-year slider (0.0 to 1.0). `Projected_Income = Net_Salary * Work_Status`.
- **Passive Income (Taxable):**
  - **Inputs:** Social Security (Gross), Pension (Gross).
  - **Tax Rule:** Apply `Effective Tax Rate` to these streams.
  - **Growth:** Inflation adjusted.

### 3.2 Contributions & Validation

- **401k Contributions:**
  - **Input:** % of Gross Salary.
  - **Validation:** System must calculate `Contribution_Amount` and cap it at the `IRS_Limit` for that year.
  - **IRS Limit Growth:** The base limit ($30,000 incl catch-up) grows by `Inflation Rate` annually.

### 3.3 Expense Logic

- **Medical:** Grows by `Medical Inflation` (5%).
- **Property Tax:** Grows by `Prop Tax Cap` (2%).
- **General:** Grows by `CPI` (2.5%).
- **Net Flow:** `(Net Income) - (Total Expenses)`.

# 3. Module 4: Net Worth & Strategy Engine (The "Brain")

## 3.1 Asset Behavior

- **Joint Account (The Hub):**
  - Receives all income surpluses.
  - First source of deficit funding.
  - **Growth:** Tapers linearly from `Initial Rate` (7%) to `Terminal Rate` (3.5%) by Age 85.
- **Retirement Accounts:**
  - Grow tax-deferred until withdrawn.

## 3.2 The "Annual & Quarterly" Cycle

The simulation runs monthly, but triggers specific events at specific intervals:

**Step 1: January - Mandatory Actions**

1. **Inherited IRA Withdrawal:**
   - **Input:** User defines % withdrawal for the year (e.g., 10% in 2026).
   - **Action:** `Withdrawal = Balance * %`.
2. **Required Minimum Distributions (RMDs):**
   - **Trigger:** User Age >= 75.
   - **Calculation:** `RMD = 401k_Balance / Life_Expectancy_Factor` (Uniform Lifetime Table).
   - **Action:** `Total_Mandatory = Inherited_Withdrawal + RMD`.
   - **Tax & Deposit:** Apply taxes to `Total_Mandatory`. Net proceeds go to **Joint Account**.

**Step 2: Quarterly - Liquidity Buffer Check (Mar, Jun, Sep, Dec)**

- **Target Calculation:** `Target = $50,000 + (Next 3 Months Projected Expenses)`.
- **Check:** If `Joint_Balance < Target`:
  1. Calculate `Shortfall`.
  2. **Withdraw Source:**
     - First: Remaining **Inherited IRA** (if any).
     - Second: **401k/403b**.
  3. **Tax Gross-Up:** Withdraw enough to cover Shortfall *after* taxes.
  4. **Deposit:** Net proceeds go to Joint Account.

## 3.3 Solvency Safety Nets (The Waterfall)

**Trigger A: Reverse Mortgage (Income Floor)**

- **Condition:** If `Total Retirement Bal < (Next 12 Months Expenses)`.
- **Action:** Stop 401k withdrawals. Fund Shortfall via Reverse Mortgage.
- **Cost:** Loan Balance grows at `Reverse Rate`.

**Trigger B: Liquidation (The Nuclear Option)**

- **Condition:** If `(Reverse Mtg Bal + Mortgage + HELOC) > (66% of Home Value)`.
- **Action:**
  1. Sell Home (Market Value).
  2. Pay off all debts.
  3. Deposit proceeds to Joint Account.
  4. Switch Housing Expense to Rent.

## 3.4 Tax Tapering Rules

The `Effective Tax Rate` applied to **Passive Income** and **Withdrawals** (NOT Salary):

- **30%:** Both Working (Status > 0.9).
- **25%:** One Part-Time/Retired.
- **20%:** Both Retired (Pre-SS).
- **17%:** Both Retired (Post-SS).