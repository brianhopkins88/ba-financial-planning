## BA Financial App User Stories

This document describes how a typical user (Brian) will interact with the application across all modules, to give developers a qualitative, end-to-end view of the his and his wife Andre'a financial future.

---

### Story 1: First-Time Use And Example Scenario

**As Brian,**
I want the app to start with a complete example Scenario and guide me to import my own data,
**so that** I can immediately see how the system works and then transition to my real plan.

- **Behavior:**
  - On first launch with no user data:
    - The app loads an **Example Scenario** containing placeholder income, expenses, assets, loans, assumptions, and projections.
    - The main dashboard and all modules show meaningful charts and tables based on this demo data.
  - At the same time, the app invites me to:
    - **Import** a Scenario JSON file with my real data, or  
    - Continue experimenting with the Example Scenario.

- **What I do:**
  - I click around:
    - See how Income, Expenses, Assets, Loans, and Assumptions fit together.
    - Open the **Cash Flow & Net Worth** views and read tooltips for the waterfall rules.
  - Once I’m comfortable, I import my own Scenario JSON file exported from another environment or a previous run.

- **Example:**
  - I open the app and see a "Retirement Planning – Example" scenario.
  - I click the Assumptions module to see global inflation, tax rates, and IARRA parameters.
  - A banner at the top suggests: "Ready to use your own data? Import a Scenario JSON file."

---

### Story 2: Importing My Scenario, Assumptions Choice, And Data Review

**As Brian,**
I want to import a Scenario JSON and decide whether to use my saved assumptions or the current global defaults,
**so that** I can reuse old plans or refresh them with new assumptions.

- **Behavior:**
  - When I import a Scenario JSON:
    - The app reads:
      - Scenario configuration (income, expenses, loans, assets).
      - The Scenario’s **Assumptions snapshot**.
      - All exported **Profiles**.
      - Projection data and event logs (which will be recomputed).
    - The app prompts:
      - "Use the assumptions from this file" **or**
      - "Use current Global Assumptions instead."
  - After I choose:
    - The app stores the chosen assumptions as the **Scenario snapshot**.
    - It automatically runs a full **Recalculate**.

- **Data validation:**
  - If any required fields are missing or inconsistent:
    - The app accepts the file and loads valid data.
    - It shows a **Missing/Incorrect Data Review**:
      - Highlights missing ages, loan details, initial balances, etc.
      - Offers default values where possible.
    - Once I fix the issues, I can Recalculate again.

- **Example:**
  - I import "Brian_Retirement_2025.json".
  - I select: "Use imported assumptions."
  - The app runs projections and then shows a panel: "3 issues found – missing property insurance rate, missing Inherited IRA end date, unknown profile reference."  
  - I correct those fields, hit Recalculate, and the charts update.

---

### Story 3: Configuring Income, Work Status, And Retirement Contributions

**As Brian,**
I want to model mine and Andrea’s work patterns and retirement contributions over time,
**so that** the engine can accurately project future income and 401k growth.

- **Behavior:**
  - In the **Income module**, I configure:
    - Brian’s and Andrea’s incomes (salary, bonus, pension, FICA start dates, etc., as the design allows).
    - A time-phased **FTE schedule** (full-time, part-time, retired) for each person.
    - Contribution percentages to **401k/403B** accounts.
  - The app:
    - Uses FTE to:
      - Scale income (e.g., 0.6 FTE = 60% income).
      - Scale retirement contributions for each period.
    - Uses FTE combinations to determine **work-status tax bands**:
      - Both full-time, either part-time, both part-time, one part-time/one retired, both retired.
    - Feeds the resulting effective tax rate into:
      - 401k/403B and Inherited IRA withdrawal taxation.
      - Joint Investment withdrawal half-rate.

- **Profiles:**
  - I can save a configured income pattern as an **Income Profile** (e.g., "Brian Retires 2030, Andrea 60% FTE 2027–2030").
  - I reuse that profile across different Scenarios to quickly compare "Retire at 65" vs "Retire at 67" cases.

- **Example:**
  - I set:
    - Brian FTE: 1.0 to age 65, then 0.5 for 3 years, then 0 (retired).
    - Andrea FTE: 1.0 to age 62, then 0 (retired).
  - The app:
    - Uses these schedules to choose the appropriate **tax rate** per year.
    - Automatically increases 401k balance via contributions while either of us is working, using inflation-adjusted income and our contribution percentages.

