import { runFinancialSimulation } from './financial_engine.js';
import pkg from 'lodash';
const { cloneDeep, get } = pkg;

const SYSTEM_RULES_DESCRIPTION = {
    "purpose": "Financial projection for retirement planning, analyzing solvency, assets, and cash flow over a configurable horizon (default 35 years).",
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
    "income.primary.netSalary": "Annual take-home pay used for cash flow modeling.",
    "expenses.living": "Discretionary living expenses (food, entertainment, travel) excluding fixed bills.",
    "loans.mortgage": "Primary mortgage details. Principal reduction increases Net Worth; Interest is a sunk cost."
};

const CALCULATION_NOTES = [
    "Monthly deterministic cash-flow simulation with compounding between deposits/withdrawals; inflation applied monthly to eligible categories.",
    "Asset growth follows an age-based glide path that linearly tapers returns from the 'initial' rate toward 'terminal' between ages 60 and taperEndAge.",
    "Withdrawal waterfall: cover deficits using Cash -> Joint -> Inherited IRA -> 401k -> Reverse Mortgage draws; any remainder is flagged as shortfall.",
    "Reverse mortgage accrues interest monthly; if loan-to-value exceeds the age-based limit, the model forces a property sale and routes net proceeds to Joint.",
    "Property taxes/insurance accrue monthly using their specific rates; healthcare ramps via medical inflation if configured.",
    "Shortfall months count when required spending cannot be met even after the waterfall and reverse mortgage access."
];

const AI_ANALYSIS_INSTRUCTIONS = [
    "Focus on solvency: inspect monthlyTimeline.shortfall counts and the annualTimeline insolvencyFlag/shortfallMonths to find stress periods.",
    "Compare trajectories: plot or summarize netWorth, liquid balances (cash + joint), and debts over time for each scenario.",
    "Check sustainability: verify incomes cover expenses before retirement and that post-retirement withdrawals align with glide path expectations.",
    "Watch housing dynamics: track reverseMortgage balances and property values to identify forced-sale events in simulation.events.",
    "Summarize sensitivities: call out which parameters (in parameterNotes and assumptions) most influence divergences between scenarios."
];

const resolveScenario = (scen, store) => {
    const resolved = cloneDeep(scen);
    const links = resolved.links || { assets: [], liabilities: [], profiles: {} };

    // Preserve scenario overrides but backfill linked registry assets/loans
    const data = resolved.data ? cloneDeep(resolved.data) : {};
    const existingAssets = data.assets?.accounts || {};
    const mergedAssets = { ...existingAssets };
    (links.assets || []).forEach(id => {
        if (!mergedAssets[id] && store.registry?.assets?.[id]) {
            mergedAssets[id] = cloneDeep(store.registry.assets[id]);
        }
    });
    data.assets = { accounts: mergedAssets };

    const existingLoans = data.loans || {};
    const mergedLoans = { ...existingLoans };
    (links.liabilities || []).forEach(id => {
        if (!mergedLoans[id] && store.registry?.liabilities?.[id]) {
            mergedLoans[id] = cloneDeep(store.registry.liabilities[id]);
        }
    });
    data.loans = mergedLoans;

    data.income = data.income || {};
    data.expenses = data.expenses || {};
    data.income.profileSequence = links.profiles?.income || data.income.profileSequence || [];
    data.expenses.profileSequence = links.profiles?.expenses || data.expenses.profileSequence || [];

    resolved.data = data;
    return resolved;
};

