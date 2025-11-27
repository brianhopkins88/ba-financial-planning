# **BA Financial Analysis - Requirements Specification**

Version: 0.7 (Updated Session 9)

Date: November 27, 2025

# 1. System Architecture & Data Strategy

## 1.1 Scenario-Based Data Model

- **Core Concept:** Financial data is encapsulated within Scenarios rather than global state. Each Simulation, Profile, Loan, and Asset configuration belongs to an active Scenario context.
- **Root Structure:**
  - `scenarios`: Comprehensive financial snapshots (Income, Expenses, Loans, Assets, Market Rates).
  - `profiles`: Reusable partial configurations for Income and Expense setups.
- **Data Persistence:**
  - **Local Storage:** The application automatically saves the full state to the browser's `localStorage` on every change to prevent data loss on refresh.
  - **Export:** Users can export the active Scenario as a JSON file.
  - **Linked Profiles:** The exported JSON must bundle the **Scenario Data** AND any **Linked Profiles** (Income/Expense profiles used in that scenario) to ensure the file is portable and self-contained.
- **Importing:**
  - **"Upload to Current":** Overwrites the active scenario with data from a file.
  - **"Upload as New":** Creates a new scenario from a file.

## 1.2 Global User Interface (App Shell)

- **Sidebar Navigation:**
  - **Global Actions Menu:** A top-level menu icon containing:
    - Save Changes (Force Persist).
    - Export Data (Download JSON).
    - Upload to Current / Upload as New.
    - Create Blank Scenario.
    - Clear Current Data (Reset).
  - **Scenario Selector:** A rich dropdown list displaying all available scenarios.
    - **Inline Actions:** Users can **Rename**, **Clone**, and **Delete** scenarios directly from this list.
  - **Module Links:** Dashboard, Income, Expenses, Loans, Assets (New), Assumptions.
- **Top Bar (Time Machine):**
  - **Global Date Engine:** Displays "Scenario Start Date" and "Current Model Month" (e.g., Jan 2026).
  - **Persistence:** The "Current Model Month" cursor is saved to the scenario data, allowing users to pick up exactly where they left off in the simulation.
  - **Time Travel:**
    - Forward/Back arrows step 1 month.
    - **Press & Hold:** Accelerates traversal (Month -> Quarter -> Year jumps).

# 2. Financial Modules

## 2.1 Loans & Debt Manager

- **Loan Types:**
  - **Mortgage:** Treated mathematically as a Fixed loan but grouped separately in Expenses.
  - **Fixed:** Standard amortization (Auto, Personal).
  - **Revolving:** Interest-calculated (HELOC, Credit Cards).
- **Payoff Profiles (Strategies):**
  - Users can define multiple payoff strategies per loan (e.g., "Base", "Aggressive").
  - **Rich Menu:** Users can **Rename**, **Duplicate**, and **Delete** profiles.
  - **Drag-to-Fill:** Users can bulk-fill "Extra Principal" payments in the amortization grid.
- **Status & Visibility:**
  - **Active Toggle:** Loans can be set to Active/Inactive.
  - **Visibility:** All Active loans must appear in the "Other Loans" summary in Expenses.

## 2.2 Income Manager

- **Components:**
  - **Base Salary:** Net monthly pay for Person A (Brian) and Person B (Andrea).
  - **Annual Bonus:**
    - Inputs: **Net Amount** and **Payout Month**.
    - Logic: Bonus is injected into the cash flow in the specified month (subject to Work Status).
  - **Work Status Trajectory:** 10-year table defining FTE (0.0 - 1.0) for each person.
- **Profile Management:**
  - Time-phased profiles (e.g., "Working" vs "Retired").
  - Profiles allow "Mix-and-Match" modeling.

## 2.3 Expenses Manager

- **Projections (New):**
  - **Expense Summary:** A collapsible section at the top of the view.
  - **Visualization:** A 35-year bar chart projecting total annual expenses.
    - **Scale:** Fixed vertical scale (Max $300k) with visual "overflow" indicators (red bars) for years exceeding the limit.
  - **Data Table:** Yearly breakdown of Recurring, Loan Payments, and Planned Extra Expenses.
  - **Logic:** Must run actual loan amortization schedules to correctly project payoff dates (preventing "zombie" payments after a loan is paid off).
- **Categorization Logic (Strict Rules):**
  1. **Recurring Bills:** General utilities, subscriptions.
  2. **Mortgage & Impounds:** Property Tax, Insurance, and Active Mortgage loans.
  3. **Home Expenses:** HOA, Landscaping, Housekeeping.
  4. **Living Expenses:** General variable spending.
  5. **Other Loans (Moved):** Located under Living Expenses. Displays aggregate monthly debt service. Expands to show individual loan breakdowns (Minimum vs. Extra Principal).
- **CRUD Capabilities:**
  - Users must be able to **Add**, **Edit**, and **Delete** line items in all categories.
- **Profile Management:**
  - **Unified Actions:** "Save", "Save As", and "Timeline Manager" consolidated into a single dropdown menu.

## 2.4 Extra Expense Planning (Renamed)

- **Purpose:** Managing "One-Off" capital outlays and Long-Range Retirement spending.
- **Dual Views:**
  1. **Specific Planned Items:**
     - Table of specific future expenses (Vehicles, Weddings, Renovations).
     - **Loan Pull:** Automatically imports "Extra Principal" payments from the Loans module.
  2. **Long-Term Fun Money Rules (New):**
     - **Rule-Based Input:** Users define annual budgets for "Fun Money" (Travel/Vacation) for specific age brackets.
     - **Brackets:** 5-year increments starting at Age 65 (e.g., 65-69, 70-74... up to 90).
     - **Age Context:** Display the corresponding Calendar Years for these brackets based on the primary user's birth year.

## 2.5 Assets & Assumptions

- **Global Rates:** Inflation (General, Medical, Tax Cap), Market Returns (Initial, Terminal, Taper Age).
- **Personal Data (New):**
  - **Birth Years:** Input fields for Person A and Person B to drive age-based calculations in the Expense and Income modules.
- **Assets:** Starting balances for Joint, Retirement, and Property.

# 3. Visualization & Dashboard (Phase 4)

- *Pending Implementation.*
- **Financial Engine:**
  - Logic to aggregate all inputs (Income, Expenses, Debt, Future Expenses) into a monthly Net Worth projection.
- **Visuals:**
  - Net Worth Line Chart.
  - Liquidity Gauge.
  - Solvency Status.

# Version History

- **0.7 (Session 9):**
  - **Expense Overhaul:** Added 35-year Projections, Long-Term "Fun Money" Rules, and integrated Loan Amortization Engine.
  - **UI:** Renamed Future Expenses to "Extra Expense Planning", moved "Other Loans" to Living Expenses.
  - **Data:** Added Birth Years and fixed Start Date to Jan 2026.
- **0.6 (Session 8):** Finalized Expense Categorization rules, CRUD for Impounds, Future Expense Submodule.
- **0.5:** Added Global Date Engine, Dynamic Navigation, Profile Manager rules.