---

### Story 4: Modeling Expenses, Medigap, And Extra Events

**As Brian,**
I want to model my recurring expenses, property-related costs, medical expenses, and big one-off events,
**so that** I can see realistic cash-flow and spending patterns over time.

- **Behavior:**
  - In the **Expenses module**, I:
    - Define categories: recurring bills, mortgage & impounds, home expenses, living expenses, other loans.
    - Set base amounts and growth rules.
  - The app applies:
    - **Property tax** growth capped at the Prop 19 cap rate in Assumptions.
    - **Property insurance** growth using a property insurance growth rate parameter (e.g., 5%).
  - When Brian’s FTE becomes **0** (no longer working at all):
    - The app automatically adds a **Medicare supplemental insurance** expense line:
      - Base annual amount (e.g., $6,000).
      - Grows at **medical inflation** rate (e.g., 5%).

- **Extra Expense Planning:**
  - I create planned big-ticket expenses:
    - Example: $40,000 kitchen remodel at age 68; $25,000 Airstream upgrade.
  - I configure "Fun Money" budgets by age bracket (e.g., 65–69, 70–74).
  - The engine incorporates these into the cash-flow projection and waterfall.

- **Profiles:**
  - I save an **Expense Profile**:
    - "Baseline Retirement Expenses – High Travel,"  
    - Then create another profile, "Baseline – Low Travel," by cloning and editing.
  - I attach different profiles to different Scenarios to see how spending levels impact "out-of-money" risk.

---

### Story 5: Managing Assets, Savings, And Investment Risk Reduction

**As Brian,**
I want the system to treat my cash, joint investments, inherited IRA, and 401k as an integrated portfolio with realistic return and withdrawal rules,
**so that** I can see how my balances evolve and are drawn down over time.

- **Behavior:**
  - I define my asset accounts:
    - **Cash Savings** (emergency fund / buffer).
    - **Joint Investment** account (taxable investments).
    - **Inherited IRA** accounts (with start/end dates).
    - **401k/403B** accounts (retirement accounts).
    - **Property** (primary home).
  - The app uses the **Investment Account Risk Reduction Algorithm (IARRA)** with:
    - Initial return (e.g., 7%).
    - Final return (e.g., 3.5% at age 80).
    - Linear tapering of returns with age.
    - Monthly or annual compounding as configured.

- **Cash and surplus rules:**
  - When Income > Expenses:
    - Surplus first fills **Cash Savings** up to its age-based max.
    - Remaining surplus flows into **Joint Investment**.
  - The Cash Savings minimum is age-based:
    - < 65: e.g., $15k;  
    - ≥ 65: e.g., $30k (values from Assumptions).

- **Withdrawal waterfall:**
  - When Expenses > Income, the engine draws from accounts in order:
    1. Cash Savings down to min.
    2. Joint Investment to its min (with half tax).
    3. Inherited IRA (scheduled January % withdrawals + extra as needed, taxed like 401k).
    4. 401k/403B (full tax).
    5. Reverse Mortgage line of credit.
    6. After home sale, remaining 401k, then joint (no tax), then any residual cash.

- **Example:**
  - At age 70, I have:
    - $25k in Cash Savings.
    - $600k Joint.
    - $200k Inherited IRA.
    - $900k 401k.
  - The app:
    - Uses IARRA to grow these.
    - Automatically applies my withdrawal schedule on the Inherited IRA in January.
    - Uses the waterfall to cover shortfalls.

---

### Story 6: Inherited IRA Planning And Forced Depletion

**As Brian,**
I want to specify a planned withdrawal schedule for my inherited IRA but also let the engine accelerate withdrawals if needed,
**so that** I both comply with the 10-year rule and realistically fund my expenses.

- **Behavior:**
  - In the **Inherited IRA view**, I:
    - Set the account start date and let the app compute the required 10-year end.
    - Define a **percentage-of-balance withdrawal in January** for each year.
  - The app:
    - Uses IARRA to project account growth.
    - Enforces:
      - Account must be **zero** by 10 years after start.
      - Minimum overall withdrawal rule (e.g., ≥10% per year across scheduled + extra).
    - Calculates tax on withdrawals at the full **work-status tax rate**, same as 401k.

