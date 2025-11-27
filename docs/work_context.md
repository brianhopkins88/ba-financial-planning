# This file contains notes about the work that has happened so far
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





