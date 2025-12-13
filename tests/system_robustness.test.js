import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { migrateStoreToV21 } from '../src/utils/migrate_to_v2.js';
import { scenarioSkeleton, ensureScenarioShape } from '../src/utils/scenario_shape.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const initialData = JSON.parse(readFileSync(join(__dirname, '../src/data/application_data.json'), 'utf-8'));

test('ensureScenarioShape seeds required fields', () => {
  const shaped = ensureScenarioShape({});
  assert.ok(shaped.data.assets);
  assert.ok(shaped.data.loans);
  assert.ok(shaped.data.income.profileSequence);
  assert.ok(shaped.data.expenses.profileSequence);
  assert.ok(shaped.data.assumptions.timing);
  assert.ok(shaped.links.assets);
  assert.ok(shaped.links.liabilities);
  assert.ok(shaped.textConfig);
});

test('migrateStoreToV21 repairs missing data and links', () => {
  const broken = {
    meta: { version: '2.0', activeScenarioId: 's1' },
    scenarios: {
      s1: {
        id: 's1',
        name: 'Broken',
        data: {
          assets: { accounts: { a1: { id: 'a1', type: 'cash', name: 'Cash', balance: 1000 } } },
          loans: { l1: { id: 'l1', type: 'fixed', inputs: { principal: 1000 } } },
          income: {},
          expenses: {}
        }
      }
    },
    registry: {}
  };
  const migrated = migrateStoreToV21(broken);
  const scen = migrated.scenarios.s1;
  assert.ok(scen.data.assets.accounts.a1);
  assert.ok(scen.data.loans.l1);
  assert.ok(Array.isArray(scen.links.assets));
  assert.ok(Array.isArray(scen.links.liabilities));
  assert.ok(scen.links.assets.includes('a1'));
  assert.ok(scen.links.liabilities.includes('l1'));
  assert.ok(scen.data.assumptions.timing.startYear);
});

test('initial data scenarios conform to shape after migration', () => {
  const migrated = migrateStoreToV21(initialData);
  Object.values(migrated.scenarios).forEach(scen => {
    const shaped = ensureScenarioShape(scen);
    assert.ok(shaped.data.assets);
    assert.ok(shaped.data.loans);
    assert.ok(shaped.links.assets);
    assert.ok(shaped.links.liabilities);
  });
});

test('scenarioSkeleton seeds defaults', () => {
  const s1 = scenarioSkeleton();
  assert.ok(s1.id.startsWith('scen_'));
  assert.equal(s1.data.assumptions.timing.startYear, 2026);
});
