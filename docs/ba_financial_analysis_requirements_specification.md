# BA Financial Analysis – Requirements Specification

**Version:** 3.0a (alpha)  
**Date:** December 14, 2025  
**Status:** Unified Architecture (Relational Registry Model + v1.4 Features + v2.0 + v2.1 Enhancements + v2.2.1 robustness + v2.3 UX/data integrity + v3.0a alpha features). Codebase is at **3.0 alpha** and still needs additional validation and testing.

------

## 0. Purpose And Planning Objective
### 0.0 What’s New in v3.0a (alpha; requires further validation/testing)
- Cash Flow header now surfaces `Property Expenses`, `Monthly Income`, `Monthly Expenses`, and `Surplus/Deficit` (replaces Total Burn card for the model month).
- Property costs consolidated under a single Property Expenses card; profile home/impound rows only apply when a property is active.
- Engine safeguards: property-linked loan payments stop after the property sell month; de-duplication prevents double-counting property-linked debt service.
- Waterfall data captured per month for future drilldowns; Balance Inspector messaging updated to reflect removal of the view button.
- Scenario Compare module (left sidebar): up to three distinct scenarios side-by-side with income/expense profile start info, milestone-age net worth by asset/liability, and chronological event bullets.
- Codebase is **3.0 alpha**; feature-complete for this round but still needs validation and test coverage before marking stable.

### 0.1 Primary Objective

### 0.1 Primary Objective

- **Goal:** Help the household (Primary + Spouse) plan **solvency risk** (avoid running out of money before end of life).
- **End Of Life Definition:** Primary’s current age + **Projection Horizon** (default: 35 years), configurable in **General Assumptions**.
- **Consumption Focus:** The system prioritizes **consumption safety** over leaving a large estate. It assumes the user is willing to:
  - Deplete financial assets.
  - Tap housing wealth (Reverse Mortgage).
  - Sell property to fund late-life expenses if needed.

### 0.2 Design Principles

- **Registry-First Architecture**  
  Financial entities (Assets, Liabilities, Profiles) are defined once in a **Global Registry** and reused across multiple Scenarios. Scenarios are rebuilt from the registry on load/save to avoid divergence.
- **Scenario-As-Overlay**  
  Scenarios are **lightweight overlays** that hold references to Registry items plus **per-scenario overrides**. They do not store copies of registry items; views are reconstructed from registry + overrides.
- **Profiles = Non-Housing Spending**  
  Expense Profiles describe **non-housing** spending; **housing costs** (mortgage, tax, insurance, HOA, rent) are derived from **Property configuration** and **Scenario rent configuration**.
- **Housing Context Per Month**  
  At any month, a Scenario has exactly one **housing context**:
  - Own a primary property → Housing from that property’s cost configuration.
  - No primary property → Housing from Scenario-level **rent configuration**.
- **Explainability & Tooling**
  - Every configuration parameter must have an **explanation/help text**.
  - Every UI control must have a **tooltip** (or equivalent inline help).
- **No Hard-Coding**
  - All rates, thresholds, and limits must be configurable via:
    - General Assumptions, or
    - Module-specific settings.
  - Scenario storage is normalized; scenario-local copies of registry items should not persist beyond the active view.
- **Performance**
  - Full horizon (e.g., 420 months) simulation must complete within ~200ms on typical desktop hardware.
- **AI-Friendly**
  - Model state and simulation output must be exportable as:
    - A **reloadable JSON snapshot** (Registry + Scenarios + Assumptions).
    - A full month-by-month simulation timeline.
    - A structured `textConfig` plus **transition events** for AI analysis.

---

## 1. System Architecture (Registry + Scenarios)

### 1.1 Global Registry & Scenario Relationship

- **Global Registry**
  - Contains canonical definitions of:
    - **Assets**: Cash, Joint Investment, Inherited IRA, 401k/403b, Properties, etc.
    - **Liabilities**: Mortgages, HELOCs, Reverse Mortgage, synthetic “plan loans”, other debts.
    - **Profiles**: Income Profiles and **non-housing Expense Profiles**.
    - **Assumptions**: Inflation, returns, tax bands, healthcare inflation, etc.
  - Each Registry item has:
    - A stable **ID**.
    - A **type** and subtype metadata.
