# BA Financial Analysis – Requirements Specification

Version: **0.91**  
(Supersedes 0.9 – incorporates updated cash-flow logic, investment tapering, tax rules, reverse-mortgage behavior, and housing transition/new-construction enhancements.)

Date: **November 29th, 2025**

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
  - **Base salary** (per person):
    - For Person A (Brian) and Person B (Andrea).
    - Stored as **net monthly income** (post-tax) or explicit gross + effective rate (configurable per design, but tax modeling for withdrawals uses Assumptions schedule).
  - **Annual bonus:**
    - Net amount.
    - Payout month.
  - **Work status trajectory:**
    - 10-year table of **FTE values** for each person (0.0–1.0).
    - Drives scaling of income and retirement contributions while working (even part-time).
  - **Work-status tax schedule mappings:**
    - Defined as adjustable parameters in **Assumptions** and used by the Financial Engine.
    - Encoded states based on Brian/Andrea FTE values:
      - **Both full-time:** Brian FTE = 1 AND Andrea FTE = 1.
      - **Either part-time:** (Brian FTE < 1 OR Andrea FTE < 1) and at least one FTE = 1.
      - **Both part-time:** Brian FTE < 1 AND Andrea FTE < 1 AND both > 0.
      - **One part-time (other retired):** One FTE = 0, the other 0 < FTE < 1.
      - **Both retired:** Brian FTE = 0 AND Andrea FTE = 0.
    - Each state maps to an **effective tax rate** parameter in Assumptions:
      - Both working full-time: default 32%.
      - Either working part-time: default 27%.
      - Both working part-time: default 25%.
      - Both retired: default 20%.

- **Profile management:**
  - Time-phased income profiles support “mix-and-match” for different scenarios (e.g., “Brian Retires 2030”, “Andrea 60% FTE 2027–2030”).

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
  - **Property tax growth:**
    - Cap at **Prop 19 cap rate** defined in Assumptions (default 2% per year on assessed value).
  - **Property insurance growth:**
    - No Prop 19 cap.
    - Use **Property Insurance Growth Rate** parameter in Assumptions (default 5% per year).
  - **Medicare supplemental insurance:**
    - When **Brian is no longer working even part-time** (Brian FTE = 0 across all income sources, regardless of Andrea’s status):
      - Add an annual **Medicare supplemental insurance expense** line item.
      - Default initial annual amount: $6,000 (parameter in Assumptions or Expense profile).
      - Increase annually using **Medical Inflation Rate** parameter (default 5%).

#### 2.3.1 Expense Profiles And Housing Transitions

- **Purpose:**
  - Allow users to model **different spending patterns over time** (e.g., current home, interim apartment, new home) using time-phased profiles.

- **Profile structure:**
  - Each **Expense Profile** includes:
    - Name and description.
    - Category allocations and growth rules (as defined in 2.3).
    - A required **Start Date (Month/Year)** indicating when this profile becomes active in the Scenario.
    - Optional **End Date** (future enhancement; for now, profiles can be superseded by a later profile’s Start Date).

- **Activation logic (per Scenario):**
  - A Scenario may have **multiple Expense Profiles** attached.
  - For each projection period:
    - The Financial Engine determines the **active Expense Profile** as the one with the **latest Start Date ≤ current period date**.
    - When a new profile’s Start Date is reached, it **supersedes** the previously active profile for all subsequent periods.
  - Example:
    - Profile A: “Current Home Expenses”, Start 01/2025.
    - Profile B: “Apartment While New Home Builds”, Start 07/2028.
    - Profile C: “New Home Expenses”, Start 03/2029.
    - From 01/2025–06/2028 → Profile A is active.
    - From 07/2028–02/2029 → Profile B is active.
    - From 03/2029 onward → Profile C is active.

- **Use case: New construction housing transition**
  - Users model:
    - **Current home** period with one Expense Profile.
    - An **interim rental/apartment** period after selling the current home but before the new build closes.
    - A **new home** period after close.
  - The Engine automatically switches profiles based on their Start Dates, aligning expense patterns with property sale and purchase events.

