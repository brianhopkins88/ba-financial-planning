# This file contains notes about the work that has happened so far

## 2025-11-29: Session 11 (Version 0.9 requirements and architecture overhaul)

**Status:** Performed a deep analysis and update of the application requirements, generated user stories for better implementation and testing, and updates the architecture. 
**Focus:** Preparing to do a deep refactoring of the application. 

- Specified detailed rules for asset handling, debts, expenses and future projections. Established a place holder for a future analysis module. 
- Update that data handling and persistence requirements.
- Updated the requirements for assumptions and profile handling.
- Created a set of user stories in a user stories document.
- Update the architecture document to be organized by a traditional BDAT stack approach.

### **Accomplishments**

## 2025-11-27: Session 10 (Financial Engine & Property Planners)

**Status:** Phase 4 (Financial Engine) Core Complete. Assets Module Enhanced.
**Focus:** Building the central simulation logic, the Dashboard visualization, and advanced Property Planning tools.

### **Accomplishments**

- **Financial Engine (`src/utils/financial_engine.js`):**
  - Built the core simulation loop (420 months / 35 years).
  - **Cash Flow Waterfall:** Implemented the hierarchy: Income -> Expenses -> Joint Savings -> Inherited IRA -> 401k -> Reverse Mortgage.
  - **Auto-Logic:** Engine now automatically triggers a "Reverse Mortgage" state if liquid cash is depleted, tracking its balance separately.
  - **Event Logging:** System records critical events (e.g., "Inherited IRA Depleted", "Reverse Mortgage Started") for reporting.

- **Dashboard Module (`src/views/dashboard.jsx`):**
  - Created a visual interface for the Financial Engine.
  - **Net Worth Chart:** 35-year area chart showing the trajectory of wealth.
  - **Event Log:** Scrollable list of auto-generated simulation events.
  - **Key Metrics:** Cards for Projected Net Worth, Ending Liquidity, and Solvency Status.

- **Advanced Property Planning (`src/components/PropertyPlanners.jsx`):**
  - **New Construction Wizard:** Specialized form for planning custom builds (Base Price + Upgrades - Credits). Includes a "Cash to Close" calculator that pulls funds from specific asset accounts.
  - **Loan Integration:** The planner can auto-create a detailed "Construction Loan" in the Loans module based on user inputs.
  - **Future Logic:** Updated `assets.jsx` to detect "Future" properties (Start Date > Current Date) and swap the view from the Growth Chart to the Planning Wizard.

- **Architecture:**
  - **DataContext:** Refactored `addLoan` to accept override parameters, enabling programmatic loan creation from other modules.
  - **App Shell:** Wired `Dashboard` as the default landing view.

### **Next Steps**

- Define additional asset type requirements - 401k, Joint, cash accounts
- **Smoke Testing:** 
  - Test the assets module fully
    - Test the new construction property planner carefully
    - Test/ add the asset value future value viewer for individual assets or all assets. 
  - Test retest the expenses, income, assumptions
  - Test the dashboard, recaculate function
    - Verify that various rules work correct, eg. "Cash to Close" logic in the Property Planner correctly reduces asset balances in the simulation.
- **Refinement:** Add more granular control over the "Reverse Mortgage" terms (currently hardcoded to 6%).
- **UI Polish:** Expand the Dashboard to show a breakdown of Expenses by category over time.

## 2025-11-27: Session 1 (Assets Module Phase 1 & Requirements v0.8)

**Status:** Phase 4 (Assets) Started. Requirements v0.8 Finalized. **Focus:** Implementing the Asset Registry, resolving build errors, and solidifying complex modeling rules.

### **Accomplishments**

- **Requirements Specification v0.8:**
  - Consolidated all new rules for **Inherited IRA** (10-year rule, deficit overrides), **Property** (New Construction planner, Valuation Algorithm), and **Financial Engine** (Reverse Mortgage auto-creation, Cash Flow Waterfall).
  - Resolved architectural conflict: Established `financial_engine.js` as the single source of truth for all projections.
