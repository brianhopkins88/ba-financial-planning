# BA Financial Analysis – Requirements Specification

Version: **0.96** (Supersedes 0.95 – Incorporates Component-Based Engine Tracking, Bi-Directional Asset Visualization, and Annual Flow Logic.)

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
  1. User sets parameters in **Assumptions** and the various modules (Income, Expenses, Loans, Assets & Property).
  2. User runs **Cash Flow & Net Worth Projection** via the **Financial Engine**.
  3. User reviews:
     - Monthly and annual cash flow.
     - Asset/loan balances and net worth.
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
    - Income configurations.
    - Expense configurations (including Extra Expense & Fun Money rules).
    - Loans & Debt configurations.
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
      - Scenario input data (Assumptions, Income, Expenses, Loans, Assets & Property).
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
  - **Global actions:** Save, Export, Upload, Create Blank, Clear.
  - **Scenario selector:** Dropdown with:
    - Rename Scenario.
    - Clone Scenario.
    - Delete Scenario.
  - **Module links:**
    - Dashboard (summary views & charts).
    - Income.
    - Expenses (including Extra Expense Planning).
    - Loans & Debt.
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
  - **Profiles** are reusable configuration objects that capture parameter sets for one module or sub-module (for example, an Expense profile, Income profile, or Loan extra-principal payoff profile).
  - A Profile is **module-scoped** (e.g., Expense Profile vs Income Profile) but can be **reused across multiple Scenarios**.

- **Association to Scenarios:**
  - A Profile can be **linked** to one or more Scenarios (e.g., “Baseline Living Expenses 2025” reused in several Scenarios).
  - Within a Scenario, the user can:
    - Attach one or more Profiles to drive module behavior.
    - Duplicate an existing Profile as a starting point and then modify it.
    - Detach a Profile from the Scenario without deleting it from the global Profile workspace.
  - Within a Scenario, **module-scoped Profiles** (especially Expense Profiles) may be:
    - Attached once as a static configuration; or
    - Attached as a **time-phased sequence**, where each Profile includes a Start Date and the Engine selects the active profile for each period using the superseding logic described in **2.3.1**.

- **Persistence model (no backend):**
  - Because the application has no database backend, **Profiles are persisted via Scenario JSON exports/imports**.
  - On **export**:
    - The system must include **all Profiles** known to the app at that time, including:
      - Profiles currently linked to the active Scenario.
      - “Inactive” / unlinked Profiles that may be used in future Scenarios.
  - On **import**:
    - Profiles contained in the file are loaded into the app’s Profile workspace.
    - The user can then associate these Profiles with the current or newly created Scenario.

- **Editing and lifecycle:**
  - The UI should allow users to:
    - Create new Profiles from scratch.
    - Clone Profiles (within or across Scenarios) to create variants.
    - Rename and soft-delete Profiles (mark inactive) without immediately removing them from export.
  - Deleting a Profile should:
    - Remove it from the active Scenario’s configuration.
    - Optionally flag it as deleted so it is not re-exported unless explicitly restored.

---

## 2. Financial Modules

### 2.1 Loans & Debt Manager

- **Loan types:**
  1. **Mortgage** (linked to Property assets):
     - Mathematically a fixed-rate, fully amortizing loan.
     - Grouped separately in Expenses under “Mortgage & Impounds”.
  2. **Fixed-rate loans** (Auto, Personal, etc.):
     - Standard amortization.
  3. **Revolving loans** (HELOC, Credit Cards):
     - Interest is calculated on daily/monthly balance using a rate defined in Assumptions or at loan level.
  4. **Reverse Mortgage – Line of Credit (R-HELOC):**
     - A special **system-generated** loan type created when the **401k/403B account reaches its configured minimum balance** and other liquid assets are at minimums with remaining deficits.
     - Linked to a **property asset** (primary home).
     - See **Section 3.4 Reverse Mortgage Logic**.

- **Payoff profiles (strategies):**
  - Each loan can have one or more **payoff strategies**, including:
    - Base amortization (standard schedule).
    - Extra Principal payments (monthly grid).
  - **Drag-to-Fill:**
    - UI affordance to batch-fill Extra Principal values down a time grid.

