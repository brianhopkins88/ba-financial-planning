# BA Financial Planning - Architecture Overview



**Version:** 8.2 (Consolidated) **Date:** November 23, 2025 **Status:** Phase 2 Complete (Loans/Strategies), Phase 3 Ready (Expenses)

------



## 1. High-Level Design Pattern



The application follows a **Scenario-Based, Data-Driven Single Page Application (SPA)** architecture using a custom "App Shell" pattern.

- **Scenario-First Data Model:** The application operates on a Registry of Scenarios. The user always views and edits the "Active Scenario." All mutations are scoped to the active ID.
- **App Shell Pattern:**
  - **Shell (`App.jsx`):** The root component manages the global layout. It holds the `currentView` state and conditionally renders the active module (Loans, Expenses, etc.).
  - **Persistent Navigation (`Sidebar.jsx`):** Remains mounted at all times. Handles "Scenario Switching" and "View Navigation."
- **Separation of Concerns:**
  - **Data Layer:** `DataContext` manages the `appState` (Scenario Registry) and immutable state updates.
  - **Logic Layer:** Pure JavaScript engines (`loan_math.js`, `financial_engine.js`) process raw data into projection arrays.
  - **View Layer:** React components handle user interaction, form binding, and visualization.

------



## 2. Data Architecture





### 2.1 The Global Store (`appState`)



The root `hgv_data.json` acts as a container for multiple scenarios.

JSON

```
{
  "meta": {
    "version": "8.0",
    "activeScenarioId": "scen_default"
  },
  "scenarios": {
    "scen_default": {
      "id": "scen_default",
      "name": "Current Home HGV",
      "created": "2025-11-23T08:00:00Z",
      "lastUpdated": "2025-11-23T10:00:00Z",
      "data": {
        "globals": { ... },
        "income": { ... },
        "assets": { ... },
        "expenses": {
           "bills": [ { "id": "b1", "name": "Internet", "amount": 62 } ],
           "home": [ { "id": "h1", "name": "Tax", "amount": 1472 } ],
           "living": [ { "id": "l1", "name": "Groceries", "amount": 1200 } ]
        },
        "loans": {
           "mortgage_1": {
              "id": "mortgage_1",
              "name": "Primary Mortgage",
              "type": "fixed",
              "inputs": { "principal": 800000, "rate": 0.03, "payment": 3500 },
              "activeStrategyId": "base",
              "strategies": {
                 "base": { "name": "Minimum Payment", "extraPayments": {} },
                 "strat_1": { 
                    "name": "Aggressive Payoff", 
                    "extraPayments": { "2026-05": 5000, "2026-06": 5000 } 
                 }
              }
           }
        }
      }
    }
  }
}
```



### 2.2 Data Context Actions (`src/context/DataContext.jsx`)



The Context provider exposes specific "Action Reducers" to modify the store safely.

- **Scenario Management:**
  - `switchScenario(id)`: Updates `meta.activeScenarioId`.
  - `createScenario(name)`: Deep clones the active scenario, generates a new ID, and sets it as active.
  - `updateScenarioData(path, value)`: Generic setter using `lodash.set`. Updates `lastUpdated` timestamp.
- **Loan Management:**
  - `addLoan() / deleteLoan(id)`: Manages the collection of liability objects.
  - `addLoanStrategy(loanId, name)`: Creates a new strategy sub-object.
  - `deleteLoanStrategy(loanId, stratId)`: Removes a custom strategy (protects 'base').
- **Performance Optimization:**
  - `batchUpdateLoanPayments(loanId, stratId, updates)`: Accepts a map of `{ date: value }`. Applies potentially dozens of updates in a single state transition. *Architecture requirement for the Drag-to-Fill feature.*

------



## 3. Directory Structure



Plaintext

```
src/
├── components/
│   ├── Sidebar.jsx         # Global Nav & Scenario Selector
│   └── Layout.jsx          # (Optional) Layout Wrapper
├── context/
│   └── DataContext.jsx     # State Store, Action Reducers, Batch Logic
├── data/
│   └── hgv_data.json       # Initial State
├── utils/
│   ├── financial_engine.js # (Pending Phase 4) Cash Flow & Net Worth
│   └── loan_math.js        # Amortization & Revolving Debt Math
├── views/
│   ├── assumptions.jsx     # Form: Income/Assets
│   ├── dashboard.jsx       # (Pending Phase 4) Visual Results
│   ├── expenses.jsx        # (Pending Phase 3) Categorized Lists
│   └── loans.jsx           # Complex View: Debt Manager & Strategy Engine
└── App.jsx                 # Application Shell (Router & View Injection)
```

------



## 4. Component Technical Implementation





### 4.1 Loans Module (`views/loans.jsx`)



This view is a self-contained "Application within an Application".

- **Safe Selection State:** The view derives the `activeLoanId`. If the selected ID is deleted, the component logic automatically falls back to the next available ID during the render cycle to prevent "White Screen" crashes.
- **Auto-Calculation Handler:**
  - On input change (Principal, Rate, Term), the view locally calculates the new PMT using the Amortization Formula.
  - It dispatches an update to the `payment` field automatically, keeping data consistent.
- **Grid Interaction (Drag-to-Fill):**
  - **UI:** Custom table cell with a "Drag Handle" (blue square).
  - **Events:** Listens to `onMouseDown`, `onMouseEnter`, and global `onMouseUp`.
  - **Logic:** Calculates the range of indices selected, extracts the value from the start cell, and dispatches a `batchUpdateLoanPayments` action.



### 4.2 Expenses Module (`views/expenses.jsx`) - *Phase 3 Specification*



- **Structure:** Displays three distinct lists (`bills`, `home`, `living`).
- **Row Component:** Each row contains an editable Name and Amount.
- **Aggregator:** The view (or a utility) sums these lists to display a "Total Monthly Obligations" header, which feeds into the Dashboard's burn rate.



### 4.3 Financial Engine (Phase 4)



- **Input:** Active Scenario Data.
- **Process:**
  1. **Time Series Generation:** Creates an array of months from Start Date to Term Limit (e.g., age 95).
  2. **Cash Flow Waterfall:** For each month, calculates `Income - (Expenses + Loan PMTs)`.
  3. **Net Worth Waterfall:** Applies surplus/deficits to asset balances based on Liquidity Rules.
- **Output:** Objects for `Recharts` consumption (`data={ [{ year: 2025, netWorth: 1.2m }, ...] }`).