- **Scenarios (Overlays)**
  - A Scenario is defined by:
    - ID, name, description, start month (`YYYY-MM`).
    - A set of **links** to Registry Assets, Liabilities, and Profiles.
    - A set of **override objects** keyed by Registry IDs (e.g., property sell date, custom rate).
    - Profile sequences (per scenario, per type – Income vs Expense).
  - **Scenarios must NOT store full copies** of Registry items; they store links + deltas only.
  - The same Registry Profile can be:
    - Used by multiple Scenarios.
    - Used multiple times in a Scenario via different **start months**.

### 1.2 Runtime Merge Semantics

- For a given Scenario:
  - The engine constructs a **resolved view**:
    1. Take all referenced Registry items.
    2. Apply scenario-level overrides field-by-field.
  - If a Registry item changes later:
    - All Scenarios referencing it see the change unless a field is overridden.
  - Overrides are **field-granular**, not all-or-nothing.

### 1.3 Initialization, Persistence & Safety

- **Initialization (Cold Start)**
  - On a fresh startup with no user data:
    - The app must load a prebuilt **“Example Scenario”** and associated Registry items.
    - This Scenario demonstrates:
      - Assets, Liabilities, Profiles, Assumptions.
      - Dashboard, Monthly Burn, and Ledger views with realistic data.
    - This prevents a confusing empty-state.
- **Auto-Save**
  - The application auto-persists changes when:
    - A field is committed (blur or explicit “Save”).
    - The user changes Scenarios or navigates away.
- **Registry-Canonical Persistence**
  - On load/save, scenarios are normalized from registry + links/overrides to prevent stale local copies; registry remains the source of truth.
- **Deletion Protection**
  - The system **prevents deletion** of the **last remaining Scenario** to avoid leaving the app in a blank state.
- **Identity**
  - Person-specific logic uses logical identities:
    - `primary`
    - `spouse`

- **Versioning & Migration**
  - Snapshots include:
    - `"exportVersion"` (e.g., `"2.1"`).
    - `"minAppVersion"` for compatibility checks.
  - A **Data Integrity Engine**:
    - Migrates older snapshots (v1.4, v2.0) into v2.1 schema.
    - Fills defaults for new fields.
    - Produces a **Data Review** list of potential issues.

---

## 2. User Experience Modules

### 2.1 Scenario Builder

A guided flow for configuring Scenarios:

1. **Scenario Setup**
   - Set:
     - Name, description, start month (`YYYY-MM`).
   - Inline help explains:
     - Impact of start month on simulation window.
2. **Balance Sheet (Select / Define)**
   - **Select Registry Items**
     - Checkbox list to include/exclude specific Assets and Liabilities.
   - **Create New Items**
     - “Add Asset” / “Add Liability” opens Registry editors.
   - **Scenario Overrides**
     - For Property assets:
       - `sellDate` (`YYYY-MM`).
       - Optional overrides (e.g., scenario-specific appreciation, primary designation).
     - Overrides are clearly indicated (icon/label).
3. **Profiles & Timing**
   - **Income Profiles**
     - Select one or more Registry Income Profiles.
     - Assign scenario-specific **start months**.
   - **Expense Profiles (Non-Housing)**
     - Select one or more Registry non-housing Expense Profiles.
     - Assign scenario-specific **start months**.
   - **Activation Rules**
     - For each type (Income, Expense) and month:
       - At most **one active profile**.
     - When a new profile starts in a month, it replaces the prior profile of that type from that month onward.
   - **Validation**
     - Warn if Scenario start month has:
       - No active Income profile, or
       - No active Expense profile.
4. **Cash Flow Preview**
   - Show high-level projections:
     - Net worth trend.
     - Income vs spending.
   - Provide quick links to Dashboard and Monthly Burn.

### 2.2 Dashboard & Monthly Burn

- **Instant Recalculation**
  - Any edit to:
    - Registry,
    - Scenario links/overrides,
    - Assumptions,
  - triggers a full re-simulation of the active Scenario.

- **Dashboard Views**
  - **Scorecard**
    - Present snapshot metrics:
      - Net worth today.
      - Net worth at 10, 20, 30, 35 years.
      - Earliest solvency failure year (if any).
  - **Balance Sheet**
    - Stacked Assets vs Liabilities.
    - Per-account drill down.
  - **Housing Phases Timeline**
    - Visual indicator of:
      - Owned primary home segments.
      - Rent segments.
      - New construction phases.