- **Asset Module Foundation:**
  - **Data Migration:** Implemented a robust migration script in `DataContext` to convert legacy "flat" assets (`assets.joint`) into a scalable `assets.accounts` registry.
  - **UI Implementation:** Built `src/views/assets.jsx` featuring a 4-box layout (Retirement, IRA, Joint/Cash, Property) and an interactive **Growth Projection Chart**.
  - **Logic:** Implemented the `projectHomeValue` algorithm (New/Mid/Mature phases) in `src/utils/asset_math.js`.
  - **Routing:** Integrated the Assets view into the App Shell (`App.jsx`, `Sidebar.jsx`) and removed legacy inputs from Assumptions.
- **Bug Fixes:**
  - Resolved a build error regarding `hgv_data.json` by ensuring the file is explicitly generated and correctly located.

### **Next Steps (Session 2)**

- **Property Planning Submodules:** Build the "New Construction" and "Home Purchase" wizards.
- **Financial Engine:** Implement the `financial_engine.js` core to handle the Cash Flow Waterfall, Reverse Mortgage auto-logic, and the 35-year projection loop.

## 2025-11-27: Session 9 (Expenses Module Finalization & Projections)

**Status:** Phase 3 (Cash Flow) Complete / Phase 4 (Financial Engine) Prep.
**Focus:** Advanced Expense Planning, Long-Range Projections, and Loan Integration.

### **Accomplishments**
* **Expense Module Overhaul:**
    * Implemented **Expense Summary Projection**: A 35-year bar chart and data table at the top of the Expenses view.
    * Integrated **Loan Amortization Engine**: The projection now calculates exact loan payoff dates (preventing "zombie" payments after payoff) by importing `loan_math.js` directly.
    * Added **Long-Term "Fun Money" Rules**: Users can now plan retirement spending based on 5-year age brackets (Age 65-90).
    * **UI Refinements**: Moved "Other Loans" under Living Expenses, renamed Future Expenses to "Extra Expense Planning", and consolidated Profile actions into a dropdown menu.
* **Global Data Updates:**
    * Updated default Model Start Date to **January 2026**.
    * Added specific **Birth Years** (Brian: 1966, Andrea: 1965) to `hgv_data.json` and `DataContext` to drive age-based planning.
    * Fixed persisted `currentModelDate` logic to ensure the "Time Machine" cursor is saved.

## 2025-11-26: Session 8 (Data Persistence, Future Planning & Requirements Freeze)

Status: Phase 3 (Cash Flow) Complete. Requirements v0.7 (previously v9.0) Finalized.

Focus: Implementing robust Data Persistence, the Future Expenses planning tool, and finalizing strict categorization rules for the Expense Manager.

### **Accomplishments**
- re-versioned the application to 0.7 from v9 to reflect it's still not complete.
- **Data Architecture & Persistence:**
  - **Auto-Save:** Implemented `localStorage` persistence to prevent data loss on refresh.
  - **Import/Export Engine:** Built a robust JSON handler that bundles **Linked Profiles** with the Scenario Data, ensuring full portability of plans.
  - **Sidebar Upgrade:**
    - Added **Global Actions Menu** (Export, Upload, Reset).
    - Added **Rich Scenario Selector** with inline Rename, Clone, and Delete functions.
- **Future Expenses Submodule:**
  - Created a dedicated "One-Offs" planning tool within Expenses.
  - **Features:** Data Entry Table, Auto-integration of Loan Extra Payments, Year/Month Grouping, and Bar Chart visualization.
- **Expense Manager Overhaul (v9 Rules):**
  - **Strict Categorization:** Implemented 4 distinct groups (Bills, Mortgage & Impounds, Home, Living) driven purely by the JSON structure (no auto-sorting code).
  - **CRUD:** Enabled Add/Edit/Delete for all sub-categories, including Impounds.
  - **Loan Visibility:** Fixed logic to ensure "Active" loans (like HELOCs) appear in the Debt Summary regardless of future start dates.