### 2.4 Extra Expense Planning

- **Specific planned items:**
  - One-off or irregular capital outlays:
    - Examples: weddings, home renovations, large trips, new vehicle, etc.
  - Each item specifies:
    - Name, category, amount, and date (month/year).

- **Long-term “Fun Money” rules:**
  - Rule-driven annual budgets for discretionary spending by **age bracket**.
  - Configurable 5-year brackets starting at age 65 (e.g., 65–69, 70–74, etc.).
  - For each bracket:
    - Annual “Fun Money” budget parameter.
    - UI must show the corresponding calendar year ranges given each person’s birth year.

### 2.5 Assets & Property Manager

The UI displays each **asset type** as a card/box, listing its active accounts underneath.

- **Asset types:**
  1. **401K / 403B accounts**.
  2. **Joint Investment accounts**.
  3. **Cash Savings accounts** (primary cash reserve).
  4. **Inherited IRA accounts**.
  5. **Property assets** (primary home; assume one property at any given time).

#### 2.5.1 Shared Investment Return Algorithm (IARRA)

All investment assets (Inherited IRA, 401k/403B, Joint Investment; optionally Cash Savings if modeled as money market) use a common **Investment Account Risk Reduction Algorithm** with scenario-level parameters stored in **Assumptions**.

- **Inputs (per account, per year):**
  - Current balance.
  - Owner age(s) at the start of year.
  - Global parameters:
    - `initial_investment_return` (default 7%).
    - `final_investment_return` (default 3.5%).
    - `taper_age` (default 80).

- **Logic:**
  1. Determine **effective age** for tapering:
     - Use Brian’s age or a configurable “primary planning age” parameter.
  2. For each projection year:
     - If age ≤ current year’s age at scenario start: use `initial_investment_return`.
     - If age ≥ `taper_age`: use `final_investment_return`.
     - For ages between start and `taper_age`, linearly interpolate the rate from initial to final.
  3. Apply interest/returns at the chosen rate for that period:
     - Allow choice of **compounding frequency** parameter (monthly or annual); default monthly.

- **Output:**
  - Annual (and internally monthly) balances for each account.

> Note: Return parameters must be editable in **Assumptions** and not hard-coded.

#### 2.5.2 Cash Savings Account

- **Role:**
  - Main **liquid buffer** and receipt of excess income.
  - Modeled as money-market-like account with low risk.

- **Parameters:**
  - `cash_savings_min_by_age_bracket`: table in Assumptions.
    - Default example:
      - Age < 65: minimum $15,000.
      - Age ≥ 65: minimum $30,000.
  - `cash_savings_max`: maximum buffer threshold (default $30,000) used for automatic transfers to Joint Investment.
  - `cash_savings_interest_rate`: default equal to general inflation or a separate parameter.

- **Deposit & withdrawal rules:**
  1. **Excess income:**
     - For each period (monthly for first 5 years, annual thereafter):
       - If **Income > Expenses**, the surplus is deposited to **Cash Savings** up to `cash_savings_max` for that period’s age bracket.
       - Any remaining surplus above `cash_savings_max` is deposited to the **Joint Investment** account.
  2. **Covering deficits:**
     - When **Expenses > Income**, the waterfall uses Cash Savings first:
       - Withdraw from Cash Savings down to `cash_savings_min_by_age_bracket` for the current age.
       - If additional cash is still needed, move to Joint Investment (see 2.5.3 and Section 3.2).

#### 2.5.3 Joint Investment Account

- **Role:**
  - Main **long-term investment hub** for taxable investments.
  - Receives surplus cash once Cash Savings hits its configured maximum.
  - Receives **after-tax proceeds** from Inherited IRA scheduled withdrawals.
  - Receives home sale proceeds after debts are cleared.

- **Parameters:**
  - `joint_investment_min_balance`: minimum balance threshold (Assumptions).
  - Uses **IARRA** for investment growth.

