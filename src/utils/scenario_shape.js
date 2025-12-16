import pkg from 'lodash';

const { cloneDeep } = pkg;

export const scenarioSkeleton = () => ({
  id: `scen_${Date.now()}`,
  name: 'New Scenario',
  description: '',
  data: {
    assets: { accounts: {} },
    loans: {},
    income: { profileSequence: [], primary: defaultPersonIncome(), spouse: defaultPersonIncome(), workStatus: {} },
    expenses: { profileSequence: [] },
    assumptions: { timing: { startYear: 2026, startMonth: 1 } }
  },
  links: { assets: [], liabilities: [], profiles: { income: [], expenses: [] } },
  overrides: { assets: {}, liabilities: {} },
  textConfig: { narrative: '', riskProfile: '', keyEvents: [] }
});

function defaultPersonIncome() {
  return {
    netSalary: 0,
    bonus: { amount: 0, month: 1 },
    grossForContrib: 0,
    contribPercent: 0,
    // Employer match config; default enables match for primary only (spouse set in ensureScenarioShape)
    matching: { enabled: true, capPct: 0.06, matchRate: 0.5 },
    retirementAccountId: null,
    socialSecurity: { startAge: 0, monthlyAmount: 0 },
    pension: { monthlyAmount: 0 },
    birthYear: 1968,
    birthMonth: 1
  };
}

export const ensureScenarioShape = (scen = {}) => {
  const base = scenarioSkeleton();
  const merged = { ...base, ...cloneDeep(scen) };
  if (!merged.data) merged.data = cloneDeep(base.data);
  merged.data.assets = merged.data.assets || { accounts: {} };
  Object.values(merged.data.assets.accounts || {}).forEach(a => {
    if (a.type === 'property') {
      if (!a.inputs) a.inputs = {};
      if (!a.inputs.startDate) a.inputs.startDate = `${merged.data.assumptions?.timing?.startYear || 2026}-${String(merged.data.assumptions?.timing?.startMonth || 1).padStart(2, '0')}-01`;
      if (!a.inputs.linkedLoanIds) a.inputs.linkedLoanIds = a.inputs.linkedLoanId ? [a.inputs.linkedLoanId] : [];
      if (!a.inputs.carryingCosts) a.inputs.carryingCosts = { impounds: [], other: [] };
      if (!a.inputs.carryingCosts.impounds) a.inputs.carryingCosts.impounds = [];
      if (!a.inputs.carryingCosts.other) a.inputs.carryingCosts.other = [];
    }
  });
  merged.data.loans = merged.data.loans || {};
  merged.data.income = merged.data.income || { profileSequence: [] };
  merged.data.income.profileSequence = merged.data.income.profileSequence || [];
  merged.data.income.primary = { ...defaultPersonIncome(), ...(merged.data.income.primary || {}) };
  merged.data.income.spouse = { ...defaultPersonIncome(), ...(merged.data.income.spouse || {}), matching: { enabled: false, ...(merged.data.income.spouse?.matching || {}) } };
  merged.data.income.workStatus = merged.data.income.workStatus || {};
  merged.data.expenses = merged.data.expenses || { profileSequence: [] };
  merged.data.assumptions = merged.data.assumptions || { timing: { startYear: 2026, startMonth: 1 } };
  merged.data.assumptions.timing = merged.data.assumptions.timing || { startYear: 2026, startMonth: 1 };
  if (!merged.data.assumptions.horizonYears) merged.data.assumptions.horizonYears = merged.data.assumptions.horizon || 35;

  merged.links = merged.links || { assets: [], liabilities: [], profiles: { income: [], expenses: [] } };
  merged.links.assets = merged.links.assets || [];
  merged.links.liabilities = merged.links.liabilities || [];
  merged.links.profiles = merged.links.profiles || { income: [], expenses: [] };
  merged.links.profiles.income = merged.links.profiles.income || [];
  merged.links.profiles.expenses = merged.links.profiles.expenses || [];

  merged.overrides = merged.overrides || { assets: {}, liabilities: {} };
  merged.overrides.assets = merged.overrides.assets || {};
  merged.overrides.liabilities = merged.overrides.liabilities || {};

  merged.textConfig = merged.textConfig || { narrative: '', riskProfile: '', keyEvents: [] };
  return merged;
};
