import assert from 'node:assert/strict';
import { runFinancialSimulation } from '../src/utils/financial_engine.js';

// Scenario to trigger forced sale: high reverse mortgage draw vs property value
const scenario = {
  id: 'scen_forced',
  data: {
    assumptions: {
      timing: { startYear: 2026, startMonth: 1 },
      horizonYears: 1,
      inflation: { general: 0 },
      market: { initial: 0, terminal: 0, taperEndAge: 85 },
      rates: { reverseMortgage: 0.1 },
      thresholds: { cashMin: 0, retirementMin: 0 }
    },
    income: {
      primary: { netSalary: 0, grossForContrib: 0, contribPercent: 0, birthYear: 1968, birthMonth: 1, socialSecurity: { startAge: 120, monthlyAmount: 0 } },
      spouse: { netSalary: 0, grossForContrib: 0, contribPercent: 0, birthYear: 1968, birthMonth: 1, socialSecurity: { startAge: 120, monthlyAmount: 0 } },
      workStatus: { '2026': { primary: 0, spouse: 0 } },
      profileSequence: []
    },
    expenses: {
      bills: [{ id: 'b1', name: 'Big Spend', amount: 10000 }],
      home: [],
      living: [],
      impounds: [],
      profileSequence: []
    },
    assets: {
      accounts: {
        prop: { id: 'prop', type: 'property', name: 'House', balance: 200000, active: true, inputs: { linkedLoanIds: [], sellDate: '2027-01-01' } }
      }
    },
    loans: {}
  }
};

const sim = runFinancialSimulation(scenario, {});
const forcedSaleEvent = sim.events.find(e => e.text.includes('Forced Sale'));

assert.ok(forcedSaleEvent, 'forced sale triggered');
const finalYear = sim.timeline.at(-1);
assert.ok(finalYear.balances.reverseMortgage === 0, 'reverse mortgage cleared after forced sale');
assert.ok(finalYear.balances.joint >= 0, 'proceeds routed to joint per spec');

console.log('property_forced_sale test passed');