- **Monthly Burn (Single-Month View)**
  - The user selects a month using:
    - `input[type="month"]` where supported.
    - Fallback: a validated `YYYY-MM` text input with Previous/Next buttons.
  - Display a breakdown for that month:

    1. **Recurring Bills & Living**  
       - Non-housing baseline expenses from the active Expense Profile:
         - Groceries, phone, internet, streaming, non-property utilities, etc.

    2. **Home Expenses**  
       - If an owned primary property is active:
         - Property-linked loan payments (principal + interest + escrow).
         - Property tax (monthlyized).
         - Property insurance (monthlyized).
         - HOA dues.
       - If no primary property is active:
         - Monthly **rent** and any rent-specific fees from Scenario rent configuration.

    3. **Healthcare**  
       - Auto **Healthcare Insurance** (age-65+ rule, see 3.1.3).
       - Plus Healthcare category from the Expense Profile.

    4. **Other Liabilities**  
       - Debt service for **non-property** liabilities:
         - Auto loans.
         - Personal loans.
         - Credit card minimums (if modeled).

    5. **Planned Discretionary**  
       - One-off discretionary events scheduled in that month (e.g., vacations, large purchases).
       - Extra principal payments (additive to minimums) for selected liabilities.

    6. **Total Monthly Burn**  
       - Sum of 1–5.

  - Context display:
    - Active Income Profile name.
    - Active Expense Profile name.
    - Current housing context:
      - e.g., `"Own – Current Home"`, `"Rent – Apartment"`, `"Own – Paso Home"`.

### 2.3 Monthly Ledger

- **Scope**
  - Summarized per year, expandable to monthly detail.
- **Columns (per account / liability)**
  - Opening Balance.
  - Net Change.
  - Closing Balance.
  - **Note** describing key drivers.
- **Note Requirements**
  - Major events must be clearly described, e.g.:
    - `"Interest +$400; Payment -$1,800; Appreciation +$1,200."`
    - `"Sold primary home – net $740,000 to Cash; mortgage paid off."`
    - `"IRA gross-up: gross $50k @ 28% → $36k net to Cash for Paso closing."`

---

## 3. Financial Modules (Registry Editors)

### 3.1 Cash Flow Manager – Income & Non-Housing Expenses

#### 3.1.1 Income Profiles

- **Data Captured**
  - Salary, bonuses, and/or pensions for Primary and Spouse.
  - Work Plan / FTE schedule.
  - PIA (Primary Insurance Amount) and Social Security claim ages.
- **FICA & Pension Treatment**
  - **FICA**:
    - Calculated based on Start Date and PIA inputs.
    - First eligible year is **prorated by birth month**.
  - **Employment Income**:
    - Modeled as **net take-home**, after income taxes and FICA.
  - **Pension / FICA-like Inflows**:
    - Modeled as **gross** amounts.
    - Taxes applied via age-specific effective tax rate tables.
- **Work Status Default**
  - If a projection year falls **outside** the defined Work Status (FTE) table:
    - FTE defaults to **0.0 (Retired)**.
- **Profile Reuse**
  - Income Profiles are Registry items.
  - Scenarios reference them via profile sequences (`profileId`, `startMonth`).
  - No scenario copies.

#### 3.1.2 Expense Profiles (Non-Housing)

- **Scope**
  - Expense Profiles capture **non-housing** spending:
    - Recurring Bills & Living.
    - Healthcare (non-insurance).
    - Other non-property Liabilities.
    - Discretionary / Travel / Hobbies.
  - Profiles **must not** include:
    - Mortgage payments, property tax, property insurance, HOA, or rent.
- **Structure**
  - Two-layer representation:
    1. **Near-Term Monthly Table (0–24 months)**  
       - Explicit monthly amounts for each category (optional).
    2. **Age Brackets**  
       - Annual amounts per age band, with optional “apply inflation” toggle.
- **Healthcare Category**
  - Profiles can define free-form Healthcare expenses.
  - Additional auto Healthcare Insurance is applied separately (see 3.1.3).
- **Profile Clone (Registry)**
  - Users can clone an Expense Profile in the Registry to create variants.
  - Scenarios reference the cloned profile via IDs and start dates.

#### 3.1.3 Auto Healthcare Insurance After Age 65

- **Rule**
  - Starting the month Primary turns **65**:
    - The engine adds a **Healthcare Insurance** expense for the household:
      - Year 1 (age 65): `5,000` per year.
      - Each following year:
        - `annualAmount = priorYearAmount × (1 + healthcareInflationRateAnnual)`.
      - Spread evenly over 12 months.
  - This amount is added to the **Healthcare** line in Monthly Burn in addition to any profile-defined Healthcare expenses.