- **Loan & Income Updates:**
  - **Mortgage Type:** Added a specific "Mortgage" loan type.
  - **Payoff Profiles:** Upgraded the strategy selector to a rich menu (Rename, Duplicate, Delete).
  - **Bonuses:** Added Annual Bonus inputs (Amount/Month) to the Income module.

### **Next Steps**

- **Phase 4 (Financial Engine):** Develop the core `financial_engine.js` to aggregate all these finalized inputs into a monthly Net Worth projection.
- **Dashboard:** Connect the engine outputs to the main Dashboard charts.

## 2025-11-26: Session 7 (Global Date Engine & Profile Managers)

**Status:** Phase 3 (Cash Flow) Complete. Phase 4 (Financial Engine) Ready.
**Focus:** Implementing the "Time-Machine" date navigation and robust Time-Phased Profile management for Income and Expenses.

### **Accomplishments**

- **Global Date Engine (App Shell):**
  - Implemented `globals.timing` in `DataContext` to define a Scenario Start Date.
  - Added `simulationDate` state to track the "Current Model Month".
  - **Navigation:** Built a "Press & Hold" accelerator in the Top Bar to rapidly traverse months, quarters, and years.
- **Income Manager (`views/income.jsx`):**
  - Created a dedicated module for Income & Work Status.
  - Implemented **Work Status Trajectory** that automatically extends 10 years from the scenario start.
  - Added full Profile Management (Save, Rename, Delete, Time-Phased Activation).
- **Expense Manager Refactor:**
  - **Accordion UI:** Grouped bills into collapsible sections (Recurring, Home, Living) to save space.
  - **Profile Manager:** Renamed from "Timeline" to "Profile Manager".
  - **Smart Saving:** Added distinct "Save to Current Profile" vs "Save as New" actions.
  - **Validation:** Implemented logic to prevent deleting/disabling the only active profile covering the current date.
- **Architecture & Data:**
  - Updated `DataContext` with `updateProfile` and `renameProfile` actions.
  - Refactored the internal data structure to support a `profileSequence` array for time-based switching.
  - Updated *Requirements Specification* to v8.6.

### **Next Steps**

- Implement a **Future Expense Planning submodule** in expenses.
- **Phase 4 (Financial Engine):** Build the core logic (`financial_engine.js`) to aggregate these time-phased profiles into a Net Worth projection.
- **Dashboard:** Connect the visual charts to the output of the Financial Engine.


## 2025-11-25: Session 6 (Cash Flow Manager & Profile Logic)

**Status:** Phase 3 (Cash Flow) Functional. UI Refinement Pending. **Focus:** Implementing the "Mix-and-Match" Profile system and the interactive Cash Flow view.

### **Accomplishments**



- **Data Architecture Update (v8.5):**
  - Added `activeProfileId` tracking to Income and Expense modules.
  - Added `active` boolean flag to Loans to allow "soft deletes" or modeling future debts.
  - Implemented `deleteProfile` and `saveScenario` actions in Context.
- **Cash Flow Manager (`views/expenses.jsx`):**
  - Built the dual-tab interface for **Income** and **Expenses**.
  - **Profile Engine:** Users can now Save, Load, and Delete specific configuration profiles (e.g., "Retirement Lean" expenses).
  - **Debt Injection:** Automatically calculates and injects "Active Debt" payments into the monthly burn rate if the loan Start Date is in the past.
  - **Visuals:** Added real-time "Net Cash Flow" bar and solvency check.
- **Loans Module Updates:**
  - Added **Active/Inactive** toggle to loan headers.
  - Ensured "Start Date" is always editable to support the Debt Injection logic.
- **Bug Fixes:**
  - Resolved layout issues where Expense Amount inputs were collapsing or missing.
  - Fixed state mutation bugs in the Bill Update logic.



### **Next Steps**



- **UI Refactor (Expenses):** Redesign the expense lists into a **Vertical Accordion** layout (Expand/Hide) to improve readability of long descriptions.
- **Date Logic Fix:** Remove the hardcoded "Jan 2025" display; ensure the view dynamically reflects the current model date (November 2025).
- **Phase 4 (Dashboard):** Begin connecting the Financial Engine to the visual Dashboard.

