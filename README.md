# BA Financial Analysis

Client-side financial planning app that simulates household solvency over a configurable horizon using a registry-first scenario model and strict monthly engine.

## Runbook
- Install: `npm install`
- Develop: `npm run dev` (Vite with HMR)
- Test: `npm test`
- Lint: `npm run lint`
- Build: `npm run build`

## Key Features
- Registry/Scenario overlay with field-level overrides for assets, liabilities, and profiles.
- Cash Flow Manager with monthly burn, projections, and property-aware housing costs.
- Dashboard, Ledger, Loans, Assets, Scenario Builder, and Scenario Compare views.
- Configurable assumptions (inflation, property insurance, healthcare inflation, market glide path, projection horizon).
- Exports: full app snapshot or AI analysis export; folder-based save when supported.
- Help & User Manual (via sidebar three-dot menu) with searchable topics and quick-start guidance.

## Data & Persistence
- Local storage persistence with v3.3.0 schema and migrations for older snapshots.
- Import/Export strips DOM noise and keeps registry canonical; scenarios rebuilt from registry + overrides.

## Tips
- Set start month and horizon in Assumptions; navigation clamps to the scenario window.
- Duplicate profiles before major edits; keep an export backup in your chosen folder.
- Use the horizon jump buttons to inspect end-of-plan solvency and reverse-mortgage behavior.