- **Tax rules for withdrawals:**
  - When funds are withdrawn from **Joint Investment** to cover living expenses:
    - Apply tax withholding at **half of the current effective tax rate** based on work status.
    - Example:
      - Work-status effective tax = 20% (retired) ⇒ Joint withdrawal tax = 10%.
    - Withholding uses the same work-status tax mapping defined in Income/Assumptions.

- **Deficit behavior:**
  - If Expenses > Income after using Cash Savings down to its minimum:
    - Withdraw from Joint Investment down to `joint_investment_min_balance`, applying ½ effective tax.
  - If Joint falls below its minimum, the waterfall proceeds to Inherited IRA (see 2.5.4, 3.2).

#### 2.5.4 Inherited IRA Accounts

- **Inputs:**
  - Start date (month/year).
  - End date (month/year) such that **End = Start + 10 years**.
  - Current balance and last valuation date.
  - User-defined **annual percentage withdrawal schedule**:
    - Percentage of **account value each January**.

- **Constraints and rules:**
  - **10-year rule:**
    - Account **must be zero** by 10 years after its start date.
  - **Minimum annual withdrawal:**
    - At least **10% of the starting balance** (or current balance, depending on spec; parameterized) must be withdrawn each year across scheduled + extra withdrawals.
    - Minimum % is parameterized but default 10%.
  - **Growth:**
    - Balance grows using the **IARRA**.

- **Scheduled withdrawals:**
  - Each January:
    1. Estimate the current balance after growth.
    2. Apply the user-specified **percentage withdrawal**.
    3. Calculate tax withholding using **same effective tax rate schedule as 401k/403B**, based on current work status (not a fixed 32%).
    4. Subtract gross withdrawal from Inherited IRA balance.
    5. Deposit the **after-tax** amount into **Joint Investment**.

- **Extra withdrawals:**
  - If the **Financial Engine** determines additional cash is needed beyond Cash Savings + Joint (down to their minimums):
    - It may schedule **additional withdrawals** from the Inherited IRA earlier in the 10-year window, using the same tax rules.
    - These extra withdrawals must respect the 10-year “zero balance” constraint and may reduce or eliminate the final planned withdrawal.
    - Example: Extra withdrawals in years 8–9 may fully deplete the account so that year 10 withdrawal is zero.

- **Final year behavior:**
  - In the final allowed year of the 10-year window (by March of that year or configurable date):
    - Automatically withdraw **100% of any remaining balance**.
    - Apply taxes at current work-status rate.
    - Deposit after-tax amount into Joint Investment.

#### 2.5.5 401K / 403B Accounts

- **Role:**
  - Main tax-deferred **retirement savings account**.
  - Used to cover expense shortfalls **after**:
    - Inherited IRA is depleted.
    - Cash Savings at minimum.
    - Joint Investment at minimum.

- **Growth:**
  - Uses **IARRA** for investment returns.
  - Also increases via ongoing **contributions while either person is working**:
    - For each working period:
      1. Project gross income to that period using **inflation** (or a specific salary growth parameter).
      2. Apply a **contribution percentage** defined in the Income module (per person, per period).
      3. Multiply by each person’s FTE to scale contributions when part-time.
      4. Add contributions to the 401k/403B balance.

- **Minimum balance and reverse-mortgage trigger:**
  - Assumptions define `retirement_account_min_balance` (default example: $300,000; adjustable).
  - When the **401k/403B balance hits this minimum**, it:
    - Continues to grow using IARRA.
    - Is available as a **last-resort source** in late-stage waterfall after other assets.
    - Triggers creation of a **Reverse Mortgage Line of Credit** (see 3.4) to cover future deficits.

- **Withdrawal logic:**
  - When used to cover deficits (after other assets):
    - Withdrawals are taxed at the **full effective tax rate** based on work status at that time.
    - After-tax proceeds cover expenses.

#### 2.5.6 Property Assets

- **Assumption (for now):**
  - Only one **primary property asset** (home) will be active in a Scenario at any point in time.

