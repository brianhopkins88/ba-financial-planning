# BA Financial Analysis Application – Architecture Specification (v1.2)

**Date:** December 1st, 2025
**Version:** 1.2 (Strict Monthly Engine & Consolidated Cash Flow)

---

## 1. Executive Summary

### 1.1 Purpose
This document describes the end‑to‑end architecture for the **BA Financial Analysis** application, a client‑side financial planning tool that helps a household understand solvency risks over a 35-year horizon.

### 1.2 Major Changes in v1.2
- **Engine Core:** Shifted from Hybrid (Monthly/Annual) to **Strict Monthly Simulation** (420 steps) to ensure calculation precision and eliminate compounding drift.
- **Module Consolidation:** Merged Income and Expense management into a unified **Cash Flow Manager** to prevent state desynchronization.
- **RMD Logic:** Refactored Required Minimum Distributions (RMDs) as "Cash Injections" (Asset -> Cash transfer) rather than taxable income streams in the Operating Cash Flow.

---

## 2. Business Architecture

### 2.1 Capabilities
1. **Scenario‑Based Planning:** Clone, rename, and export independent financial scenarios.
2. **Unified Cash Flow:** Manage Work Status, Salary, Social Security, Pension, and Expenses in one view.
3. **Advanced Housing Logic:** Model current home equity, future construction, and automated Reverse Mortgage triggers.
4. **Lifecycle Simulation:** Three-phase projection:
   - **Phase 1:** Standard Accumulation/Decumulation.
   - **Phase 2:** Reverse Mortgage (Active-RM) when liquid assets fail.
   - **Phase 3:** Forced Sale & Spend-Down when LTV limits are breached.

---

## 3. Data Architecture

### 3.1 Logical Data Model
- **Scenario:** Top-level container.
- **Profile:** Reusable configuration for Income or Expenses (time-phased via `profileSequence`).
- **Data Store:** `localStorage` key `ba_financial_planner_v1.1`.

### 3.2 Schema Updates (v1.2)
- **Income Profile:** Added `birthMonth` (1-12) to person objects for precise first-year proration.
- **RMD Handling:** RMD schedules are now inputs on the `asset` object (Inherited IRA), not global income streams.

---

## 4. Application Architecture

### 4.1 High‑Level Modules

**App Shell**
- **Sidebar:** Scenario Selector, Global Actions.
- **Time Machine:** Global `simulationDate` cursor.

**Core Views**
1. **Dashboard:** High-level metrics (Net Worth, Solvency, Liquidity).
2. **Cash Flow Manager (NEW):**
   - **Unified Editor:** Tabs for Income and Expenses.
   - **Detailed Analysis Table:** Annual aggregate view of all inflows and outflows.
   - **Profile Manager:** Time-phased activation of income/expense sets.
3. **Liabilities Manager:** Mortgage, HELOC, and System Reverse Mortgage tracking.
4. **Assets & Property:** Liquid assets, Property valuation, and Inherited IRA 10-year rule management.
5. **Assumptions:** Global rates (Inflation, Tax Tiers, Market Returns).

### 4.2 Financial Engine Service (`financial_engine.js`)

**Architecture: Strict Monthly Loop**
- **Input:** Scenario Data + Profiles.
- **Process:** Iterates exactly 420 times (35 Years x 12 Months).
- **State Machine:**
  - `state`: Current Month Balances (Cash, Joint, IRA, 401k, Debt).
  - `accumulators`: Annual totals for reporting (reset every January).
- **Key Logic:**
  - **Inflation:** `(1 + rate) ^ (elapsed_months / 12)`.
  - **Waterfall:** Deficit coverage order (Cash -> Joint -> IRA -> 401k -> Reverse Mortgage).
  - **RMD Injection:** Executed in Month 1 (Jan), transfers net proceeds to Cash.

**Outputs:**
- `timeline`: Array of 420 monthly snapshots (or 35 annual summaries depending on view).
- `events`: Log of critical state changes (Retirement, Insolvency, Forced Sale).

### 4.3 Component Interaction

```
flowchart LR
  subgraph UI[UI Layer]
    Shell[App Shell]
    Dash[Dashboard]
    CF[Cash Flow Mgr]
    Liab[Liabilities Mgr]
    Assets[Assets Mgr]
  end

  subgraph Store[Data Layer]
    Context[DataContext]
    LocalStorage[(Browser Storage)]
  end

  subgraph Logic[Domain Services]
    Engine[Financial Engine (Monthly)]
    LoanMath[Loan Math]
    AssetMath[Asset Math]
  end

  Shell --> Context
  Dash --> Engine
  CF --> Engine
  Liab --> LoanMath
  Assets --> AssetMath
  
  Engine --> LoanMath
  Engine --> AssetMath
  
  Context <--> LocalStorage
  Context --> Engine
```



## **5. Technology Architecture**

### **5.1 Technology Stack**

- **Framework:** React 18+ (Vite).
- **Language:** JavaScript (ES6+) / JSX.
- **State Management:** React Context API + useReducer pattern.
- **Visualization:** Recharts (Responsive Container).
- **Styling:** Tailwind CSS.
- **Utilities:** date-fns (Date Math), lodash (Deep Cloning/Setting).

### **5.2 Non‑Functional Requirements**

- **Performance:** Simulation re-calc must occur in < 200ms to support real-time "slider" adjustments.
- **Precision:** Financial calculations use standard floating-point math; display logic handles rounding to nearest dollar.
- **Privacy:** Zero server-side data persistence; all data resides on the client device.



------



## **6. Future Roadmap**

- **Scenario Comparison:** Side-by-side visualization of two distinct scenarios (e.g., "Retire 65" vs "Retire 67").
- **Tax Modeling:** Implementation of progressive tax brackets and location-specific tax rules.

**Cloud Sync:** Optional encrypted backup to cloud storage (User Story 10).
