import assert from 'node:assert/strict';
import { runFinancialSimulation } from '../src/utils/financial_engine.js';

const loanBase = {
  id: 'loan_1',
  name: 'Test Loan',
  type: 'fixed',
  active: true,
  inputs: { principal: 12000, rate: 0.06, payment: 400, startDate: '2026-01-01', termMonths: 36 },
  activeStrategyId: 'base',
  strategies: {
    base: { name: 'Base', extraPayments: {} },
    extra: { name: 'Extra', extraPayments: { '2026-01': 200 } }
  }
};

const scenarioWithStrategy = (strategyId) => ({
  id: 'scen_strategy',
  data: {
    assumptions: { timing: { startYear: 2026, startMonth: 1 }, horizonYears: 1, inflation: {}, market: {}, rates: {}, thresholds: { cashMin: 0, retirementMin: 0 } },
    income: {
      primary: { netSalary: 0, grossForContrib: 0, contribPercent: 0, birthYear: 1968, birthMonth: 1, socialSecurity: { startAge: 120, monthlyAmount: 0 } },
      spouse: { netSalary: 0, grossForContrib: 0, contribPercent: 0, birthYear: 1968, birthMonth: 1, socialSecurity: { startAge: 120, monthlyAmount: 0 } },
      workStatus: { '2026': { primary: 0, spouse: 0 } },
      profileSequence: []
    },
    expenses: { bills: [], home: [], living: [], impounds: [], profileSequence: [] },
    assets: { accounts: { cash: { id: 'cash', type: 'cash', name: 'Cash', balance: 0, active: true } } },
    loans: { loan_1: { ...loanBase, activeStrategyId: strategyId } }
  }
});

const simBase = runFinancialSimulation(scenarioWithStrategy('base'), {});
const simExtra = runFinancialSimulation(scenarioWithStrategy('extra'), {});

const payoffBase = simBase.timeline.find(t => t.events && t.events.some ? t.events.some(ev => ev.text.includes('Paid Off')) : false);
const payoffExtra = simExtra.timeline.find(t => t.events && t.events.some ? t.events.some(ev => ev.text.includes('Paid Off')) : false);

// Compare balances: extra payments should lower balance faster
const janBalanceBase = simBase.timeline.find(t => t.date === '2026-01-01')?.balances.totalDebt || 0;
const janBalanceExtra = simExtra.timeline.find(t => t.date === '2026-01-01')?.balances.totalDebt || 0;

assert.ok(janBalanceExtra <= janBalanceBase, 'extra strategy applies extra payments to reduce balance');

console.log('loan_strategy_selection test passed');