## 2025-11-25: Session 5 (Requirements & Architecture Refinement)

Status: Phase 3 (Cash Flow) Design Complete.

Focus: Redesigning the Expenses module to include Income and Profile-based "Mix-and-Match" modeling.

### **Accomplishments**

- **Requirements Update (v8.3):**
  - Consolidated "Income" and "Expenses" into a single "Cash Flow Manager".
  - Introduced "Profile Library" concept for independent saving/loading of Income/Expense configurations.
  - Refined "Assets & Market Assumptions" (formerly Assumptions) to remove redundancy.
- **Architecture Update (v8.3):**
  - Updated Data Model to include a root `profiles` registry in `hgv_data.json`.
  - Defined new Context Actions: `saveProfile`, `applyProfile`.
  - Spec'd `views/expenses.jsx` as the hub for this new logic.

### **Next Steps**

- **Phase 3 Implementation:**
  - Update `DataContext` to support the new `profiles` registry and actions.
  - Build `views/expenses.jsx` with the tabbed Income/Expenses interface and Profile controls.



## 2025-11-23: Session 4 (App Shell & Advanced Loans)

**Status:** Phase 2 (Loans) Finalized. Phase 3 (Expenses) Ready.
**Focus:** transitioning from a temporary test harness to the production "App Shell" architecture and finalizing complex Loan interactions.

### **Accomplishments**
* **App Shell Architecture:**
    * Refactored `App.jsx` to act as a proper router, conditionally rendering views based on state.
    * Created `components/Sidebar.jsx` to handle global navigation and the Scenario Selector, separating it from specific views.
* **Advanced Loans Module (`views/loans.jsx`):**
    * **Auto-Calculation:** Implemented logic for "Fixed" loans where modifying Principal, Rate, or Term automatically recalculates and updates the "Monthly Payment" field.
    * **Strategy CRUD:** Added "Add (+)" and "Delete" buttons to the Strategy toolbar, allowing users to model multiple payoff scenarios (e.g., "Aggressive" vs "Base").
    * **Drag-to-Fill:** Built Excel-like functionality for the "Extra Principal" column. Users can now drag a handle to batch-copy values to future months.
    * **Performance:** Added `batchUpdateLoanPayments` to `DataContext` to handle bulk updates (Drag-to-Fill) in a single render cycle.
    * **Stability:** Fixed a crash where deleting the currently selected loan would cause a "White Screen" error; the view now safely defaults to the next available loan.
* **Documentation:**
    * Consolidated all requirements into *Requirements Specification v8.2*.
    * Updated *Architecture Overview v8.2* to reflect the App Shell and Batch Update patterns.

### **Current System Strategy**
* **Navigation:** Fully functional Sidebar with routing to Loans and Assumptions.
* **Loans:** Complete. Supports Fixed/Revolving types, Auto-Calc, Multi-Strategy, and Bulk Editing.
* **Pending:** The "Expenses" and "Dashboard" views are currently placeholders in the App Shell.

### **Next Steps**
* **Phase 3 (Expenses Module):** Build `views/expenses.jsx` to provide a UI for managing the `bills`, `home`, and `living` arrays defined in the JSON.
* **Phase 4 (Financial Engine):** Implement the core math to aggregate these expenses and loans into a Net Worth projection.

## 2025-11-23: Session 3 (Loans Module & CRUD Logic)

**Status:** Phase 2 (Logic Engines) - Loans Complete.
**Focus:** Building the interactive Debt Engine and "Configuration Form" UI.

### **Accomplishments**
* **Loan Management (CRUD):**
    * Updated `DataContext.jsx` with `addLoan` and `deleteLoan` actions.
    * Implemented safety checks to handle scenarios with zero loans.
* **Loans View (`views/loans.jsx`):**
    * Transformed the view from a static table to a **Configuration Form**.
    * Users can now edit Principal, Rate, Payment, and Loan Type directly in the view.
    * Added a Sidebar with "Add (+)" and "Delete (Trash)" functionality.
    * Integrated the "Amortization Engine" to update in real-time as inputs change.