- **Core fields:**
  - Name, location, ZIP code.
  - Build year.
  - Current estimated value.
  - Start date (defaults to Scenario start date; adjustable).
  - **Optimal Sell Date** (optional; month/year).
  - Link to associated **mortgage loan** and any **reverse mortgage**.

- **Active window:**
  - Property is included in Net Worth only if **Current Model Date** is between **Start Date** and **Sell Date**.
  - If **no Sell Date** is provided, property is modeled through the end of the projection horizon **or** until a **forced sale** event occurs (reverse mortgage LTV trigger).

- **Housing transitions and non-owner periods:**
  - The system supports a **single active primary property** at any given time, but users may:
    - Schedule a **sale** of the current property at a specific date.
    - Schedule a **new property** (e.g., new construction) to start at a later date.
  - Any periods between sale and new-property start (e.g., living in an apartment) are represented solely via **Expense Profiles** (see 2.3.1) with no active property asset.

- **Value projection:**
  - Use the **Home Value Projection algorithm** (see below) defined at Scenario level with per-property inputs.

- **Sale events:**
  - A **property sale** can be triggered by:
    1. Reaching the **user-defined Sell Date**.
    2. A **Reverse Mortgage Home Sale Event** (LTV trigger; see 3.5).
  - On sale:
    1. Compute **Sell Value** = projected market value.
    2. Subtract transaction costs at a parameterized rate (default 6%).
    3. Pay off any **linked mortgage** and **reverse mortgage** balances.
    4. Deposit remaining net equity according to the rules in **3.5 Home Sale Events**.
    5. Mark the property as **inactive/sold** for all subsequent periods.

- **Home value projection algorithm (nominal, non-inflation-adjusted):**
  - Inputs (Scenario/Assumptions):
    - `macro_baseline_growth` (default 0.02).
    - `new_home_years` (default 5).
    - `mid_age_years` (default 15).
    - `new_home_addon` (default 0.015).
    - `mid_age_addon` (default 0.007).
    - `mature_age_addon` (default 0.0).
    - `location_factor` (default 0.0).
    - `min_growth` (default 0.0).
    - `max_growth` (default 0.04).
  - Per property inputs:
    - Current value, build year, current year, ZIP code, horizon years.
  - Processing (per year t):
    1. Compute home age at each future year.
    2. Bucket as **new**, **mid**, or **mature** based on age thresholds.
    3. Assign base growth rate per bucket = `macro_baseline_growth + addon`.
    4. Apply `location_factor` (and any additional scenario adjustments).
    5. Clamp to `[min_growth, max_growth]`.
    6. Compute annual values recursively: `value[t] = value[t-1] * (1 + growth[t])`.

- **New Construction Planner submodule:**
  - Captures planning for a **future new-build home** whose **start date is in the future**.
  - Views:
    1. **Project details:**
       - Name, location, estimated **contract date** (deposit), estimated **close date** (cash at close), associated property asset.
    2. **Total purchase price planner:**
       - Base new home cost.
       - Structural upgrades cost.
       - Design upgrades cost.
       - Design credits (negative line items).
       - Lot premium.
       - Button to define additional cost lines.
    3. **Closing cost estimator:**
       - Editable list of common closing costs (escrow, title, recording fees, etc.).
       - Prepaid costs: interest, property taxes, insurance, etc.
    4. **Deposits:**
       - Initial contract deposit (default 30,000; parameterized, editable).
       - Design deposit calculated as % of design upgrades cost (percentage parameter, editable).
    5. **Cash to close worksheet:**
       - Calculation: `(Total Price + Closing Costs) – Total Deposits Paid`.
       - **Funding modes:**
         - **Explicit mode:** For each line item, user specifies:
           - Amount.
           - Source asset (Cash Savings, Joint, Inherited IRA, 401k/403B, etc.).
         - **Auto mode:** If explicit allocations are omitted, the Engine uses a default funding order:
           - Cash Savings → Joint Investment → Inherited IRA → 401k/403B.
       - The Financial Engine must execute these withdrawals on **contract date and/or close date**, applying tax rules for tax-deferred accounts (Inherited IRA, 401k/403B).
    6. **Loan integration:**
       - Inputs for estimated loan amount, term, interest rate.
       - Button to **create this loan** in Loans module.
       - Reminder to create/update property tax and insurance profiles in Expenses (impounds).
    7. **Timeline integration:**
       - The Planner must support and align:
         - **Contract date** events (deposits).
         - **Close date** events (cash to close + loan creation).
       - The new property’s **Start Date** is the close date, from which point the property becomes active in Net Worth.
       - Any **scheduled sale** of the existing home may occur before, on, or after the close date (user-defined).
    8. **Interaction with Expense Profiles:**
       - The UI should recommend that users define or attach:
         - A **current-home Expense Profile** active until the sale date.
         - An **interim apartment/rental Expense Profile** for any gap between sale and new-home close.
         - A **new-home Expense Profile** starting on or shortly after the new-home close date.
       - Expense Profile Start Dates should be aligned with:
         - Property sale date (transition off current-home profile).
         - New-home close date (transition onto new-home profile).

