# BA Financial Planning - Technical Architecture

Version: 0.7 (Updated Session 9)

Date: November 27, 2025

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
  3. **Polyfill/Migration:** Automatically injects missing fields (e.g., `globals.timing`, `expenses.impounds`, `income.brian.birthYear`) if loading an older data structure.
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
        timing: { startYear: 2026, startMonth: 1 },
        currentModelDate: "2026-01-01", // Time Machine Cursor
        inflation: {},
        market: {}
      },
      income: {
        brian: { birthYear: 1966, ... }, // Birth Year drives Age Projections
        andrea: { birthYear: 1965, ... },
        ...sources
      },
      expenses: {
        activeProfileId: String,
        profileSequence: [],
        bills: [],
        impounds: [],
        home: [],
        living: [],
        oneOffs: [],     // Specific Future Items
        retirementBrackets: { "65": 15000, "70": 10000 } // Long-Term Rules
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

## 3. Component Hierarchy

```
App (Shell)
├── DataProvider (Context)
│   ├── Sidebar (Navigation, Global Actions, Scenario Manager)
│   └── Main Content Area
│       ├── TopBar (Global Date Engine & Time Travel)
│       │
│       ├── Expenses View (Cash Flow Manager)
│       │   ├── ExpenseSummary (New: 35-Year Projection Engine)
│       │   ├── ProfileMenu (Consolidated Actions)
│       │   ├── ExpenseGroup (Accordion: Bills, Impounds, Home, Living)
│       │   ├── OtherLoans (Accordion: Monthly Debt Service with Payoff Logic)
│       │   └── ExtraExpensePlanning (Accordion: Future Expenses & Fun Money Rules)
│       │
│       ├── Loans View (Debt Manager)
│       │   ├── LoanList (Sidebar Selection)
│       │   ├── ConfigurationForm (Inputs)
│       │   └── AmortizationTable (Grid w/ Drag-to-Fill)
│       │
│       ├── Income View (Salary & Bonus)
│       └── Assumptions View (Global Rates & Birth Years)
```

## 4. Logic Engines (Separation of Concerns)

### 4.1 `src/utils/loan_math.js`

Pure functions that handle complex financial math. This is a critical utility used by multiple views.

- **Inputs:** Raw Loan Object + Strategy Object.
- **Outputs:** `{ schedule: Array, summary: Object }`.
- **Logic:** Handles Fixed vs. Revolving logic, payment overrides, and accurate payoff date calculation.

### 4.2 The "Bridge" Pattern (Expenses Integration)

In Version 0.7, we established a direct dependency between the **Expenses View** and the **Loan Math Engine** to ensure projection accuracy.

- **Problem:** The `Expenses` view needs to know exactly when a loan is paid off to stop showing payments in the 35-year projection. Simply multiplying `monthlyPayment * 12` is inaccurate for loans with aggressive early payoff strategies (e.g., HELOCs).
- **Solution:** `src/views/expenses.jsx` imports `calculateFixedLoan` and `calculateRevolvingLoan` directly. It runs the math for every active loan on-the-fly to generate the projection bars and the "Other Loans" list.

### 4.3 `src/context/DataContext.jsx`

The "Brain" of the application.

- **Scenario Management:** Create, Rename, Delete, Clone scenarios.
- **Import/Export:** Parsing JSON, merging Linked Profiles, handling ID collisions.
- **State Mutations:** CRUD operations for all data points.

## 5. Data Flow Diagram (v0.7)

```
graph TD
    DataStore[hgv_data.json / localStorage] --> DataContext
    DataContext --> LoansView
    DataContext --> ExpensesView
    DataContext --> IncomeView
    
    subgraph Math Layer
        LoanMath[utils/loan_math.js]
    end

    LoansView -- Inputs --> LoanMath
    LoanMath -- Schedule --> LoansView

    ExpensesView -- Inputs --> LoanMath
    LoanMath -- Payoff Dates & Amounts --> ExpensesView
    
    note[Note: Expenses View now calculates Loan Amortization independently to project accurate future cash flow.]
```