import { runFinancialSimulation } from './financial_engine.js';
import pkg from 'lodash';
const { cloneDeep } = pkg;

const SYSTEM_RULES_DESCRIPTION = {
    "purpose": "Financial projection for retirement planning, analyzing solvency, assets, and cash flow over a 35-year horizon.",
    "methodology": {
        "engine": "Strict monthly deterministic simulation over horizonYears (default 35).",
        "inflation": "Smooth monthly compounding using elapsed months / 12; property tax/insurance use dedicated rates.",
        "taxes": "Effective tax tiers by work status; retirement withdrawals taxed on withdrawal.",
        "cash_flow_waterfall": "Deficits: Cash -> Joint -> Inherited IRA -> 401k -> Reverse Mortgage.",
        "investment_growth": "Age-based glide path tapering returns from 'initial' to 'terminal' between ages 60 and taperEndAge.",
        "reverse_mortgage": "Triggered when liquid assets and safety floor are depleted; forced sale when LTV exceeds age-based limit; proceeds routed to joint."
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
 * Generates a full 'AI-Ready' export containing registry, scenarios,
 * their simulation runs, and descriptive metadata.
 */
export const generateAIExport = (store) => {
    // Rebuild scenarios with registry-linked assets/liabilities for consistency
    const resolveScenario = (scen) => {
        const resolved = cloneDeep(scen);
        const links = resolved.links || { assets: [], liabilities: [], profiles: {} };

        // Start with any existing scenario data so we preserve per-scenario overrides
        const data = resolved.data ? cloneDeep(resolved.data) : {};

        // Assets: keep what the scenario already has; add any linked-but-missing from registry
        const existingAssets = data.assets?.accounts || {};
        const mergedAssets = { ...existingAssets };
        (links.assets || []).forEach(id => {
            if (!mergedAssets[id] && store.registry?.assets?.[id]) {
                mergedAssets[id] = cloneDeep(store.registry.assets[id]);
            }
        });
        data.assets = { accounts: mergedAssets };

        // Loans: keep existing; add any linked-but-missing from registry
        const existingLoans = data.loans || {};
        const mergedLoans = { ...existingLoans };
        (links.liabilities || []).forEach(id => {
            if (!mergedLoans[id] && store.registry?.liabilities?.[id]) {
                mergedLoans[id] = cloneDeep(store.registry.liabilities[id]);
            }
        });
        data.loans = mergedLoans;

        // Profiles
        data.income = data.income || {};
        data.expenses = data.expenses || {};
        data.income.profileSequence = links.profiles?.income || data.income.profileSequence || [];
        data.expenses.profileSequence = links.profiles?.expenses || data.expenses.profileSequence || [];

        resolved.data = data;
        return resolved;
    };

    const exportData = {
        meta: {
            ...store.meta,
            exportDate: new Date().toISOString(),
            appVersion: "2.1-AI-Enhanced",
            exportVersion: "2.1"
        },
        registry: store.registry || {},
        profiles: store.registry?.profiles || store.profiles || {},
        assumptions: store.registry?.assumptions || {},
        scenarios: {},
        __system_documentation: SYSTEM_RULES_DESCRIPTION
    };

    // Iterate through EVERY scenario in memory
    Object.values(store.scenarios).forEach(scenario => {
        const resolvedScenario = resolveScenario(scenario);
        // 1. Run the Simulation for this scenario
        const simulation = runFinancialSimulation(resolvedScenario, exportData.profiles, store.registry);

        // 2. Prepare the Assumption Notes
        const assumptionsDocs = {};
        Object.entries(PARAMETER_DESCRIPTIONS).forEach(([key, desc]) => {
            assumptionsDocs[key] = desc;
        });

        // 3. Construct the enriched scenario object
        exportData.scenarios[scenario.id] = {
            ...scenario, // raw inputs and links/overrides
            resolvedData: resolvedScenario.data, // explicit resolved data for transparency
            textConfig: scenario.textConfig || { narrative: '', riskProfile: '', keyEvents: [] },

            // AI METADATA (Prefixed with __ to indicate computed/informational data)
            __simulation_output: {
                timeline: simulation.timeline.map(t => ({
                    year: t.year,
                    month: t.month,
                    age: t.age,
                    netWorth: t.netWorth,
                    liquidAssets: t.balances.liquid,
                    totalDebt: t.balances.totalDebt,
                    netCashFlow: t.netCashFlow,
                    monthlyBurn: t.monthlyBurn,
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