- **Home Purchase Planner submodule:**
  - Simplified planner for **non-new-construction** purchases:
    - Focus on **Price + Closing Costs**.
    - All cash required at close (no complex deposit schedule).
    - Funding logic:
      - Specify amounts to pull from specific asset accounts at close **or** allow Auto mode using the same default funding order:
        - Cash Savings → Joint Investment → Inherited IRA → 401k/403B.
      - Engine executes withdrawals (with proper tax rules) on close date.

---

### 2.6 Global Assumptions & Personal Data

- **Personal data:**
  - Birth years for Brian and Andrea.
  - Scenario start month/year.

- **Global rates (all adjustable, no hard-coding):**
  - General inflation.
  - Medical inflation.
  - Property tax cap (Prop 19 cap).
  - Property insurance growth rate.
  - Reverse mortgage interest rate.
  - Investment return parameters (IARRA): initial rate, final rate, taper age.

- **Cash & account thresholds:**
  - Cash Savings `min` by age bracket and `max` buffer.
  - Joint Investment minimum.
  - 401k/403B minimum (for reverse mortgage trigger).
  - `home_sale_equity_destination`:
    - Enum defining where **net sale equity** is initially deposited:
      - `"Joint"` (default) – deposit all net equity into Joint Investment.
      - `"CashThenJoint"` – deposit equity into Cash Savings up to `cash_savings_max`, then deposit any remainder into Joint Investment.

- **Tax schedule parameters:**
  - Effective tax rates mapped to work-status states (see 2.2).
  - Rules for:
    - 401k/403B & Inherited IRA withdrawals: taxed at **full effective rate**.
    - Joint withdrawals: taxed at **½ effective rate**.

- **Projection horizon:**
  - Default 35 years (Brian’s age + 35 defines end of life for planning).
  - Adjustable per scenario.

#### 2.6.1 Global Assumptions Library And Scenario Snapshots

- **Global Assumptions Library:**
  - The application maintains a **Global Assumptions Library** that stores the current default values for all assumption parameters listed above.
  - Changes to the Global Assumptions Library affect **new Scenarios** and any existing Scenarios that the user explicitly chooses to update, but do not automatically retroactively alter existing Scenario snapshots.

- **Per-Scenario Assumptions snapshot:**
  - Each Scenario stores a **frozen snapshot** of the assumptions in effect for that Scenario.
  - All Financial Engine calculations for that Scenario must use the Scenario’s snapshot, not the current global defaults.
  - The snapshot is included in Scenario JSON exports so that results are reproducible when re-imported later.

- **Scenario creation and cloning:**
  - When a new Scenario is created (or an existing Scenario is cloned), its Assumptions snapshot is initialized from the **current Global Assumptions**.
  - Subsequent edits to the Scenario’s assumptions affect only that Scenario unless the user explicitly chooses to push or pull changes to/from the Global Assumptions Library (future enhancement).

