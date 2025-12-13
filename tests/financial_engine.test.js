import assert from 'node:assert/strict';
import { runFinancialSimulation } from '../src/utils/financial_engine.js';

const baseScenario = {
  id: 'scen_test',
  data: {
    assumptions: {
      timing: { startYear: 2026, startMonth: 1 },
      horizonYears: 1,
      inflation: { general: 0 },
      market: { initial: 0, terminal: 0, taperEndAge: 85 },
      rates: { reverseMortgage: 0.06 },
      thresholds: { cashMin: 0, cashMax: 0, retirementMin: 0 }
    },
    income: {
      primary: { netSalary: 0, grossForContrib: 0, contribPercent: 0, birthYear: 1968, birthMonth: 1, socialSecurity: { startAge: 120, monthlyAmount: 0 } },
      spouse: { netSalary: 0, grossForContrib: 0, contribPercent: 0, birthYear: 1968, birthMonth: 1, socialSecurity: { startAge: 120, monthlyAmount: 0 } },
      workStatus: { '2026': { primary: 0, spouse: 0 } },
      profileSequence: []
    },
    expenses: {
      bills: [],
      home: [],
      living: [],
      impounds: [],
      profileSequence: []
    },
    assets: { accounts: { cash_1: { id: 'cash_1', type: 'cash', name: 'Cash', balance: 0, active: true } } },
    loans: {}
  }
};

const sim = runFinancialSimulation(baseScenario, {});
assert.equal(sim.timeline.length, 12, 'horizonYears respected (12 months)');
assert.equal(sim.timeline.at(-1).year, 2026, 'final year matches horizon');

console.log('financial_engine horizon test passed');
