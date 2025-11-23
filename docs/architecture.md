# BA Financial Planning - Architecture Overview

**Version:** 8.0
**Date:** November 23, 2025
**Status:** Phase 2 Design (Scenario-Based Architecture & Advanced Modules)

---

## 1. High-Level Design Pattern
The application follows a **Scenario-Based, Data-Driven Single Page Application (SPA)** architecture.

* **Scenario-First Data Model:** The application no longer operates on a single flat data set. Instead, it manages a registry of **Scenarios**. The user always views and edits the "Active Scenario".
* **Separation of Concerns:**
    * **Data Layer:** `DataContext` manages the `appState` (Scenario Registry).
    * **Logic Layer:** Pure JavaScript engines (`financial_engine.js`, `loan_math.js`) process raw data into projection arrays.
    * **View Layer:** React components allow data entry and visualization (Charts/Tables).
* **Granular "Strategies":** For complex modules like Loans, the data model supports "Sub-scenarios" (Strategies) to allow A/B testing of different payment plans without duplicating the entire scenario.

---

## 2. Data Architecture

### 2.1 The Global Store (`appState`)
The root `hgv_data.json` now acts as a container for multiple scenarios.

```json
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
        "globals": {
           "inflation": { "general": 0.025, "medical": 0.05 },
           "market": { "initial": 0.07, "terminal": 0.035 }
        },
        "income": {
           "brian": { "netSalary": 168000, "workStatus": { "2026": 1.0 } },
           "andrea": { "netSalary": 105000, "workStatus": { "2026": 1.0 } }
        },
        "assets": {
           "joint": 99000,
           "retirement401k": 950000
        },
        "expenses": {
           "bills": [ { "id": "e1", "name": "Internet", "amount": 62 } ],
           "home": [ { "id": "e2", "name": "Property Tax", "amount": 1472 } ],
           "living": [ { "id": "e3", "name": "General Living", "amount": 4500 } ]
        },
        "loans": {
           "mortgage_1": {
              "id": "mortgage_1",
              "name": "Primary Mortgage",
              "type": "fixed",
              "inputs": {
                 "principal": 801000,
                 "rate": 0.0325,
                 "payment": 3489,
                 "startDate": "2019-10-01"
              },
              "activeStrategyId": "base",
              "strategies": {
                 "base": { "name": "Minimum Payment", "extraPayments": {} },
                 "aggressive": { "name": "Payoff 2030", "extraPayments": { "2026-05": 5000 } }
              }
           }
        }
      }
    }
  }
}
```

### 2.2 Data Context Actions (`src/context/DataContext.jsx`)



- **`switchScenario(scenarioId)`**: Updates `meta.activeScenarioId`. The UI immediately re-renders with the new data set.
- **`createScenario(name)`**:
  1. Deep clones the currently active scenario.
  2. Generates a new ID (e.g., `scen_timestamp`).
  3. Updates the name and metadata.
  4. Sets it as active.
- **`updateScenarioData(path, value)`**:
  1. Target: `scenarios[activeScenarioId].data`.
  2. Action: Uses `lodash.set` to update the specific field.
  3. **Timestamp:** Updates `lastUpdated` to `new Date().toISOString()`.
- **`addLoanStrategy(loanId, name)`**:
  1. Adds a new key to the specific loan's `strategies` object.
  2. Copies the "base" empty structure.

------



## 3. Directory Structure

src/
├── context/
│   └── DataContext.jsx     # Handles Multi-Scenario State & Timestamping
├── data/
│   └── hgv_data.json       # Initial State (Default Scenario)
├── utils/
│   ├── financial_engine.js # (Pending) Core Cash Flow & Net Worth Logic
│   └── loan_math.js        # (Pending) Amortization & Revolving Debt Math
├── views/
│   ├── dashboard.jsx       # Results & Charts
│   ├── expenses.jsx        # (New) Categorized Monthly Expense Editor
│   ├── loans.jsx           # (New) Loan List & Amortization Strategy View
│   └── assumptions.jsx     # (Refactored) Income, Assets, Global Rates
├── components/
│   ├── Sidebar.jsx         # Includes Scenario Selector Dropdown
│   ├── Layout.jsx          # Wrapper showing "Data as of: [Date]"
│   ├── NumberInput.jsx     # Helper for decimal inputs
│   └── LoanDetail.jsx      # (New) Amortization Table Component
└── App.jsx                 # Routing & Layout Composition

## 4. Technical Implementation Logic





### 4.1 Timestamping & Versioning



- **Requirement:** Display "Data as of: [Date]" on every screen.
- **Implementation:** The `Layout` component reads `scenarios[activeID].lastUpdated`.
- **Trigger:** Every call to `updateData` automatically refreshes this timestamp.



### 4.2 Expenses Module



- **Structure:** Three arrays (`bills`, `home`, `living`).
- **Interaction:**
  - **Edit:** Users edit the `amount` of existing rows.
  - **Add/Remove:** Users can push new objects `{id, name, amount}` to these arrays.
- **Integration:** The `financial_engine.js` aggregates these arrays (summing `amount`) to determine the monthly "Base Expense" line item in the cash flow.



### 4.3 Loans Module (The Strategy Engine)



- **State:** Each Loan has multiple `strategies`.
- **Amortization Calculation:**
  - Input: `inputs` (Principal, Rate) + `strategies[active].extraPayments`.
  - Logic: Iterates month-by-month.
  - `ExtraPayment` Lookup: Checks if `YYYY-MM` exists in the `extraPayments` hash map for the current step.
- **UI Interaction:**
  - The Amortization Table allows direct input into an "Extra Principal" column.
  - **On Change:** Updates `strategies[active].extraPayments[currentMonth]`.
  - **Effect:** Re-runs the calculation immediately to show the new Payoff Date.



### 4.4 Dashboard (Visualization)



- **Data Source:** `financial_engine.js` output.
- **Responsiveness:**
  - Changing an Assumption re-runs the Engine.
  - Switching Scenarios re-runs the Engine with the new dataset.
- **Libraries:** `recharts` for Area Charts (Net Worth) and Composed Charts (Cash Flow).