- **Import behavior:**
  - When importing a Scenario JSON file, the system must:
    - Load the file’s Assumptions snapshot; and then
    - Prompt the user to choose between:
      - **Use imported assumptions:** Keep and use the assumptions contained in the JSON as the Scenario’s snapshot; or
      - **Use current Global Assumptions:** Overwrite the imported assumptions with the current Global Assumptions before running calculations.
  - After the user’s choice is applied, the Scenario’s snapshot is treated as authoritative for all subsequent calculations.

- **Recalculate on assumption changes and import:**
  - When a Scenario is imported and the assumptions choice is resolved, the system must automatically run a full **Recalculate**.
  - When key assumptions are modified within a Scenario, the UI should either:
    - Trigger an immediate recalculation, or
    - Mark projections as **stale** and prompt the user to click Recalculate; behavior can be defined at implementation time but must be consistent across modules.

---

## 3. Financial Engine & Projections

The **Financial Engine** is the central calculation hub for:

- Cash flow (income vs. expenses).
- Asset and liability balances.
- Net worth.
- Event logging.

It runs on **Recalculate**, **Save**, and **Export** operations.

### 3.1 Timebase & Resolution

- **Hybrid time resolution:**
  - **First 5 years** from Scenario Start Date:
    - Project and store data **monthly**.
  - **After year 5 through end of horizon:**
    - Project and store data **annually**, with internal monthly precision if needed for accuracy (implementation choice).

- **Outputs:**
  - Monthly records for years 1–5 (for detailed near-term planning and drill-down views).
  - Annual summary records for years 6–Horizon.

### 3.2 Cash Flow Waterfall (Deficit Rules)

When **Expenses > Income** for a period, cover the shortfall in this order:

1. **Cash Savings Account**
   - Withdraw down to the age-appropriate minimum (`cash_savings_min_by_age_bracket`).

2. **Joint Investment Account**
   - Withdraw down to `joint_investment_min_balance`.
   - Apply **½ effective tax rate** according to current work status.

3. **Inherited IRA**
   - After Cash Savings and Joint at their minimums, additional deficits are covered by **extra withdrawals** from Inherited IRA:
     - On top of the planned January percentage withdrawals.
     - Taxed at **full effective rate**, same as 401k/403B.
     - Must still respect:
       - 10-year depletion rule.
       - Minimum annual withdrawal rule.

4. **401k / 403B Accounts**
   - Once Inherited IRA is depleted and liquid taxable assets at minimums:
     - Cover deficits with withdrawals from 401k/403B.
     - Withdrawals taxed at **full effective rate** based on work status.

5. **Reverse Mortgage Line of Credit (R-HELOC)**
   - When 401k/403B balance reaches its configured minimum, other liquid assets are at minimums, and deficits still exist, the engine:
     - Creates or draws from a **Reverse Mortgage Line of Credit** attached to the primary property (see 3.4).
     - Uses R-HELOC withdrawals to cover deficits, adding interest each period.

6. **Post-Sale Late-Stage Spending Order** (After property is sold)
   - Following a home sale event and deposit of remaining equity (per **3.5**):
     1. Spend down **remaining 401k/403B balance** (previously held at minimum), taxed at full rate.
     2. Then spend down **Joint Investment** with **no tax withholding** (assumes low-risk, low-yield positioning late in life).
     3. Finally, use any residual **Cash Savings**.

7. **Out-of-Money End State**
   - When **all accounts** (Cash, Joint, Inherited IRA, 401k/403B, Reverse Mortgage capacity, and home equity) are exhausted and expenses cannot be met:
     - Stop projection.
     - Log an **“Out of Money” event** with:
       - Brian and Andrea ages.
       - Calendar year and month (or year if annual).
       - Remaining horizon gap (years/months short of planned end of life).

### 3.3 Surplus Flow Rules (Income > Expenses)

- For each period where **Income > Expenses**:
  1. Deposit surplus into **Cash Savings** until it reaches `cash_savings_max` for that age bracket.
  2. Deposit any remaining surplus into **Joint Investment**.

