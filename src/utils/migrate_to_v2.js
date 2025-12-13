import pkg from 'lodash';
import { ensureScenarioShape } from './scenario_shape.js';

const { cloneDeep } = pkg;

/**
 * Lightweight migration that lifts embedded scenario assets/loans/profiles
 * into a shared registry while keeping the legacy scenario shape intact for UI/engine compatibility.
 * This is an incremental step toward the v2.0 registry-first architecture.
 */
export const migrateStoreToV2 = (input) => {
  if (!input || typeof input !== 'object') return input;
  const store = cloneDeep(input);

  // Idempotent: if already on 2.0 with a registry, return as-is
  if (store.meta?.version && store.meta.version.startsWith('2') && store.registry) return store;

  // Pick a source scenario (active or first) to seed the registry
  const scenarioKeys = Object.keys(store.scenarios || {});
  const activeId = store.meta?.activeScenarioId || scenarioKeys[0];
  const sourceScenario = store.scenarios?.[activeId] || store.scenarios?.[scenarioKeys[0]] || {};
  const sourceData = sourceScenario.data || {};

  // Build registry assets/liabilities from the source scenario
  const registry = {
    assets: cloneDeep(sourceData.assets?.accounts || {}),
    liabilities: cloneDeep(sourceData.loans || {}),
    profiles: cloneDeep(store.profiles || {})
  };

  // Add lightweight links/overrides to each scenario without removing legacy data
  scenarioKeys.forEach(id => {
    const scen = store.scenarios[id];
    if (!scen.links) {
      const accounts = Object.values(scen.data?.assets?.accounts || {});
      const loans = Object.values(scen.data?.loans || {});
      const incomeSeq = scen.data?.income?.profileSequence || [];
      const expenseSeq = scen.data?.expenses?.profileSequence || [];
      scen.links = {
        assets: accounts.map(a => a.id),
        liabilities: loans.map(l => l.id),
        profiles: { income: incomeSeq, expenses: expenseSeq }
      };
    }
    if (!scen.overrides) scen.overrides = {};
  });

  store.registry = registry;
  store.meta = { ...(store.meta || {}), version: '2.0' };

  // Keep top-level profiles for compatibility; they mirror registry.profiles for now
  if (!store.profiles || Object.keys(store.profiles).length === 0) {
    store.profiles = cloneDeep(registry.profiles);
  }

  return store;
};

/**
 * Migration to the 2.1 schema:
 * - Adds healthcare inflation default
 * - Adds property-linked liability fields
 * - Adds inherited IRA 10-year schedule scaffold
 * - Adds scenario sellDate overrides/textConfig scaffold
 * - Normalizes links/overrides and startMonth
 */
export const migrateStoreToV21 = (input) => {
  const base = migrateStoreToV2(input);
  if (!base || typeof base !== 'object') return input;
  const store = cloneDeep(base);
  const dataReview = [];

  if (store.meta?.version === '2.1') return store;

  const ensureAssumptionsDefaults = (assumptions = {}) => {
    const next = { ...assumptions };
    if (next.healthcareInflationRateAnnual === undefined) {
      next.healthcareInflationRateAnnual = 0.05;
      dataReview.push('Added default healthcareInflationRateAnnual=5%.');
    }
    if (!next.timing) next.timing = { startYear: 2026, startMonth: 1 };
    return next;
  };

  // Registry defaults
  Object.values(store.registry?.assets || {}).forEach(asset => {
      if (!asset.inputs) asset.inputs = {};
      if (asset.type === 'property') {
        if (!asset.inputs.buildYear) asset.inputs.buildYear = 2000;
        if (!asset.inputs.zipCode) asset.inputs.zipCode = '';
      }
      if (asset.type === 'inherited') {
        const sched = asset.inputs.withdrawalSchedule || {};
        const hasAny = Object.keys(sched).length > 0;
        if (!hasAny) {
          // Default even 10% for years 1-9, 10% final year (will be reshaped by UI later)
          const start = asset.inputs.startDate ? new Date(asset.inputs.startDate).getFullYear() : new Date().getFullYear();
          for (let i = 0; i < 10; i += 1) {
            sched[start + i] = i === 9 ? 1 : 0.1;
          }
          dataReview.push(`Inherited IRA ${asset.name || asset.id}: added default 10-year withdrawal schedule.`);
        }
        asset.inputs.withdrawalSchedule = sched;
      }
    });

  Object.values(store.registry?.liabilities || {}).forEach(l => {
    if (l.propertyLinked === undefined) {
      l.propertyLinked = false;
      dataReview.push(`Liability ${l.name || l.id}: added propertyLinked=false.`);
    }
    if (l.linkedPropertyId === undefined) l.linkedPropertyId = null;
  });

  // Scenario-level scaffolding
  Object.keys(store.scenarios || {}).forEach(key => {
    const scen = ensureScenarioShape(store.scenarios[key]);

    // Normalize assumptions and derive startMonth
    const assumptions = scen.data.assumptions || scen.data.globals || {};
    scen.data.assumptions = ensureAssumptionsDefaults(assumptions);
    const { startYear = 2026, startMonth = 1 } = scen.data.assumptions.timing || {};
    if (!scen.startMonth) scen.startMonth = `${startYear}-${String(startMonth).padStart(2, '0')}`;

    if (!scen.textConfig) {
      scen.textConfig = { narrative: '', riskProfile: '', keyEvents: [] };
      dataReview.push(`Scenario ${scen.name || scen.id}: added textConfig scaffold.`);
    }

    // Backfill links if empty by inspecting data
    if (scen.links.assets.length === 0) {
      const dataAssetIds = Object.keys(scen.data.assets.accounts || {});
      scen.links.assets = Array.from(new Set(dataAssetIds));
    }
    if (scen.links.liabilities.length === 0) {
      const dataLoanIds = Object.keys(scen.data.loans || {});
      scen.links.liabilities = Array.from(new Set(dataLoanIds));
    }
    store.scenarios[key] = scen;
  });

  // Mirror profiles for compatibility
  if (!store.profiles || Object.keys(store.profiles).length === 0) {
    store.profiles = cloneDeep(store.registry?.profiles || {});
  }

  store.meta = { ...(store.meta || {}), version: '2.1', exportVersion: '2.1' };
  if (dataReview.length > 0) store.meta.dataReview = dataReview;
  return store;
};

/**
 * Migration to v2.2.1
 * - Adds property carryingCosts scaffolding (impounds + other home costs) to property assets
 * - Bumps version markers to 2.2.1
 */
export const migrateStoreToV221 = (input) => {
  const base = migrateStoreToV21(input);
  if (!base || typeof base !== 'object') return input;
  const store = cloneDeep(base);

  if (store.meta?.version === '2.2.1') return store;

  const ensureCarryingCosts = (asset) => {
      if (!asset || asset.type !== 'property') return;
      if (!asset.inputs) asset.inputs = {};
      if (!asset.inputs.carryingCosts) asset.inputs.carryingCosts = { impounds: [], other: [] };
      if (!asset.inputs.carryingCosts.impounds) asset.inputs.carryingCosts.impounds = [];
      if (!asset.inputs.carryingCosts.other) asset.inputs.carryingCosts.other = [];
  };

  Object.values(store.registry?.assets || {}).forEach(ensureCarryingCosts);
  Object.values(store.scenarios || {}).forEach(scen => {
      Object.values(scen.data?.assets?.accounts || {}).forEach(ensureCarryingCosts);
  });

  store.meta = { ...(store.meta || {}), version: '2.2.1', exportVersion: '2.2.1' };
  return store;
};