* **Requirements Update:**
    * Updated *Requirements Specification.md* to reflect that Debt inputs are now managed in the Loans module, not the Assumptions tab.

### **Current System State**
* **Architecture:** v8.0 (Scenario-Based).
* **Working Modules:**
    * **Assumptions:** Income, Assets, Global Rates.
    * **Loans:** Full Create/Read/Update/Delete support + Payoff Strategy injection.
* **Pending Modules:**
    * **Expenses:** Currently a placeholder. Needs to be built to handle categorized monthly bills.
    * **Strategies:** Placeholder.

### **Next Steps**
* **Phase 3 (Expenses Module):** Create `views/expenses.jsx` to allow users to manage the `bills`, `home`, and `living` arrays defined in the JSON.
* **Phase 4 (Dashboard):** Connect the "Net Worth" and "Cash Flow" calculations to the new live data from Expenses and Loans.
## 2025-11-23: Session 2 (Architecture Migration v8.0)
**Status:** Phase 1 (Foundation) Complete.
**Focus:** Transitioning from a flat-file data structure to a Scenario-Based Registry to support A/B testing and advanced modeling.

### **Accomplishments**
* **Data Architecture Update:**
    * Refactored `src/data/hgv_data.json` to introduce a root `meta` object and a `scenarios` registry.
    * Migrated v7.0 data into the default scenario (`scen_default`).
* **State Management (`DataContext.jsx`):**
    * Implemented `activeScenario` logic to serve specific scenario data to views.
    * Added `switchScenario` and `createScenario` (Deep Clone) actions.
    * Added automatic timestamping (`lastUpdated`) for all data modifications.
* **UI Implementation (`App.jsx` & `Sidebar`):**
    * Added **Scenario Selector** dropdown to the Sidebar for rapid switching.
    * Implemented **"Clone to New Scenario"** button for snapshotting state.
    * Updated the Dashboard to display metrics from the `activeScenario`.
* **View Refactoring (`assumptions.jsx`):**
    * Updated inputs to bind dynamically to `activeScenario.data`.
    * Removed the legacy "Expenses" section (to be replaced by the dedicated module in Phase 3).
    * Added "Export JSON" and "Clone Scenario" controls to the view header.

### **Current System State**
* **Stability:** Passed "Smoke Test". The application loads, switches between scenarios, and saves data to the correct scenario ID without regression.
* **Missing Components:** The `src/utils/` folder was created but remains empty. The *Loans* and *Expenses* views are currently placeholders.

### **Next Steps**
* **Phase 2 (Logic Engines):** Implement `loan_math.js` (Amortization & Strategies) and `financial_engine.js` (Cash Flow Waterfall) in the `src/utils/` directory.
* **Phase 3 (UI Modules):** Build the dedicated `Loans` and `Expenses` views to interface with the new logic engines.
## 2025-11-22: Session 1 (Startup & Phase 1 UI)
* **Status:** Successfully loaded project context and environment.
* **Achievements:**
    * **Architecture Finalized:** Confirmed Data-Driven SPA approach using `DataContext` and `hgv_data.json`.
    * **Assumptions View Wired:** Integrated `assumptions.jsx` into the main `App.jsx` sidebar.
    * **Bug Fix:** Solved the "Decimal Input" issue in React where typing `3.` would reset to `3`. Implemented a `NumberInput` component with local state to handle typing vs. committing data.
    * **Snapshots:** Verified that "Save to History" correctly pushes the current state to the `history` array in Context.
* **Current State:**
    * UI is navigable.
    * User can modify all inputs (Income, Debt, Assets).
    * Dashboard shows static start-date metrics.
* **Next Steps:**
    * **Scaffold `financial_engine.js`:** This is the core priority. We need the logic to process the inputs into monthly arrays (Cash Flow, Net Worth).
    * **Dashboard Visualization:** Connect `recharts` to the output of the financial engine.