### 3.4 Reverse Mortgage Logic (R-HELOC)

- **Trigger condition:**
  - When the **401k/403B balance** reaches its **minimum threshold** defined in Assumptions and other liquid assets (Cash Savings, Joint Investment) are at minimums with a remaining deficit.
  - On trigger:
    - Create a **Reverse Mortgage Line of Credit** (if not already existing) linked to the primary property.

- **Loan-to-Value ratio (LTVR) by Brian’s age:**
  - Age < 70: LTVR = 40%.
  - 70 ≤ Age ≤ 80: LTVR = 50%.
  - Age > 80: LTVR = 60%.
  - All treated as **parameters** in Assumptions, not hard-coded.

- **Loan max calculation:**
  - At creation or recalculation:
    - `max_loan_amount = property_value * 0.90 * LTVR`.
      - The 0.90 factor (90%) is a parameter modeling conservative lender valuation.

- **Existing loan payoff:**
  - If the property has an associated mortgage or HELOC:
    - Immediately compute the payoff amount.
    - Increase R-HELOC balance by this payoff amount.
    - Set associated mortgage/HELOC balance to **zero**.
  - This effectively **refinances** existing debt into the reverse mortgage.

- **Initial line of credit:**
  - The **available line** is `max_loan_amount – current_R-HELOC_balance`.

- **Annual operation:**
  - After 401k/403B is at minimum and still in the waterfall path:
    - For any remaining expense deficit in a period:
      - Increase R-HELOC balance by the **withdrawal amount**.
      - Add interest on previous balance using reverse mortgage rate parameter (default 6%).

- **Home sale trigger:**
  - When **R-HELOC balance** reaches the **max loan amount** (i.e., LTVR limit), the engine triggers a **Home Sale Event** (see 3.5).
  - When such a Home Sale Event occurs, net equity is deposited according to `home_sale_equity_destination` (see 3.5) and the post-sale late-stage spending order in 3.2 applies.

### 3.5 Home Sale Events

When a Home Sale Event is triggered (either by scheduled Sell Date or Reverse Mortgage LTV limit):

1. **Determine sale value:**
   - Use projected property value at the event period.
2. **Apply transaction costs:**
   - Multiply by `(1 – transaction_cost_rate)` with default 6% (parameterized).
3. **Pay off debts:**
   - Pay off all **linked loans** (mortgage and R-HELOC) using sale proceeds.
4. **Deposit equity:**
   - Determine deposit destination based on `home_sale_equity_destination`:
     - If `"Joint"`:
       - Deposit all remaining net equity into **Joint Investment**.
     - If `"CashThenJoint"`:
       - Deposit net equity into **Cash Savings** up to `cash_savings_max` for the current age bracket, then deposit any remainder into **Joint Investment**.
5. **Deactivate property:**
   - Mark property asset as inactive and set future value to zero in Net Worth.
6. **Log event:**
   - Add a **Home Sold** event entry to event log including:
     - Year/month.
     - Gross sale value.
     - Net proceeds.
     - LTV at sale (for analytics).
     - Reason (planned sale vs. LTV trigger).

### 3.6 Event Logging

To support analysis, summarization, and downstream reporting/analytics, the Financial Engine must maintain an **Event Log** for each Scenario.

- **Storage:**
  - Event log is stored in Scenario data and included in JSON export.

- **Events to log (at minimum):**
  - **Status changes:**
    - Brian or Andrea **fully retires** (FTE transitions to 0).
    - Brian or Andrea transitions between work-status states (optional, but recommended for tracing tax behavior).
  - **Income milestones:**
    - Brian or Andrea **starts Social Security** (when modeled in Income).
    - Pension or annuity start events (if modeled).
  - **Asset milestones:**
    - Inherited IRA **depleted**.
    - 401k/403B **reaches minimum balance**.
    - Cash Savings or Joint Investment hitting their minimums.
  - **Loan / property events:**
    - **Reverse Mortgage created**.
    - **Reverse Mortgage draw** events (optional aggregation).
    - **Home sold**, including reason (planned sale vs. LTV trigger).
  - **End-state events:**
    - **Out of Money** event, with ages and remaining horizon gap.