const scrubScenario = (scen) => {
    const clean = cloneDeep(scen);
    delete clean.__simulation_output;
    delete clean.__assumptions_documentation;
    delete clean.resolvedData;
    // Drop UI-only or transient flags if present
    if (clean.ui) delete clean.ui;
    // Strip DOM/event blobs that might have leaked into scenario data
    const stripDomNoise = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        const noisyKeys = [
            'view','nativeEvent','target','currentTarget','_reactName','_targetInst',
            'eventPhase','bubbles','cancelable','timeStamp','isTrusted','detail',
            'screenX','screenY','clientX','clientY','pageX','pageY',
            'ctrlKey','shiftKey','altKey','metaKey','button','buttons','relatedTarget',
            'movementX','movementY','which','charCode','keyCode','key','location',
            'sourceCapabilities','composed','defaultPrevented'
        ];
        noisyKeys.forEach(k => { if (Object.prototype.hasOwnProperty.call(obj, k)) delete obj[k]; });
    };
    const scrubLoan = (loan) => {
        if (!loan || typeof loan !== 'object') return;
        stripDomNoise(loan);
        if (loan.view) delete loan.view;
    };
    const scrubAsset = (asset) => {
        if (!asset || typeof asset !== 'object') return;
        stripDomNoise(asset);
        if (asset.view) delete asset.view;
    };

    if (clean.data?.loans) Object.values(clean.data.loans).forEach(scrubLoan);
    if (clean.data?.assets?.accounts) Object.values(clean.data.assets.accounts).forEach(scrubAsset);

    return clean;
};

const buildAnnualRollup = (timeline = []) => {
    const annual = {};
    timeline.forEach(item => {
        const year = item.year;
        if (!annual[year]) {
            annual[year] = {
                year,
                age: item.age,
                spouseAge: item.spouseAge,
                income: 0,
                expenses: 0,
                netCashFlow: 0,
                endingNetWorth: item.netWorth,
                endingLiquid: item.balances?.liquid || 0,
                endingProperty: item.balances?.property || 0,
                endingDebt: (item.balances?.totalDebt || 0) + (item.balances?.reverseMortgage || 0),
                insolvencyFlag: false,
                shortfallMonths: 0
            };
        }
        const target = annual[year];
        target.income += item.income || 0;
        target.expenses += item.expenses || 0;
        target.netCashFlow += item.netCashFlow || 0;
        target.endingNetWorth = item.netWorth;
        target.endingLiquid = item.balances?.liquid || 0;
        target.endingProperty = item.balances?.property || 0;
        target.endingDebt = (item.balances?.totalDebt || 0) + (item.balances?.reverseMortgage || 0);
        target.age = item.age;
        target.spouseAge = item.spouseAge;
        if ((item.shortfall || 0) > 0) {
            target.insolvencyFlag = true;
            target.shortfallMonths += 1;
        }
    });
    return Object.values(annual).sort((a, b) => a.year - b.year);
};

const buildMonthlyRollup = (timeline = []) => {
    return (timeline || []).map(item => {
        const balances = item.balances || {};
        return {
            year: item.year,
            month: item.month,
            date: item.date,
            age: item.age,
            spouseAge: item.spouseAge,
            income: item.income,
            expenses: item.expenses,
            netCashFlow: item.netCashFlow,
            netWorth: item.netWorth,
            balances: {
                cash: balances.cash || 0,
                joint: balances.joint || 0,
                inherited: balances.inherited || 0,
                retirement: balances.retirement || 0,
                property: balances.property || 0,
                reverseMortgage: balances.reverseMortgage || 0,
                totalDebt: balances.totalDebt || 0,
                liquid: balances.liquid || 0
            },
            shortfall: item.shortfall || 0
        };
    });
};

const buildParameterNotes = (scenario) => {
    const notes = {};
    Object.entries(PARAMETER_DESCRIPTIONS).forEach(([path, desc]) => {
        const val = get(scenario, `data.${path}`);
        if (val !== undefined && val !== null) {
            notes[path] = desc;
        }
    });
    return Object.keys(notes).length ? notes : PARAMETER_DESCRIPTIONS;
};

/**
 * Full application export (all state) for backups/restores.
 */