- **Extra withdrawals:**
  - If the cash-flow waterfall requires more money:
    - The engine schedules **extra withdrawals** from Inherited IRA before moving on to 401k, still within the 10-year window.
    - Extra withdrawals reduce or eliminate later scheduled withdrawals (e.g., if account runs out in year 8, the year 10 withdrawal is 0).

- **Example:**
  - I plan to take:
    - 5% in the first 3 years,
    - 12% in the middle years,
    - 25% in the final year.
  - But a large health expense in year 7 forces the engine to take extra from the Inherited IRA.
  - The app:
    - Logs these extra events.
    - Adjusts the later schedule so the account is fully depleted by March of the final year.

---

### Story 7: Property, New Construction, And Reverse Mortgage

- - - **As Brian,**
       I want to model my current home, a possible new-construction purchase, and a late-life reverse mortgage,
       **so that** I can see how housing decisions and home equity affect my retirement security.
    
    ------
    
      ### A. Primary Home And Property Modeling
    
      - **What I configure**
        - In **Assets & Property**, I define my primary home:
          - Name, location, ZIP, build year.
          - Current estimated value.
          - Property **start date** (when I start owning it in the Scenario).
          - Optional **planned sell date**.
        - I link the property to:
          - Its **mortgage** (and any HELOC).
          - A **future reverse mortgage** that the engine may create later.
      - **What the app does**
        - Uses the **Home Value Projection algorithm** to estimate nominal future values.
        - Includes the property in Net Worth between the start date and either:
          - The user-defined sell date, or
          - A forced sale (e.g., reverse-mortgage LTV trigger).
    
    ------
    
      ### B. New Construction Planner And Move Timeline
    
      - **What I configure**
        - In the **New Construction Planner**, I:
          - Enter purchase details for the future home:
            - Base price, structural upgrades, design upgrades and credits, lot premium.
            - Estimated **contract date** and **close date**.
          - Add an editable list of **closing costs** (escrow, title, prepaid taxes/insurance, etc.).
          - Define **deposits**, such as:
            - Fixed contract deposit (e.g., $30,000).
            - Design center deposit as a percentage of design upgrades.
          - Specify **how cash to close is funded**, either by:
            - Explicit “pull from this asset” entries (Cash Savings, Joint, Inherited IRA, 401k/403B), **or**
            - Letting the app apply a default order (Cash Savings → Joint → Inherited IRA → 401k/403B).
        - I create a **new property asset** for the future home and associate it with the New Construction plan.
      - **Expense profile timeline**
        - In the **Expenses module**, I handle living-situation changes by using **dated Expense Profiles**:
          1. A profile for **living in my current home**.
          2. A profile for **apartment/rental living** after selling my current home but before the new build closes.
          3. A profile for **living in the new home** after close.
        - Each Expense Profile has a **start month/year**. When a new profile’s start date is reached, it **supersedes** the previous profile for that period.
      - **What the app does**
        - On the planned **sale date** of my current home:
          - Executes a **Property Sale Event** (see rules below).
        - On the **close date** of the new construction:
          - Executes the **purchase event**, withdrawing funds from the specified accounts (or default order).
          - Creates a new **mortgage loan** linked to the new property.
    
    ------
    
      ### C. Sale And Purchase Rules
    
      - **Sale of current home**
        - On the planned sell date (or at a forced sale):
          - The app:
            1. Computes the projected **market value** from the Home Value Projection algorithm.
            2. Subtracts **transaction costs** (e.g., 6%, parameterized).
            3. Pays off any **linked mortgage/HELOC**.
            4. Closes the property and loan accounts.
            5. Deposits **net equity** into a configurable destination:
               - Typically **Joint Investment**, or
               - Optionally **Cash Savings** first, then overflow to Joint (per Assumptions).
            6. Logs the sale in the event log.
      - **Purchase of new construction home**
        - On **contract date**:
          - The app executes any configured **contract deposits**, withdrawing from the specified assets (or default funding order) and applying tax rules for tax-deferred accounts.
        - On **close date**:
          - The app:
            1. Calculates **“cash to close”** = Total price + closing costs − deposits already paid.
            2. Funds cash to close from:
               - Cash Savings, then Joint, then Inherited IRA, then 401k/403B (if auto mode),
               - Or per the explicit source allocations defined in the New Construction Planner.
            3. Applies appropriate **tax rules** when funds come from tax-deferred accounts.
            4. Creates a new **mortgage loan** in the Loans module and links it to the new property.
            5. Activates the new property asset from the close date forward.
    
    ------
    
      ### D. Reverse Mortgage Behavior (Late Life)
    
      - **When it happens**
        - Later in life, when:
          - 401k/403B reaches its configured **minimum balance**,
          - Cash Savings and Joint Investment are at their **minimums**, and
          - There is still a **cash deficit**,
        - The engine creates a **Reverse Mortgage Line of Credit** (R-HELOC) linked to the current primary home.
      - **What the app does**
        - Uses age-based **LTV ratios** and a conservative valuation factor (e.g., 90% of home value) to compute the maximum line.
        - If there is an existing mortgage/HELOC:
          - Pays it off with the reverse mortgage proceeds and closes that loan.
        - Uses the R-HELOC to cover ongoing deficits, adding interest each period.
        - When the reverse mortgage balance reaches its LTV limit, the engine:
          - Triggers a **Home Sale Event**.
          - Pays off the reverse mortgage from sale proceeds.
          - Deposits net equity into Joint Investment (or other configured account).
          - Continues the late-stage spending waterfall with post-sale rules.
      - **Example**
        - At age 78:
          - 401k is at its minimum.
          - Cash Savings and Joint are both at their configured minimums, and I still have a spending gap.
        - The app:
          - Creates a R-HELOC with a 50% LTV (age 70–80 band) times 90% of projected home value.
          - Draws from it for several years to cover deficits.
          - When the R-HELOC hits its maximum allowed balance, sells the home, pays off the reverse mortgage, deposits net equity into investments, and continues the projection.