- **Export format:**
  - Event log must be included as an array of structured objects containing:
    - `timestamp` (model year/month).
    - `event_type` (enum).
    - `description` (human-readable string).
    - Optional: impacted account IDs and amounts.

### 3.7 Output Data & Export

- **Projection data:**
  - For each Scenario, the Engine generates:
    - Periodic records (monthly years 1–5, annual thereafter) with:
      - Income.
      - Expenses.
      - Account balances (Cash Savings, Joint, Inherited IRA, 401k/403B).
      - Property value(s).
      - Loan balances (mortgage, HELOC, R-HELOC).
      - Net Worth.
  - Output is stored in Scenario data and accessible to:
    - Dashboard charts.
    - Tabular views.
    - Export.

- **Export requirements:**
  - JSON export must include:
    - Scenario configuration.
    - Assumptions.
    - Profiles used.
    - Full projection dataset (monthly + annual).
    - Event log.
  - Provide a top-level summary including:
    - Net worth at end of horizon.
    - Indicator of **out-of-money** or **funds sufficient**.
    - If out-of-money, show the **end-of-life gap**: the time between model end and planned end-of-life horizon.

---

## 4. Dashboard & Reporting (High-Level)

*(This section does not redefine calculation rules, only how outputs are presented.)*

- **Key views:**
  - Net Worth over time (line chart).
  - Income vs. Expenses over time (stacked bars or lines).
  - Account balances (Cash, Joint, Inherited IRA, 401k/403B) over time.
  - Loan balances and property value over time, including R-HELOC vs property value.

- **Scenario comparison:**
  - Ability to view key metrics (e.g., net worth at horizon, out-of-money or not, earliest depletion year) across multiple scenarios.

- **End-of-life sufficiency indicator:**
  - Clear readout:
    - “Sufficient funds through planned end of life” **or** “Out of money X years/months before end of life.”

---

## 5. Version History

- **0.91:**
  - Integrated **time-phased Expense Profiles** (2.3.1) and extended **Profiles** section (1.3) to support profile sequences.
  - Added explicit **housing transition model**:
    - Single active primary property at a time with non-owner periods modeled via Expense Profiles.
    - Clarified **New Construction Planner** behavior, funding modes (explicit vs auto), and alignment with Expense Profiles and sale/close dates.
  - Introduced `home_sale_equity_destination` parameter in Assumptions to control where sale equity is deposited (Joint vs CashThenJoint).
  - Updated **Property sale logic** (2.5.6, 3.5) and **Reverse Mortgage** flow (3.4) to use `home_sale_equity_destination`.
  - Clarified that R-HELOC creation requires 401k/403B at minimum, other liquid assets at minimum, and remaining deficits.

- **0.9:**
  - Added explicit **purpose** (end-of-life sufficiency, no bequest requirement).
  - Introduced **hybrid timebase** (monthly first 5 years, annual thereafter).
  - Refined **cash-flow waterfall** to prioritize Cash Savings, then Joint, then Inherited IRA, then 401k/403B, then Reverse Mortgage, then post-sale late-stage spending order.
  - Replaced fixed tax assumptions with **work-status-based tax schedule** shared across modules.
  - Specified **Investment Account Risk Reduction Algorithm (IARRA)** with configurable initial and final rates and taper age.
  - Updated **Inherited IRA** rules to use same work-status tax schedule as 401k/403B, enforce 10%+ annual withdrawal, and model extra withdrawals.
  - Updated **Reverse Mortgage & Home Sale logic** to be driven by 401k minimum balance and age-based LTVR parameters.
  - Clarified **surplus flow** into Cash Savings and Joint Investment.
  - Ensured all numeric rules are parameterized in **Assumptions** or module settings.

- **0.8:**
  - Prior version including Assets Registry, initial property valuation algorithm, Inherited IRA withdrawals, Reverse Mortgage logic, and construction planners.
