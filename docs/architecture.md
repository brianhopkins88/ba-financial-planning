# BA Financial Planning - Technical Architecture

Version: 8.5

Date: November 25, 2025

Tech Stack: React 19, Vite, TailwindCSS, Lodash, Date-fns

## 1. Core Design Patterns

### 1.1 The "App Shell" Pattern

The application uses a persistent shell layout to separate global navigation from view-specific logic.

- **`App.jsx`**: Acts as the router and layout container.
- **`Sidebar.jsx`**: Handles global state switching (Scenarios) and navigation.
- **`views/`**: Lazy-loaded components that consume data via Context, unaware of the global router implementation.

### 1.2 Immutable State Management

We utilize a single-source-of-truth pattern using React Context (`DataContext.jsx`).

- **Initial State:** Hydrated from `src/data/hgv_data.json`.
- **Mutation Strategy:** All state updates use `lodash.cloneDeep` to ensure immutability before modification.
- **Persistence:** Currently in-memory (session-based).

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
      globals: { inflation: {}, market: {} },
      income: { activeProfileId: String, workStatus: {}, ...sources },
      expenses: { activeProfileId: String, bills: [], home: [], living: [] },
      loans: {
        [loanId]: {
          active: Boolean,
          type: "fixed" | "revolving",
          inputs: { principal, rate, payment, startDate },
          strategies: { [stratId]: { extraPayments: {} } }
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
    type: "income" | "expenses", // Module Target
    name: String,
    data: Object // The distinct payload to be injected
  }
}
```

## 3. Component Hierarchy

```
App (Shell)
├── DataProvider (Context)
│   ├── Sidebar (Navigation & Scenario Actions)
│   └── Main Content Area
│       ├── Expenses View (Cash Flow Manager)
│       │   ├── ProfileSelector (Dropdown)
│       │   ├── BillRow (Input Component)
│       │   └── BurnRateSummary (Visualizer)
│       ├── Loans View (Debt Manager)
│       │   ├── LoanList (Sidebar Selection)
│       │   ├── ConfigurationForm (Inputs)
│       │   └── AmortizationTable (Grid)
│       └── Assumptions View (Global Rates)
```

## 4. Logic Engines (Separation of Concerns)

### 4.1 `src/utils/loan_math.js`

Pure functions that handle complex financial math.

- **Inputs:** Raw Loan Object + Strategy Object.
- **Outputs:** `{ schedule: Array, summary: Object }`.
- **Dependencies:** `date-fns` for precise calendar math.

### 4.2 `src/context/DataContext.jsx`

Handles "Business Logic" regarding State mutations.

- **Scenario Switching:** Swaps the `activeScenarioId` pointer.
- **Profile Injection:** Deep copies a Profile's `data` payload into the Active Scenario's specific module node.
- **Debt Injection:** (Virtual) The `Expenses` view reads `loans` directly to calculate debt service on-the-fly; this is not stored in the DB but derived at runtime.

### 4.3 `src/views/`

Handles "Presentation Logic" and Form State.

- Components use local state (`useState`) for controlled inputs to prevent excessive Context re-renders on every keystroke (`onBlur` pattern).