---

### 3.2 Property Module – Assets, Housing Costs & Rent

#### 3.2.1 Property Asset Configuration

Each Property asset (Registry) must support:

- **Core Fields**
  - Name, address, type (primary, vacation, rental).
  - Purchase date, initial price or estimated value.
  - Appreciation settings (base rate, optional region factor).
- **Housing Cost Fields (Owned Property)**
  - **Property Tax**
    - Either:
      - Annual dollar amount, or
      - Rate × assessed value.
    - Grows by property tax inflation rate (subject to jurisdictional caps if modeled).
  - **Property Insurance**
    - Annual premium.
    - Grows by **property insurance inflation rate**.
  - **HOA**
    - Monthly or annual amount.
    - Optional inflation.
- **Loan Links**
  - One or more **property-linked liabilities**:
    - Mortgages.
    - Construction / bridge loans.
    - Property HELOC.
    - Reverse Mortgage / R-HELOC.
  - A liability has a `propertyLinked` flag and reference to `linkedPropertyId`.

#### 3.2.2 Scenario Housing Context

- **Property Inclusion**
  - In Scenario Builder, user selects which properties are included.
- **Sell Dates**
  - Scenario override can set a `sellDate` (YYYY-MM) for each included property.
- **Primary Residence Selection**
  - For each month, the engine computes primary residence based on:
    1. Scenario override (if specified).
    2. Otherwise, the first active Registry property marked as `primary`.
- **Rent Configuration (No Owned Primary)**
  - For months where no primary property is active:
    - Scenario uses **rent configuration**:
      - Rent amount (monthly).
      - Start/end months.
      - Optional rent inflation and fees.
    - Multiple rent phases allowed (e.g., `"Apartment – Initial Gap"`, `"RV Travel"`).

#### 3.2.3 Property Planner (New Construction & Purchases)

- **Closing Cost Estimator**
  - Line items:
    - Fees, prepaids, buydowns, credits, deposits.
  - Net formula:
    - `CashToClose = (Price + Costs + Buydowns) – Credits – Deposits – LoanPrincipal`.
- **Event Timing**
  - **Contract Date**:
    - Triggers contract deposits.
  - **Closing Date**:
    - Triggers remaining cash-to-close funding events.
- **Funding Sources**
  - User selects accounts (Cash, Joint Investment, Inherited IRA, 401k/403b).
  - For tax-deferred or Inherited accounts:
    - The UI is net-target oriented; engine computes gross via tax gross-up.
- **Gross-Up Calculation**
  - For each event that targets a **net** amount from a tax-deferred/Inh IRA account:
    - `grossWithdrawal = netTarget / (1 − effectiveTaxRate)`.
    - Ledger notes include:
      - Account.
      - Gross.
      - Tax.
      - Net.
      - Purpose.
- **Auto Property Loans**
  - Planner can auto-size and create property-linked mortgages:
    - Term, rate, amortization schedule.
    - Start at closing month.

---

### 3.3 Assets & Liabilities – Investments & Debt

#### 3.3.1 Investment Assets

- **Return Model**
  - For each investment account (Joint, 401k, etc.):
    - Annual return rate **tapers** from `startReturnRate` to `minReturnRate` by a target age (e.g., 80).
    - For month `m` at age `a`:
      - `effectiveAnnualReturn(a)` is interpolated between start and minimum.
      - Monthly return:
        - `monthlyReturn = (1 + effectiveAnnualReturn)^(1/12) − 1`.

#### 3.3.2 Inherited IRA (Enhanced, 10-Year Rule)

- **Ten-Year Schedule**
  - Registry asset holds:
    - Start date (inheritance).
    - A 10-year schedule of **planned January withdrawals** (amounts or percents).
- **Year-10 Lock**
  - UI requirement:
    - 10th-year withdrawal entry is **locked** or automatically set such that the account fully depletes by end of year 10.
- **Planned January Withdrawals (RMD-like)**
  - Once per year in January:
    - Engine calculates gross withdrawal.
    - Applies effective tax rate.
    - Deposits **net** into **Joint Investment** (planned reinvestment behavior).
- **Ad-Hoc Withdrawals (All Non-Scheduled Uses)**
  - For covering monthly deficits, property deposits, cash-to-close, or explicit user events:
    - Engine calculates gross withdrawal and taxes.
    - Deposits **net** into **Cash Savings** (not Joint).