---

### Story 8: Running Projections And Understanding End-Of-Life Risk

**As Brian,**
I want to run projections and quickly see whether I’ll have enough money through my planned end-of-life age,
**so that** I can adjust my work years and spending to avoid running out.

- **Behavior:**
  - I press **Recalculate** (or it runs automatically after import).
  - The **Financial Engine**:
    - Simulates monthly for the first 5 years, then annually to the end of the horizon.
    - Applies all growth, tax, withdrawal, and waterfall rules.
    - Logs key events:
      - Work-status changes.
      - FICA start.
      - Inherited IRA depletion.
      - 401k reaching minimum.
      - Reverse mortgage creation.
      - Home sale.
      - Out-of-money event, if any.

- **Dashboard and outputs:**
  - The Dashboard shows:
    - Net worth over time.
    - Income vs expenses.
    - Account balance trajectories.
    - Home value vs reverse mortgage balance.
  - A clear indicator:
    - "Sufficient funds through age X" **or**
    - "Out of money at age Y (Z years before planned end-of-life)."

- **Example:**
  - I run the model and see:
    - I run out of money at age 86, but my horizon is age 90.
    - The event log shows "Out of Money – age 86; 4-year gap."
  - I:
    - Reduce spending, or
    - Delay retirement, or
    - Adjust assumptions, then
    - Recalculate and see if I’ve eliminated the gap.

---

### Story 9: Comparing Scenarios

**As Brian,**
I want to compare multiple Scenarios (e.g., retiring at 65 vs 67) side by side,
**so that** I can make better decisions about work, spending, and housing.

- **Behavior (future Scenario Analysis module):**
  - I choose:
    - A **current Scenario**.
    - One or more additional Scenarios from imported files.
  - The app shows:
    - Comparing net worth at horizon.
    - Whether each Scenario runs out of money (and when).
    - High-level metrics like:
      - Number of years with reverse mortgage.
      - Age at home sale.
      - Size of late-life buffer.

- **Example:**
  - Scenario A: Brian retires at 65; Scenario B: at 67.
  - The analysis view shows:
    - Scenario A runs out of money 2 years early.
    - Scenario B barely makes it to end-of-life.
  - I then focus on Scenario B and further refine expenses.

