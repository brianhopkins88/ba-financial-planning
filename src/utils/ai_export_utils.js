import { runFinancialSimulation } from './financial_engine';

const SYSTEM_RULES_DESCRIPTION = {
    "purpose": "Financial projection for retirement planning, analyzing solvency, assets, and cash flow over a 35-year horizon.",
    "methodology": {
        "engine": "Hybrid deterministic simulation. Monthly resolution for Years 1-5, Annual resolution for Years 6-35.",
        "inflation": "Applied annually to expenses and specific income streams (Social Security, Pensions).",
        "taxes": "Simplified tax tier system based on work status (Full-time vs Retired).",
        "cash_flow_waterfall": "Deficits are covered in this order: Cash -> Joint Investments -> Inherited IRA -> 401k -> Reverse Mortgage.",
        "investment_growth": "Uses an age-based glide path (IARRA) tapering returns from 'Initial' to 'Terminal' rates between ages 60 and 85.",
        "reverse_mortgage": "Automatically triggered if liquid assets are depleted and 401k hits a safety floor. Accrues interest, capped by age-based LTV."
    }
};

const PARAMETER_DESCRIPTIONS = {
    "assumptions.inflation.general": "Annual inflation rate applied to general living expenses and discretionary spending.",
    "assumptions.market.initial": "Target investment return rate during the accumulation phase (pre-retirement).",
    "assumptions.market.terminal": "Target investment return rate during the preservation phase (late retirement).",
    "assumptions.property.baselineGrowth": "Base annual appreciation rate for real estate assets.",
    // REFACTORED: Changed from legacy key to 'primary' for consistency with v1.3 Identity Refactor
    "income.primary.netSalary": "Annual take-home pay used for cash flow modeling.",
    "expenses.living": "Discretionary living expenses (food, entertainment, travel) excluding fixed bills.",
    "loans.mortgage": "Primary mortgage details. Principal reduction increases Net Worth; Interest is a sunk cost."
};

/**
 * Generates a full 'AI-Ready' export containing all scenarios,
 * their full simulation runs, and descriptive metadata.
 */
export const generateAIExport = (store) => {
    const exportData = {
        meta: {
            ...store.meta,
            exportDate: new Date().toISOString(),
            appVersion: "1.0-AI-Enhanced"
        },
        profiles: store.profiles,
        scenarios: {},
        __system_documentation: SYSTEM_RULES_DESCRIPTION
    };

    // Iterate through EVERY scenario in memory
    Object.values(store.scenarios).forEach(scenario => {
        // 1. Run the Simulation for this scenario
        const simulation = runFinancialSimulation(scenario, store.profiles);

        // 2. Prepare the Assumption Notes
        const assumptionsDocs = {};
        Object.entries(PARAMETER_DESCRIPTIONS).forEach(([key, desc]) => {
            assumptionsDocs[key] = desc;
        });

        // 3. Construct the enriched scenario object
        exportData.scenarios[scenario.id] = {
            ...scenario, // The raw inputs (id, name, data, including the new expenses.isFunMoneyInflationAdjusted flag)

            // AI METADATA (Prefixed with __ to indicate computed/informational data)
            __simulation_output: {
                timeline: simulation.timeline.map(t => ({
                    year: t.year,
                    age: t.age,
                    netWorth: t.netWorth,
                    liquidAssets: t.balances.liquid,
                    totalDebt: t.balances.totalDebt,
                    netCashFlow: t.netCashFlow,
                    insolvencyOccurred: t.shortfall > 0
                })),
                events: simulation.events
            },
            __assumptions_documentation: {
                description: "Key parameters used in this scenario and their definitions.",
                notes: assumptionsDocs
            }
        };
    });

    return JSON.stringify(exportData, null, 2);
};