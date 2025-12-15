import assert from 'node:assert/strict';
import { generateAIAnalysisExport, generateApplicationExport } from '../src/utils/ai_export_utils.js';

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

const fullExport = JSON.parse(generateApplicationExport(store));
const scenFull = fullExport.scenarios.scen_1;

assert.equal(fullExport.meta.exportVersion, '3.02-full');
assert.ok(fullExport.registry.assets.acct_cash, 'registry included in full export');
assert.ok(scenFull.data.assets.accounts.acct_cash, 'full export resolves linked asset into data');
assert.ok(!scenFull.__simulation_output, 'full export strips computed simulation blobs');

const aiExport = JSON.parse(generateAIAnalysisExport(store));
const scenAi = aiExport.scenarios.scen_1;

assert.equal(aiExport.meta.mode, 'ai-analysis');
assert.ok(Array.isArray(scenAi.simulation.annualTimeline), 'AI export includes annual timeline');
assert.ok(scenAi.simulation.annualTimeline.length > 0, 'annual timeline has entries');
assert.ok(!('month' in scenAi.simulation.annualTimeline[0]), 'annual timeline is compressed without monthly data');
assert.ok(aiExport.documentation.parameterDescriptions['assumptions.inflation.general'], 'parameter descriptions retained');

console.log('ai_export_utils tests passed');