export const generateApplicationExport = (store) => {
    const baseRegistry = cloneDeep(store.registry || { assets: {}, liabilities: {}, profiles: cloneDeep(store.profiles || {}) });
    // Scrub registry to avoid DOM/event blobs
    const cleanRegistry = () => {
        const clean = cloneDeep(baseRegistry);
        const stripDomNoise = (obj) => {
            if (!obj || typeof obj !== 'object') return;
            const noisyKeys = [
                'view','nativeEvent','target','currentTarget','_reactName','_targetInst',
                'eventPhase','bubbles','cancelable','timeStamp','isTrusted','detail',
                'screenX','screenY','clientX','clientY','pageX','pageY',
                'ctrlKey','shiftKey','altKey','metaKey','button','buttons','relatedTarget',
                'movementX','movementY','which','charCode','keyCode','key','location',
                'sourceCapabilities','composed','defaultPrevented'
            ];
            noisyKeys.forEach(k => { if (Object.prototype.hasOwnProperty.call(obj, k)) delete obj[k]; });
        };
        const scrubLoan = (loan) => {
            if (!loan || typeof loan !== 'object') return;
            stripDomNoise(loan);
            if (loan.view) delete loan.view;
            delete loan.resolvedData;
        };
        const scrubAsset = (asset) => {
            if (!asset || typeof asset !== 'object') return;
            stripDomNoise(asset);
            if (asset.view) delete asset.view;
            delete asset.resolvedData;
        };
        if (clean.liabilities) Object.values(clean.liabilities).forEach(scrubLoan);
        if (clean.assets) Object.values(clean.assets).forEach(scrubAsset);
        return clean;
    };
    const registryClean = cleanRegistry();
    const exportData = {
        meta: {
            ...store.meta,
            exportDate: new Date().toISOString(),
            appVersion: "3.2.0-beta",
            exportVersion: "3.2.0-full"
        },
        registry: registryClean,
        profiles: registryClean.profiles || store.profiles || {},
        assumptions: registryClean.assumptions || store.assumptions || {},
        scenarios: {}
    };

    Object.values(store.scenarios || {}).forEach(scenario => {
        const cleaned = scrubScenario(scenario);
        const resolvedScenario = resolveScenario(cleaned, { ...store, registry: registryClean });
        exportData.scenarios[scenario.id] = resolvedScenario;
    });

    return JSON.stringify(exportData, null, 2);
};

/**
 * Compressed AI analysis export: annual rollups + docs.
 */
export const generateAIAnalysisExport = (store) => {
    const baseRegistry = store.registry || { assets: {}, liabilities: {}, profiles: cloneDeep(store.profiles || {}) };
    const profiles = baseRegistry.profiles || store.profiles || {};
    const exportData = {
        meta: {
            ...store.meta,
            exportDate: new Date().toISOString(),
            appVersion: "3.2.0-beta",
            exportVersion: "3.2.0-ai",
            mode: "ai-analysis"
        },
        registry: {
            assets: baseRegistry.assets || {},
            liabilities: baseRegistry.liabilities || {},
            profiles
        },
        assumptions: baseRegistry.assumptions || store.assumptions || {},
        documentation: {
            systemRules: SYSTEM_RULES_DESCRIPTION,
            parameterDescriptions: PARAMETER_DESCRIPTIONS,
            calculationNotes: CALCULATION_NOTES,
            analysisInstructions: AI_ANALYSIS_INSTRUCTIONS
        },
        scenarios: {}
    };

    Object.values(store.scenarios || {}).forEach(scenario => {
        const cleaned = scrubScenario(scenario);
        const resolvedScenario = resolveScenario(cleaned, { ...store, registry: baseRegistry });
        const simulation = runFinancialSimulation(resolvedScenario, profiles, baseRegistry);
        const annualTimeline = buildAnnualRollup(simulation.timeline);
        const monthlyTimeline = buildMonthlyRollup(simulation.timeline);
        const events = (simulation.events || []).map(evt => ({
            date: evt.date,
            year: evt.date ? parseInt(evt.date.substring(0, 4), 10) : resolvedScenario.data?.assumptions?.timing?.startYear,
            text: evt.text
        }));

        exportData.scenarios[scenario.id] = {
            id: scenario.id,
            name: scenario.name,
            meta: scenario.meta || {},
            links: resolvedScenario.links || {},
            data: resolvedScenario.data,
            textConfig: scenario.textConfig || { narrative: '', riskProfile: '', keyEvents: [] },
            simulation: {
                annualTimeline,
                monthlyTimeline,
                events,
                notes: "Monthly timeline is trimmed to core numeric fields (income, expenses, netCashFlow, netWorth, balances, shortfall) to avoid large blobs."
            },
            parameterNotes: buildParameterNotes(resolvedScenario)
        };
    });

    return JSON.stringify(exportData, null, 2);
};