- **Status & visibility:**
  - **Active toggle** for each loan (soft delete).
  - All **Active loans** surface in:
    - **Expenses** → “Other Loans” category summary; and
    - **Loans module** summary views and charts.
  - **Reverse Mortgage view:**
    - Expandable panel showing:
      - Projected start month/year.
      - Annual balance and interest.
      - Percentage of total home equity used.

### 2.2 Income Manager

- **Inputs / components:**
  - **Personal Data:**
    - Birth Year (Brian & Andrea).
    - **Birth Month** (Brian & Andrea): Used for Social Security proration.
  - **Base salary** (per person):
    - Stored as **net monthly income** (post-tax) or explicit gross + effective rate.
    - **Inflation Adjustment:** Base salary must increase annually by the **General Inflation** rate in Assumptions.
  - **Annual bonus:**
    - Net amount and payout month.
    - **Inflation Adjustment:** Bonus amount must increase annually by the **General Inflation** rate.
  - **Work status trajectory:**
    - 10+ year table of **FTE values** for each person (0.0–1.0).
    - Drives scaling of income and retirement contributions.
  - **Social Security:**
    - Configuration per person: **Start Age** and **Monthly Amount** (in today's dollars).
    - **Inflation:** Amount is adjusted annually by the **Social Security Inflation** rate (or General Inflation) until start, and during payout.
    - **First-Year Proration Rule:** In the year a person reaches Start Age, the benefit is prorated based on their **Birth Month**.
      - Formula: `AnnualBenefit * (12 - BirthMonth) / 12`.
  - **Pension (Andrea):**
    - **Start Trigger:** Automatically starts in the first year Andrea's **FTE = 0**.
    - Configuration: Monthly Amount and **Inflation Adjusted** toggle.
    - **Inflation:** If enabled, amount is adjusted for future value based on the start year.

- **Work-status tax schedule mappings:**
  - Defined as adjustable parameters in **Assumptions**.
  - **Effective tax rate** based on FTE states (Both Full, One Part, Both Retired, etc.).
  - Used for calculating net withdrawals from tax-deferred accounts (401k/IRA).

### 2.3 Expenses Manager

- **Projection behavior:**
  - Uses the **Financial Engine** so that expense projections are consistent with Net Worth & Cash Flow outputs.
  - **Charts:**
    - 35-year horizon (default), with configurable maximum horizon.
    - Expense bar chart with fixed y-axis scale (default $300k) and overflow indicators.

- **Categorization:**
  1. **Recurring Bills:** Utilities, subscriptions.
  2. **Mortgage & Impounds:** Property tax, homeowner’s insurance, active mortgage payments.
  3. **Home Expenses:** HOA, landscaping, maintenance.
  4. **Living Expenses:** Variable lifestyle spending.
  5. **Other Loans:** Aggregate monthly debt service from non-mortgage loans.

- **Key rules (parameters, not hard-coded):**
  - **Property tax growth:** Cap at **Prop 19 cap rate** (default 2%).
  - **Property insurance growth:** Use **Property Insurance Growth Rate** (default 5%).
  - **Medicare supplemental insurance:**
    - When **Brian is no longer working even part-time** (FTE = 0), add annual Medicare expense.
    - Grows at **Medical Inflation Rate**.

#### 2.3.1 Expense Profiles And Housing Transitions

- **Purpose:** Allow users to model **different spending patterns over time** (e.g., current home, interim apartment, new home) using time-phased profiles.
- **Activation logic:** The Engine selects the active Expense Profile based on the **Start Date**. New profiles supersede older ones.

### 2.4 Extra Expense Planning

- **Specific planned items:** One-off or irregular capital outlays (weddings, renovations, cars) with specific dates.
- **Long-term “Fun Money” rules:** Rule-driven annual budgets for discretionary spending by **age bracket** (e.g., 65–69, 70–74).

### 2.5 Assets & Property Manager

The UI displays each **asset type** as a card/box, listing its active accounts underneath.

#### 2.5.1 Shared Investment Return Algorithm (IARRA)

- **Inputs:** Global parameters for `initial_investment_return` (e.g., 7%), `final_investment_return` (e.g., 3.5%), and `taper_age`.
- **Logic:** Linearly interpolate the return rate from Initial to Final as the primary owner ages (e.g., from age 60 to 80).

#### 2.5.2 Asset Visualization Requirements (New in v0.96)

All asset projection charts must use a **Stacked Bar Chart** format to show the constituent components of the asset's value for each year.

1.  **Property Assets:**
    * **Positive Stack:**
        * **Net Equity (Green):** `Market Value - Total Linked Debt`.
        * **Linked Debt (Red):** The sum of balances for all loans linked to this property (e.g., Mortgage + HELOC).
    * **Goal:** User sees total bar height = Market Value, split between what they own vs. owe.

2.  **Liquid Assets (Cash, Joint, Retirement):**
    * **Bi-Directional Chart:**
        * **Positive Stack (Up):**
            * **Principal/Basis (Blue):** Net deposits (Deposits - Withdrawals).
            * **Accumulated Growth (Green):** Earnings/Interest over time.
        * **Negative Bar (Down):**
            * **Annual Withdrawals (Red):** Cash flow extracted from this asset during the year to cover expenses.
    * **Goal:** User sees clearly when and how much the asset is being drained to fund lifestyle (the "red ink").

3.  **Inherited IRA:**
    * **Positive Stack:**
        * **Remaining Balance (Green).**
        * **Cumulative Withdrawals (Orange):** The running total of all RMDs taken since the start.
    * **Goal:** Visualize the "Total Wealth" generated by the asset, even as the balance goes to zero.

#### 2.5.3 Joint Investment Account

- **Role:** Long-term taxable investment hub.
- **Rules:**
  - Receives surplus cash overflow.
  - Receives **after-tax proceeds** from Inherited IRA withdrawals.
  - Receives home sale proceeds.
  - Withdrawals taxed at **½ effective tax rate**.

#### 2.5.4 Inherited IRA Accounts

- **Inputs:**
  - **Date Received (Start Date):** e.g., 3/31/2023.
  - **Withdrawal Schedule:** A user-configurable table of **annual percentage withdrawals** for years 1–10.
  
- **Rules:**
  - **10-Year Rule:** Account must be zero by 10 years after its start date.
  - **Start Year Shift:** If the Date Received is after January 15, the "First Withdrawal Year" is the **next calendar year**.
  - **Mandatory Depletion:** In January of the 10th withdrawal year, the engine must force a 100% withdrawal of any remaining balance.
  - **Taxation (Progressive):** - Withdrawals > $600,000 taxed at 48%.
    - Withdrawals > $400,000 taxed at 40%.
    - Withdrawals > $200,000 taxed at 32%.
    - Withdrawals <= $200,000 taxed at base work-status rate (e.g. 25%).
  - **Destination:** After-tax proceeds are deposited into **Joint Investment**.
  - **Expense Coverage:** If cash flow deficit exists, engine may pull *extra* funds from IRA, taxed at standard rates.

#### 2.5.5 401K / 403B Accounts

- **Role:** Main tax-deferred retirement savings.
- **Growth:** Uses IARRA. Receives contributions while working (inflation-adjusted income * contrib %).
- **Withdrawal:** Used to cover shortfalls after liquid assets and IRA. Taxed at **full effective tax rate**.
- **Reverse Mortgage Trigger:** When balance hits `retirement_account_min_balance` and deficits persist, R-HELOC is triggered.

#### 2.5.6 Property Assets

- **Core fields:** Location, Value, Start Date, **Optional Sell Date**.
- **Linked Loans:** A property can be linked to **one or more** active loans (e.g., Primary Mortgage + HELOC).
- **Sale Events:**
  - Triggered by **Planned Sell Date** or **Reverse Mortgage LTV Limit**.
  - **Logic:**
    1. Calculate Market Value.
    2. Deduct Transaction Costs (6%).
    3. Pay off **all linked loans** and the **Reverse Mortgage**.
    4. Close the property and loan accounts (stop future payments).
    5. Deposit net equity into **Joint Investment** (or configured destination).

- **New Construction Planner:**
  - Submodule for planning future builds.
  - **Cash to Close:** Auto-deducts funds from specified assets on the **Close Date**.
  - **Activation:** Property becomes active in Net Worth on the Close Date.

---

### 2.6 Global Assumptions & Personal Data

- **Global rates:** General inflation, Medical inflation, Property tax cap, Property insurance growth, Reverse mortgage rate.
- **Projection horizon:** Default 35 years.
- **Tax & Thresholds:** Tax tiers, Cash minimums, Home equity destination.

---

## 3. Financial Engine & Projections

### 3.1 Timebase & Resolution

- **Hybrid time resolution:** Monthly for first 5 years, Annual thereafter.

### 3.2 Cash Flow Waterfall (Deficit Rules)

When **Expenses > Income**:
1. **Cash Savings** (down to min).
2. **Joint Investment** (down to min).
3. **Inherited IRA** (extra withdrawals).
4. **401k / 403B** (tax-deferred withdrawals).
5. **Reverse Mortgage (R-HELOC)** (if triggered).
6. **Post-Sale:** Remaining assets.
7. **Insolvency:** Log "Out of Money".

### 3.3 Income Inflation Rule

- **Rule:** The Financial Engine must apply the **General Inflation Rate** annually to:
  - Base Salary.
  - Annual Bonus.
  - Social Security (or SS-specific rate).
  - Pension (if inflation-adjusted).

### 3.4 Reverse Mortgage Logic (R-HELOC)

- **Trigger:** 401k at minimum + Liquid Assets depleted + Deficit exists.
- **LTV Limit (Forced Sale):**
  - Age < 70: 40% LTV.
  - 70–80: 50% LTV.
  - > 80: 60% LTV.
  - **Rule:** If R-HELOC balance >= (Home Value * 0.90 * LTV Limit), trigger **Forced Home Sale**.

### 3.5 Net Worth Calculation

- **Formula:** `(Cash + Joint + Inherited + Retirement + Property Value) - (Reverse Mortgage + All Active Loan Balances)`.

### 3.6 Component & Flow Tracking (New in v0.96)

The Financial Engine must track internal components of every asset to support detailed visualization:

1.  **Component Tracking (State):**
    * **Basis:** The portion of the asset balance derived from principal deposits (net of withdrawals).
    * **Growth:** The portion of the asset balance derived from investment returns or interest.
    * **Rule:** Withdrawals reduce Basis and Growth proportionally.

2.  **Annual Flow Tracking (Reset Yearly):**
    * **Annual Deposits:** Total inflow into the account for the current year.
    * **Annual Withdrawals:** Total outflow from the account for the current year.
    * **Annual Growth:** Total investment return credited for the current year.

---

## 4. Dashboard & Reporting

- **Drill-Down Data Table:**
  - A year-by-year tabular view showing:
    - Age (Brian/Andrea).
    - Total Income & Expenses.
    - Net Cash Flow.
    - Exact balances for Cash, Joint, Retirement, Property, and R-HELOC.
    - Net Worth.
- **Asset & Liability Curves:**
  - A multi-line chart showing the trajectory of individual assets vs. debt over time.
- **Mouse-Over Tooltips:**
  - Charts must display Year, **Brian’s Age**, **Andrea’s Age**, and precise values.
  - Stacked charts must display the breakdown of the stack (e.g., "Basis: $X, Growth: $Y").
- **Calculation Verification:**
  - Display a timestamp indicating when the simulation was last auto-calculated.

---

## 5. Version History

- **0.96:**
  - **Visualization:** Mandated Stacked Bar Charts for all assets.
  - **Charts:** Introduced Bi-Directional charts for liquid assets (showing withdrawals as negative bars).
  - **Engine:** Added requirements for Component Tracking (Basis vs Growth) and Annual Flow Tracking.
- **0.95:**
  - **Income:** Added Social Security proration, Pension auto-start, and explicit Income Inflation rules.
  - **IRA:** Added specific 10-year schedule, start-date shifting, and progressive tax tiers.
  - **Property:** Added support for multiple linked loans and clarified forced sale logic.
  - **Dashboard:** Added requirements for Drill Down Table and Asset/Liability curves.
  - **Engine:** Updated Net Worth formula to include debt subtraction.
- **0.91:**
  - Integrated time-phased Expense Profiles and housing transition model.
- **0.9:**
  - Introduced hybrid timebase, cash-flow waterfall, and IARRA.