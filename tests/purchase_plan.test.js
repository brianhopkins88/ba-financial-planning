import assert from 'node:assert/strict';
import { runFinancialSimulation } from '../src/utils/financial_engine.js';

const scenario = {
  id: 'scen_purchase',
  data: {
    assumptions: {
      timing: { startYear: 2026, startMonth: 1 },
      horizonYears: 1,
      inflation: { general: 0 },
      market: { initial: 0, terminal: 0, taperEndAge: 85 },
      rates: { reverseMortgage: 0.06 },
      thresholds: { cashMin: 0, retirementMin: 0 }
    },
    income: {
      primary: { netSalary: 0, grossForContrib: 0, contribPercent: 0, birthYear: 1968, birthMonth: 1, socialSecurity: { startAge: 120, monthlyAmount: 0 } },
      spouse: { netSalary: 0, grossForContrib: 0, contribPercent: 0, birthYear: 1968, birthMonth: 1, socialSecurity: { startAge: 120, monthlyAmount: 0 } },
      workStatus: { '2026': { primary: 0, spouse: 0 } },
      profileSequence: []
    },
    expenses: { bills: [], home: [], living: [], impounds: [], profileSequence: [] },
    assets: {
      accounts: {
        cash: { id: 'cash', type: 'cash', name: 'Cash', balance: 10000, active: true },
        prop_future: {
          id: 'prop_future',
          type: 'property',
          name: 'Future Home',
          balance: 10000,
          active: true,
          inputs: {
            startDate: '2026-03-01',
            purchaseType: 'construction',
            purchasePlan: {
              contractDate: '2026-01-15',
              costs: { base: 10000, structural: 0, design: 0, lot: 0, credits: 0 },
              deposits: { contract: 1000, designPct: 0 },
              closing: { fees: [], prepaids: [], buyDown: 0, lenderCredits: 0 },
              funding: [{ sourceId: 'cash', amount: 2000 }],
              depositFunding: [{ sourceId: 'cash', amount: 1000 }],
              autoLoan: false,
              loan: { amount: 5000, rate: 0.05, term: 60 }
            }
          }
        }
      }
    },
    loans: {}
  }
};

const sim = runFinancialSimulation(scenario, {});
const contractEvent = sim.events.find(e => e.text.includes('Contract Signed'));
const loanEvent = sim.events.find(e => e.text.includes('Auto Loan Created'));

assert.ok(contractEvent, 'contract deposit executed');
assert.ok(loanEvent, 'auto loan created at closing');

// Check debt after closing month (March)
const march = sim.timeline.find(t => t.month === 3);
assert.ok(march.balances.totalDebt > 4000, 'loan balance reflected in debt');

// Cash should be reduced by deposits and closing funding
assert.ok(march.balances.cash <= 5200, `cash reduced by funding events (cash=${march.balances.cash})`);

console.log('purchase_plan test passed');