- **Compliance**
  - Engine ensures account is fully depleted by year 10.

#### 3.3.3 Property-Linked Liabilities

- **Definition**
  - Any liability with `propertyLinked = true` and `linkedPropertyId` set.
- **Classification**
  - Debt service (principal + interest + escrow) from property-linked liabilities is:
    - Included in **Home Expenses** in Monthly Burn.
- **Non-Property Liabilities**
  - All other liabilities are aggregated into **Other Liabilities** in Monthly Burn.

#### 3.3.4 Revolving Debt & Extra Payments

- **Minimum Payment**
  - Revolving debts (e.g., HELOC) have a **planned minimum payment** rule:
    - Could be a percent of balance or amortization-like schedule.
- **Extra Liability Payments**
  - Expense Profiles can specify **Extra Liability Payment** events:
    - Defined per liability and month/period.
  - **Requirement:** Extra payments are **in addition** to making the minimum planned payment; they **do not override** or replace the minimum.
  - Engine logic:
    - `totalPayment = minimumPayment + extraPayment`.
    - Interest and principal application follow standard amortization (min + extra).

---

## 4. Financial Engine Logic

### 4.1 Core Monthly Loop

For each month `t` in the horizon:

1. **Initialize**
   - Load prior-month balances.
   - Determine:
     - Active Income Profile.
     - Active Expense Profile (non-housing).
     - Active primary property (if any).
     - Active rent configuration if no primary property.
2. **Apply Appreciation & Returns**
   - Property values:
     - Updated at **start of month** using appreciation rates.
   - Investment accounts:
     - Updated using monthly-return function.
3. **Inflation Application (Stateless)**
   - For each quantity subject to inflation (e.g., non-housing profiles, taxes, insurance):
     - Let `monthsSinceBase` be total months since base year start.
     - Apply:
       - `inflatedAmount = baseAmount × (1 + annualInflation)^(monthsSinceBase/12)`.
   - Implementation must be **stateless**: amount depends only on global time index, not simulation order.
4. **Income Computation**
   - From active Income Profile:
     - FTE-adjusted salaries.
     - Pensions.
     - Social Security.
   - Employment income recorded as **net**; gross→net handled per tax model.
5. **Non-Housing Expenses**
   - Derived from active Expense Profile (non-housing categories), adjusted for inflation.
6. **Housing Costs**
   - If primary property active:
     - Housing = property tax + property insurance + HOA + property-linked debt service.
   - If no primary property:
     - Housing = Scenario rent amount (plus any rent-specific costs).
7. **Healthcare**
   - Add:
     - Auto Healthcare Insurance (age-65 rule).
     - Profile-defined Healthcare.
8. **Other Liabilities**
   - Compute debt service for non-property liabilities (including min + extra payments).
9. **Planned Discretionary**
   - Sum of:
     - Scheduled one-off discretionary events.
     - Extra principal payments defined in profiles.
10. **Net Flow & Waterfall**
    - `totalExpenses = nonHousing + housing + healthcare + otherLiabilities + discretionary + taxes`.
    - `netFlow = incomeTotal − totalExpenses`.
    - If `netFlow > 0`:
      - Allocate surplus per assumptions (top up Cash to targets, then Joint).
    - If `netFlow < 0`:
      - Apply deficit waterfall (see 4.3).
11. **Events**
    - Execute month-specific events:
      - Inherited IRA planned January withdrawal.
      - Property sale per scenario `sellDate`.
      - Property purchase/closing.
      - Reverse Mortgage creation or draws.
      - Forced sale if R-HELOC LTV limit exceeded.
12. **Record**
    - Per-account start, change, end.
    - Monthly Burn categories.
    - Net worth.
    - Transition events list entries (see 5.5).
    - Human-readable `Note`.

### 4.2 Voluntary Property Sale (Scenario Sell Date)

- **Trigger**
  - Month `t` equals scenario’s `sellDate` for a property.
- **Behavior**
  1. Property value updated at **start of month** using appreciation rules.
  2. Sell at current value.
  3. Pay off all property-linked liabilities (linkedLoanIds + liabilities with `propertyLinked` and `linkedPropertyId`).
  4. Deduct transaction costs (commissions, fees).
  5. Deposit **net proceeds into Cash Savings**.
  6. Stop housing costs for that property (tax, insurance, HOA, property-linked debt service).
  7. Update housing context:
     - If another primary property exists, switch to it.
