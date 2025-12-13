import assert from 'node:assert/strict';
import { migrateStoreToV2 } from '../src/utils/migrate_to_v2.js';

const legacyStore = {
  meta: { version: '1.3', activeScenarioId: 'scen_1' },
  scenarios: {
    scen_1: {
      id: 'scen_1',
      name: 'Legacy Scenario',
      data: {
        assumptions: { timing: { startYear: 2026, startMonth: 1 } },
        assets: { accounts: { acct_a: { id: 'acct_a', type: 'cash', name: 'Cash', balance: 1000 } } },
        loans: { loan_a: { id: 'loan_a', name: 'Car Loan', type: 'fixed', inputs: { principal: 10000 } } },
        income: { profileSequence: [] },
        expenses: { profileSequence: [] }
      }
    }
  },
  profiles: {
    prof_inc: { id: 'prof_inc', type: 'income', data: {} }
  }
};

assert.doesNotThrow(() => migrateStoreToV2(legacyStore));

const migrated = migrateStoreToV2(legacyStore);

assert.equal(migrated.meta.version, '2.0');
assert.ok(migrated.registry.assets.acct_a, 'assets lifted to registry');
assert.ok(migrated.registry.liabilities.loan_a, 'loans lifted to registry');
assert.ok(migrated.registry.profiles.prof_inc, 'profiles copied to registry');
assert.deepEqual(migrated.scenarios.scen_1.links.assets, ['acct_a']);
assert.deepEqual(migrated.scenarios.scen_1.links.liabilities, ['loan_a']);
assert.ok(migrated.scenarios.scen_1.overrides, 'overrides scaffold exists');

console.log('migrate_to_v2 test passed');
