import assert from 'node:assert/strict';
import { generateAIExport } from '../src/utils/ai_export_utils.js';

const store = {
  meta: { version: '2.0', activeScenarioId: 'scen_1' },
  registry: {
    assets: { acct_cash: { id: 'acct_cash', type: 'cash', name: 'Cash', balance: 1000, active: true } },
    liabilities: {},
    profiles: {
      prof_income: { id: 'prof_income', type: 'income', name: 'Income', data: { primary: { birthYear: 1968, birthMonth: 1 }, spouse: { birthYear: 1968, birthMonth: 1 } } },
      prof_expense: { id: 'prof_expense', type: 'expenses', name: 'Expense', data: {} }
    }
  },
  scenarios: {
    scen_1: {
      id: 'scen_1',
      name: 'Test',
      data: {
        assumptions: { timing: { startYear: 2026, startMonth: 1 }, inflation: {}, market: {}, rates: {}, thresholds: { cashMin: 0, retirementMin: 0 }, horizonYears: 1 },
        income: { primary: { birthYear: 1968, birthMonth: 1 }, spouse: { birthYear: 1968, birthMonth: 1 }, profileSequence: [] },
        expenses: { profileSequence: [] }
      },
      links: {
        assets: ['acct_cash'],
        liabilities: [],
        profiles: { income: [{ profileId: 'prof_income', startDate: '2026-01-01', isActive: true }], expenses: [{ profileId: 'prof_expense', startDate: '2026-01-01', isActive: true }] }
      }
    }
  }
};

const exported = JSON.parse(generateAIExport(store));
const scen = exported.scenarios.scen_1;

assert.ok(exported.registry.assets.acct_cash, 'registry included in export');
assert.ok(scen.resolvedData.assets.accounts.acct_cash, 'resolved data includes linked asset');
assert.ok(Array.isArray(scen.__simulation_output.timeline), 'simulation output exists');

console.log('ai_export_utils test passed');
