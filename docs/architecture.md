# BA Financial Planning - Technical Architecture

Version: 9.0

Date: November 26, 2025

**Tech Stack:** React 19, Vite, TailwindCSS, Lodash, Date-fns

## 1. Core Design Patterns

### 1.1 The "App Shell" Pattern

The application uses a persistent shell layout to separate global navigation from view-specific logic.

- **`App.jsx`**: Acts as the router and layout container.
- **`Sidebar.jsx`**: Handles global state switching (Scenarios), global actions (Import/Export), and navigation.
- **`views/`**: Lazy-loaded components that consume data via Context, unaware of the global router implementation.

### 1.2 Robust State Management & Persistence

We utilize a single-source-of-truth pattern using React Context (`DataContext.jsx`) with a "Robust Loader" strategy.

- **Initial State:**
  1. **Load from `localStorage`:** Checks for a saved state first.
  2. **Schema Validation:** Verifies the loaded data has critical fields (`meta`, `scenarios`).
  3. **Polyfill/Migration:** Automatically injects missing fields (e.g., `globals.timing`, `expenses.impounds`) if loading an older data structure.
  4. **Fallback:** Reverts to `src/data/hgv_data.json` if local storage is corrupt or empty.
- **Persistence:**
  - **Auto-Save:** Every state change triggers a write to `localStorage`.
  - **Export:** Generates a downloadable JSON file containing the **Active Scenario** + **Linked Profiles**.
- **Mutation Strategy:** All state updates use `lodash.cloneDeep` to ensure immutability before modification.

## 2. Data Structures & Schema

The application logic relies on two distinct data registries within the global store.

### 2.1 The Scenario Registry

Stores complete, isolated snapshots of the financial model.

```
scenarios: {
  [scenarioId]: {
    id: String,
    name: String,
    created: ISOString,
    lastUpdated: ISOString,
    data: {
      globals: {
        timing: { startYear: 2025, startMonth: 1 }, // Global Date Engine
        inflation: {},
        market: {}
      },
      income: {
        activeProfileId: String,
        profileSequence: [ { profileId, startDate, isActive } ],
        workStatus: { [year]: { brian: 1.0, andrea: 0.6 } },
        ...sources
      },
      expenses: {
        activeProfileId: String,
        profileSequence: [],
        bills: [],      // Recurring Bills
        impounds: [],   // Mortgage, Tax, Insurance
        home: [],       // HOA, Maintenance
        living: [],     // General Spending
        oneOffs: []     // Future Expense Planning
      },
      loans: {
        [loanId]: {
          active: Boolean,
          type: "mortgage" | "fixed" | "revolving",
          inputs: { principal, rate, payment, startDate },
          activeStrategyId: String,
          strategies: {
            [stratId]: { name: String, extraPayments: { [YYYY-MM]: Number } }
          }
        }
      },
      assets: { joint, retirement, property }
    }
  }
}
```

### 2.2 The Profile Registry

Stores partial data chunks for "Mix-and-Match" injection.

```
profiles: {
  [profileId]: {
    id: String,
    type: "income" | "expenses",
    name: String,
    data: Object // The distinct payload to be injected
  }
}
```

### 2.3 The Export Object (Portable Plan)

When exporting, the system creates a self-contained object:

```
{
  ...scenarioObject,
  linkedProfiles: {
     [profileId]: { ...profileData } // Only profiles used by this scenario
  }
}
```

## 3. Component Hierarchy

```
App (Shell)
├── DataProvider (Context)
│   ├── Sidebar (Navigation, Global Actions, Scenario Manager)
│   └── Main Content Area
│       ├── TopBar (Global Date Engine & Time Travel)
│       │
│       ├── Expenses View (Cash Flow Manager)
│       │   ├── ProfileManager (Timeline & Activation)
│       │   ├── FutureExpensesModule (One-Off Planning)
│       │   │   ├── DataEntryTable
│       │   │   └── Visualizer (Bar Chart)
│       │   ├── ExpenseGroup (Accordion: Bills, Impounds, Home, Living)
│       │   └── ActiveDebtSummary (Computed from Loans)
│       │
│       ├── Loans View (Debt Manager)
│       │   ├── LoanList (Sidebar Selection)
│       │   ├── ConfigurationForm (Inputs)
│       │   └── AmortizationTable (Grid w/ Drag-to-Fill)
│       │
│       ├── Income View (Salary & Bonus)
│       └── Assumptions View (Global Rates)
```

## 4. Logic Engines (Separation of Concerns)

### 4.1 `src/utils/loan_math.js`

Pure functions that handle complex financial math.

- **Inputs:** Raw Loan Object + Strategy Object.
- **Outputs:** `{ schedule: Array, summary: Object }`.
- **Logic:** Handles Fixed vs. Revolving logic, payment overrides, and payoff dates.

### 4.2 `src/context/DataContext.jsx`

The "Brain" of the application.

- **Scenario Management:** Create, Rename, Delete, Clone scenarios.
- **Import/Export:** Parsing JSON, merging Linked Profiles, handling ID collisions.
- **State Mutations:** CRUD operations for all data points.
- **Safety:** Prevents crashes by validating data on load and providing default fallbacks.

### 4.3 `src/views/`

Handles "Presentation Logic" and View-Specific State.

- **Expense Categorization:** The `Expenses` view strictly renders categories based on the JSON arrays (`bills`, `impounds`, `home`, `living`) without auto-sorting, ensuring user intent is preserved.
- **Loan Visibility:** The `Expenses` view filters the "Active Debt" list to only show loans that have started by the current Simulation Date.