import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import initialData from '../data/application_data.json';
import { cloneDeep, set, get } from 'lodash';
import { format, parseISO, isValid, addMonths, isAfter, isBefore } from 'date-fns';
import { migrateStoreToV221 } from '../utils/migrate_to_v2';
import { scenarioSkeleton, ensureScenarioShape } from '../utils/scenario_shape';

// Provide a safe default context so consumers don't blow up if the provider fails to mount
const noop = () => {};
const defaultContextValue = {
  store: { scenarios: {}, meta: {} },
  activeScenario: ensureScenarioShape(),
  simulationDate: new Date(2026, 0, 1),
  isLoaded: false,
  actions: {
    switchScenario: noop,
    createScenario: noop,
    createBlankScenario: noop,
    renameScenario: noop,
    deleteScenario: noop,
    updateScenarioMeta: noop,
    updateScenarioData: noop,
    updateScenarioDate: noop,
    setSimulationMonth: noop,
    saveAll: noop,
    resetAll: noop,
    addAsset: noop,
    deleteAsset: noop,
    addLoan: noop,
    deleteLoan: noop,
    batchUpdateLoanPayments: noop,
    addLoanStrategy: noop,
    renameLoanStrategy: noop,
    duplicateLoanStrategy: noop,
    deleteLoanStrategy: noop,
    importData: noop,
    saveProfile: noop,
    updateProfile: noop,
    updateProfileMeta: noop,
    renameProfile: noop,
    deleteProfile: noop,
    toggleProfileInScenario: noop,
    linkAssetToScenario: noop,
    unlinkAssetFromScenario: noop,
    linkLiabilityToScenario: noop,
    unlinkLiabilityFromScenario: noop
  }
};

const DataContext = createContext(defaultContextValue);

// Storage key versioned for the v2.2.1 schema
const STORAGE_KEY = 'ba_financial_planner_v2.2.1_registry';
const PREVIOUS_STORAGE_KEY = 'ba_financial_planner_v2.1_registry';
const LEGACY_STORAGE_KEY = 'ba_financial_planner_v2.0_registry';
const OLDEST_STORAGE_KEY = 'ba_financial_planner_v1.4_primary_spouse';

const filterValidProfiles = (seq = [], catalog = {}) => {
  return (seq || []).filter(item => item?.profileId && catalog[item.profileId]);
};

const rebuildScenarioFromRegistry = (scenario, registry, profileCatalog) => {
  const scen = ensureScenarioShape(scenario);
  const rebuiltAssets = {};
  const rebuiltLoans = {};
  (scen.links.assets || []).forEach(id => {
    if (registry?.assets?.[id]) rebuiltAssets[id] = cloneDeep(registry.assets[id]);
  });
  (scen.links.liabilities || []).forEach(id => {
    if (registry?.liabilities?.[id]) rebuiltLoans[id] = cloneDeep(registry.liabilities[id]);
  });
  scen.data.assets = { accounts: rebuiltAssets };
  scen.data.loans = rebuiltLoans;

  const catalog = profileCatalog || registry?.profiles || {};
  scen.links.profiles = scen.links.profiles || { income: [], expenses: [] };
  const cleanIncome = filterValidProfiles(scen.links.profiles.income, catalog);
  const cleanExpenses = filterValidProfiles(scen.links.profiles.expenses, catalog);
  scen.links.profiles.income = cleanIncome;
  scen.links.profiles.expenses = cleanExpenses;
  if (!scen.data.income) scen.data.income = {};
  if (!scen.data.expenses) scen.data.expenses = {};
  scen.data.income.profileSequence = cleanIncome;
  scen.data.expenses.profileSequence = cleanExpenses;

  return scen;
};

const rebuildStoreScenarios = (store) => {
  const next = cloneDeep(store);
  const profileCatalog = store.registry?.profiles || store.profiles || {};
  Object.keys(next.scenarios || {}).forEach(k => {
    next.scenarios[k] = rebuildScenarioFromRegistry(next.scenarios[k], next.registry, profileCatalog);
  });
  return next;
};

export const DataProvider = ({ children }) => {

  // --- 1. LOADER ---
  const [store, setStore] = useState(() => {
    let data = cloneDeep(initialData);
    try {
      // Prefer v2.2.1 storage; fall back to older schemas
      const localV221 = localStorage.getItem(STORAGE_KEY);
      const localV21 = localStorage.getItem(PREVIOUS_STORAGE_KEY);
      const localV20 = localStorage.getItem(LEGACY_STORAGE_KEY);
      const localLegacy = localStorage.getItem(OLDEST_STORAGE_KEY);
      const raw = localV221 || localV21 || localV20 || localLegacy;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.scenarios) data = parsed;
      }
    } catch (e) {
      console.error("Local storage error, reverting to default JSON", e);
    }

    // Ensure we are on the v2.2.1 shape with registry scaffolding
    try {
        data = migrateStoreToV221(data);
    } catch (e) {
        console.warn("Migration to v2.2.1 failed, continuing with base data", e);
    }

    // Repair skeletons on load
    try {
        Object.keys(data.scenarios || {}).forEach(k => {
            data.scenarios[k] = ensureScenarioShape(data.scenarios[k]);
        });
    } catch (e) {
        console.warn("Scenario skeleton repair failed", e);
    }

    try {
        data = rebuildStoreScenarios(data);
    } catch (e) {
        console.warn("Scenario rebuild failed", e);
    }

    return data;
  });

  const [isLoaded, setIsLoaded] = useState(false);
  const [persistenceDisabled, setPersistenceDisabled] = useState(false);

  // --- 2. PERSISTENCE ---
  useEffect(() => {
    if (!isLoaded || persistenceDisabled) return;
    const replacer = () => {
      const seen = new WeakSet();
      return (key, value) => {
        // Drop heavy/baked simulation output to avoid blowing localStorage quota
        if (key === '__simulation_output' || key === '__assumptions_documentation') return undefined;
        if (typeof value === 'object' && value !== null) {
          // Skip DOM nodes / React fibers
          if (typeof Node !== 'undefined' && value instanceof Node) return undefined;
          if (typeof Element !== 'undefined' && value instanceof Element) return undefined;
          if (seen.has(value)) return undefined;
          seen.add(value);
        }
        return value;
      };
    };
    try {
      const normalized = rebuildStoreScenarios(store);
      // Remove baked simulation blobs and docs at the scenario level too, just in case
      Object.values(normalized.scenarios || {}).forEach(s => {
        if (s.__simulation_output) delete s.__simulation_output;
        if (s.__assumptions_documentation) delete s.__assumptions_documentation;
      });
      const serialized = JSON.stringify(normalized, replacer());
      if (serialized) localStorage.setItem(STORAGE_KEY, serialized);
    } catch (e) {
      console.warn("Persistence failed, skipping write to avoid crash", e);
      if (e?.name === 'QuotaExceededError') setPersistenceDisabled(true);
    }
  }, [store, isLoaded, persistenceDisabled]);

  useEffect(() => {
      setIsLoaded(true);
      console.log("BA Financial Data Ready (v2.2.1 schema)");
  }, []);

  // --- 3. ACCESSORS ---
  const fallbackScenario = Object.values(store.scenarios || {})[0];
  const activeId = store.meta.activeScenarioId || fallbackScenario?.id;
  const activeScenarioRaw = store.scenarios[activeId] || fallbackScenario;

  const getActiveScenarioId = (state) => state.meta?.activeScenarioId || Object.keys(state.scenarios || {})[0];

  // Resolve linked registry items into the active scenario view (non-mutating)
  const activeScenario = useMemo(() => {
      const scen = ensureScenarioShape(activeScenarioRaw);
      const links = scen.links || { assets: [], liabilities: [], profiles: {} };
      const profileCatalog = store.registry?.profiles || store.profiles || {};
      // Start with any scenario data already present to preserve overrides
      const existingAssets = scen.data?.assets?.accounts || {};
      const assets = { ...existingAssets };
      (links.assets || []).forEach(id => {
          if (!assets[id] && store.registry?.assets?.[id]) assets[id] = cloneDeep(store.registry.assets[id]);
      });
      const existingLoans = scen.data?.loans || {};
      const loans = { ...existingLoans };
      (links.liabilities || []).forEach(id => {
          if (!loans[id] && store.registry?.liabilities?.[id]) loans[id] = cloneDeep(store.registry.liabilities[id]);
      });

      // Merge overrides if present
      const applyOverrides = (obj, overrides = {}) => {
          Object.entries(overrides).forEach(([id, ov]) => {
              if (obj[id]) Object.assign(obj[id], cloneDeep(ov));
          });
          return obj;
      };

      applyOverrides(assets, scen.overrides?.assets);
      applyOverrides(loans, scen.overrides?.liabilities);

      scen.data = scen.data || {};
      scen.data.assets = { accounts: assets };
      scen.data.loans = loans;

      // Profile sequences stay in scen.links
      if (!scen.data.income) scen.data.income = {};
      if (!scen.data.expenses) scen.data.expenses = {};
      const cleanIncome = filterValidProfiles(links.profiles?.income || scen.data.income.profileSequence, profileCatalog);
      const cleanExpenses = filterValidProfiles(links.profiles?.expenses || scen.data.expenses.profileSequence, profileCatalog);
      if (!scen.links.profiles) scen.links.profiles = { income: [], expenses: [] };
      scen.links.profiles.income = cleanIncome;
      scen.links.profiles.expenses = cleanExpenses;
      scen.data.income.profileSequence = cleanIncome;
      scen.data.expenses.profileSequence = cleanExpenses;

      return scen;
  }, [activeScenarioRaw, store.registry, store.profiles]);

  const [simulationDate, setSimulationDate] = useState(() => {
      const savedDateStr = activeScenario?.data?.assumptions?.currentModelDate || activeScenario?.data?.globals?.currentModelDate;
      return (savedDateStr && isValid(parseISO(savedDateStr))) ? parseISO(savedDateStr) : new Date(2026, 0, 1);
  });

  const timing = activeScenario?.data?.assumptions?.timing || { startYear: 2026, startMonth: 1 };
  const horizonYears = activeScenario?.data?.assumptions?.horizonYears || activeScenario?.data?.assumptions?.horizon || 35;

  const scenarioWindow = useMemo(() => {
      const startDate = new Date(timing.startYear || 2026, (timing.startMonth || 1) - 1, 1);
      const totalMonths = Math.max(1, horizonYears) * 12;
      const endDate = addMonths(startDate, totalMonths - 1);
      return { startDate, endDate, totalMonths };
  }, [timing.startYear, timing.startMonth, horizonYears]);

  const clampToWindow = useCallback((date) => {
      if (!date || !isValid(date)) return scenarioWindow.startDate;
      if (isBefore(date, scenarioWindow.startDate)) return scenarioWindow.startDate;
      if (isAfter(date, scenarioWindow.endDate)) return scenarioWindow.endDate;
      return date;
  }, [scenarioWindow]);

  useEffect(() => {
      setSimulationDate(prev => clampToWindow(prev));
  }, [clampToWindow]);

  // Safety: if active scenario id is missing (e.g., deleted), repair pointer to first available
  useEffect(() => {
      if (!store.meta.activeScenarioId && fallbackScenario?.id) {
          setStore(prev => ({ ...prev, meta: { ...(prev.meta || {}), activeScenarioId: fallbackScenario.id } }));
      }
  }, [store.meta.activeScenarioId, fallbackScenario, setStore]);

  useEffect(() => {
      if (!isLoaded || !activeId || !activeScenario) return;
      const dateStr = format(simulationDate, 'yyyy-MM-dd');
      const currentStoredDate = activeScenario.data.assumptions?.currentModelDate;
      if (currentStoredDate !== dateStr) {
           setStore(prev => {
              const newData = cloneDeep(prev);
              if (!newData.scenarios[activeId].data.assumptions) newData.scenarios[activeId].data.assumptions = {};
              newData.scenarios[activeId].data.assumptions.currentModelDate = dateStr;
              return newData;
           });
      }
  }, [simulationDate, activeId, isLoaded, activeScenario]);

  // --- HELPER: ENSURE SEQUENCE VALIDITY ---
  const ensureSequenceDefaults = (scenario) => {
      const scen = ensureScenarioShape(scenario);
      const startYear = scen.data.assumptions.timing.startYear || 2026;
      const startMonth = scen.data.assumptions.timing.startMonth || 1;

      ['income', 'expenses'].forEach(type => {
          if (!scen.data[type].profileSequence) scen.data[type].profileSequence = [];
          if (scen.data[type].profileSequence.length > 0) {
              scen.data[type].profileSequence.sort((a,b) => (a.startDate || '').localeCompare(b.startDate || ''));
          }
      });
      return scen;
  };

  // --- NEW: DATA VALIDATION & REPAIR ---
  const validateAndRepairImport = (json) => {
      console.log("Starting Data Validation...");
      const fixed = cloneDeep(json);

      // Helper: Rename Key in Object
      const renameKey = (obj, oldK, newK) => {
          if (obj && Object.prototype.hasOwnProperty.call(obj, oldK)) {
              obj[newK] = obj[oldK];
              delete obj[oldK];
              return true;
          }
          return false;
      };

      // Helper: strip event/window blobs accidentally captured in JSON exports
      const stripDomNoise = (obj) => {
          if (!obj || typeof obj !== 'object') return;
          const noisyKeys = [
              'view','nativeEvent','target','currentTarget','_reactName','_targetInst',
              'eventPhase','bubbles','cancelable','timeStamp','isTrusted','detail',
              'screenX','screenY','clientX','clientY','pageX','pageY',
              'ctrlKey','shiftKey','altKey','metaKey','button','buttons','relatedTarget',
              'movementX','movementY','which','charCode','keyCode','key','location',
              'sourceCapabilities','composed','defaultPrevented'
          ];
          noisyKeys.forEach(k => { if (Object.prototype.hasOwnProperty.call(obj, k)) delete obj[k]; });
      };

      const scrubLoan = (loan) => {
          if (!loan || typeof loan !== 'object') return;
          stripDomNoise(loan);
          if (loan.view) delete loan.view;
      };

      const scrubAsset = (asset) => {
          if (!asset || typeof asset !== 'object') return;
          stripDomNoise(asset);
          if (asset.view) delete asset.view;
      };

      // 1. MIGRATE LEGACY KEYS (Dick/Jane -> Primary/Spouse)
      const fixIncomeObject = (incomeObj, contextName) => {
          if (!incomeObj) return;

          if (renameKey(incomeObj, 'dick', 'primary')) console.log(`Fixed: Renamed 'dick' to 'primary' in ${contextName}`);
          if (renameKey(incomeObj, 'jane', 'spouse')) console.log(`Fixed: Renamed 'jane' to 'spouse' in ${contextName}`);

          // Fix Work Status Years
          if (incomeObj.workStatus) {
              Object.keys(incomeObj.workStatus).forEach(year => {
                  renameKey(incomeObj.workStatus[year], 'dick', 'primary');
                  renameKey(incomeObj.workStatus[year], 'jane', 'spouse');
              });
          }

          // 2. CHECK MISSING FIELDS & PROMPT
          ['primary', 'spouse'].forEach(person => {
              if (incomeObj[person]) {
                  // Birth Month (Critical for v1.3+ engine)
                  if (incomeObj[person].birthMonth === undefined || incomeObj[person].birthMonth === null) {
                      const val = prompt(`Data Repair (${contextName}):\nMissing Birth Month for '${person}'.\nEnter 1-12 (Default: 1):`, "1");
                      incomeObj[person].birthMonth = parseInt(val) || 1;
                  }
                  // Birth Year
                  if (!incomeObj[person].birthYear) {
                      const val = prompt(`Data Repair (${contextName}):\nMissing Birth Year for '${person}'.\nEnter YYYY (Default: 1970):`, "1970");
                      incomeObj[person].birthYear = parseInt(val) || 1970;
                  }
              }
          });
      };

      // Fix Scenarios
      if (fixed.scenarios) {
          Object.values(fixed.scenarios).forEach(scen => {
              // Drop computed/heavy blocks
              if (scen.resolvedData) delete scen.resolvedData;

              // Safety: Ensure data block exists
              if (!scen.data) scen.data = {};

              // Strip AI Metadata
              delete scen.__simulation_output;
              delete scen.__assumptions_documentation;

              // Strip DOM/event noise from assets/loans
              if (scen.data.loans) Object.values(scen.data.loans).forEach(scrubLoan);
              if (scen.data.assets?.accounts) Object.values(scen.data.assets.accounts).forEach(scrubAsset);

              // Rename PII in Name
              if (scen.name && scen.name.includes("Dick")) scen.name = scen.name.replace("Dick", "Primary");
              if (scen.name && scen.name.includes("Jane")) scen.name = scen.name.replace("Jane", "Spouse");

              // Fix Income
              if (scen.data.income) {
                  fixIncomeObject(scen.data.income, `Scenario: ${scen.name}`);
              }

              // Ensure Assumptions exist
              if (!scen.data.assumptions) scen.data.assumptions = scen.data.globals || {};
              if (!scen.data.assumptions.timing) scen.data.assumptions.timing = { startYear: 2026, startMonth: 1 };
          });
      }

      // Fix Profiles
      if (fixed.profiles) {
          Object.values(fixed.profiles).forEach(prof => {
              if (prof.type === 'income' && prof.data) {
                  fixIncomeObject(prof.data, `Profile: ${prof.name}`);
              }
          });
      }

      // Registry cleanup: strip DOM/event blobs from assets and liabilities
      if (fixed.registry) {
          if (fixed.registry.liabilities) Object.values(fixed.registry.liabilities).forEach(scrubLoan);
          if (fixed.registry.assets) Object.values(fixed.registry.assets).forEach(scrubAsset);
      }

      return fixed;
  };

  // --- ACTIONS ---
  const switchScenario = (id) => setStore(p => ({ ...p, meta: { ...p.meta, activeScenarioId: id } }));

  const updateScenarioData = (path, value) => {
    setStore(prev => {
      const next = cloneDeep(prev);
      const targetId = getActiveScenarioId(next);
      if (!targetId || !next.scenarios[targetId]) return prev;
      const scenario = next.scenarios[targetId];
      if (!scenario.links) scenario.links = { assets: [], liabilities: [], profiles: {} };
      if (!next.registry) next.registry = { assets: {}, liabilities: {}, profiles: cloneDeep(next.profiles || {}) };
      if (!scenario.data) scenario.data = {};
      if (!scenario.data.assets) scenario.data.assets = { accounts: {} };
      if (!scenario.data.loans) scenario.data.loans = {};

      const parts = path.split('.');
      if (parts[0] === 'assets' && parts[1] === 'accounts') {
          const assetId = parts[2];
          if (!next.registry.assets[assetId]) next.registry.assets[assetId] = {};
          set(next.registry.assets[assetId], parts.slice(3).join('.'), value);
          if (!scenario.links.assets.includes(assetId)) scenario.links.assets.push(assetId);
          // Keep scenario-local copy in sync so UI reflects changes immediately
          if (!scenario.data.assets.accounts[assetId]) scenario.data.assets.accounts[assetId] = {};
          set(scenario.data.assets.accounts[assetId], parts.slice(3).join('.'), value);
      }
      else if (parts[0] === 'loans') {
          const loanId = parts[1];
          if (!next.registry.liabilities[loanId]) next.registry.liabilities[loanId] = {};
          set(next.registry.liabilities[loanId], parts.slice(2).join('.'), value);
          if (!scenario.links.liabilities.includes(loanId)) scenario.links.liabilities.push(loanId);
          if (!scenario.data.loans[loanId]) scenario.data.loans[loanId] = {};
          set(scenario.data.loans[loanId], parts.slice(2).join('.'), value);
      }
      else {
          set(scenario.data, path, value);
      }

      scenario.lastUpdated = new Date().toISOString();
      return next;
    });
  };

  const updateScenarioMeta = (key, value) => {
      setStore(prev => {
          const newData = cloneDeep(prev);
          const targetId = getActiveScenarioId(newData);
          if (targetId && newData.scenarios[targetId]) newData.scenarios[targetId][key] = value;
          return newData;
      });
  };

  const updateScenarioDate = (y, m) => {
      updateScenarioData('assumptions.timing', { startYear: parseInt(y), startMonth: parseInt(m) });
  };

  const setSimulationMonth = (val) => {
      setSimulationDate(prev => {
          const nextRaw = typeof val === 'function' ? val(prev) : val;
          let candidate = nextRaw;
          if (!(candidate instanceof Date)) {
              if (typeof candidate === 'string') candidate = parseISO(candidate);
              else if (typeof candidate === 'number') candidate = new Date(candidate);
          }
          if (!isValid(candidate)) return clampToWindow(prev);
          return clampToWindow(candidate);
      });
  };
  const saveAll = () => { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); return true; };

  const resetAll = () => {
      const proceed = confirm("Reset to Example Scenario?\nThis will delete ALL scenarios and data from memory. Export your current state first if you want a backup.");
      if (!proceed) return;

      // Clear all known planner storage keys to avoid stale data reloading
      [STORAGE_KEY, PREVIOUS_STORAGE_KEY, LEGACY_STORAGE_KEY, OLDEST_STORAGE_KEY].forEach(k => {
          try { localStorage.removeItem(k); } catch (e) { console.warn("Unable to remove storage key", k, e); }
      });

      const fresh = migrateStoreToV221(cloneDeep(initialData));
      Object.keys(fresh.scenarios || {}).forEach(k => { fresh.scenarios[k] = ensureScenarioShape(fresh.scenarios[k]); });
      fresh.meta.activeScenarioId = fresh.meta.activeScenarioId || Object.keys(fresh.scenarios || {})[0];

      setStore(fresh);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh)); } catch (e) { console.warn("Local storage write failed during reset", e); }
  };

  const ensureLinks = (scenario) => {
      if (!scenario.links) scenario.links = { assets: [], liabilities: [], profiles: {} };
      if (!scenario.links.assets) scenario.links.assets = [];
      if (!scenario.links.liabilities) scenario.links.liabilities = [];
      if (!scenario.links.profiles) scenario.links.profiles = {};
      if (!scenario.links.profiles.income) scenario.links.profiles.income = scenario.data?.income?.profileSequence || [];
      if (!scenario.links.profiles.expenses) scenario.links.profiles.expenses = scenario.data?.expenses?.profileSequence || [];
  };

  const addAsset = (type) => {
      setStore(prev => {
          const newData = cloneDeep(prev);
          const targetId = getActiveScenarioId(newData);
      if (!targetId || !newData.scenarios[targetId]) return prev;
      const scen = newData.scenarios[targetId];
      ensureLinks(scen);
      if (!newData.registry) newData.registry = { assets: {}, liabilities: {}, profiles: cloneDeep(newData.profiles || {}) };

      const newId = `acct_${Date.now()}`;
      const timing = scen.data?.assumptions?.timing || { startYear: 2026, startMonth: 1 };
      const startDateStr = `${timing.startYear}-${String(timing.startMonth).padStart(2, '0')}-01`;
      const defaults = { id: newId, type, name: "New Account", balance: 0, owner: 'joint', active: true, inputs: {} };
      if (type === 'property') defaults.inputs = { buildYear: 2020, zipCode: '', startDate: startDateStr, linkedLoanIds: [] };
      if (type === 'inherited') defaults.inputs = { endDate: '2035-12-31' };
      newData.registry.assets[newId] = defaults;
      // Keep scenario-local copy in sync for immediate UI edits
      if (!scen.data) scen.data = {};
      if (!scen.data.assets) scen.data.assets = { accounts: {} };
      if (!scen.data.assets.accounts) scen.data.assets.accounts = {};
      scen.data.assets.accounts[newId] = cloneDeep(defaults);
      scen.links.assets.push(newId);
      return newData;
  });
  };

  const deleteAsset = (assetId) => {
      setStore(prev => {
          const newData = cloneDeep(prev);
          const targetId = getActiveScenarioId(newData);
          if (!targetId || !newData.scenarios[targetId]) return prev;
          const scen = newData.scenarios[targetId];
          ensureLinks(scen);
          if (newData.registry?.assets?.[assetId]) delete newData.registry.assets[assetId];
          scen.links.assets = (scen.links.assets || []).filter(id => id !== assetId);
          // Clean up from all scenarios' local data and links
          Object.values(newData.scenarios || {}).forEach(s => {
              if (s.data?.assets?.accounts?.[assetId]) delete s.data.assets.accounts[assetId];
              if (s.links?.assets) s.links.assets = s.links.assets.filter(id => id !== assetId);
          });
          return newData;
      });
  };

  const addLoan = (overrides = {}) => setStore(p => {
      const c = cloneDeep(p);
      const targetId = getActiveScenarioId(c);
      if (!targetId || !c.scenarios[targetId]) return p;
      const scen = c.scenarios[targetId];
      ensureLinks(scen);
      if(!c.registry) c.registry = { assets: {}, liabilities: {}, profiles: cloneDeep(c.profiles || {}) };
      const lid = overrides.id || `loan_${Date.now()}`;
      const defaults = {
          id: lid, name: "New Loan", type: "fixed", active: true,
          inputs: { principal: 10000, rate: 0.05, payment: 200, startDate: '2026-01-01', termMonths: 360 },
          activeStrategyId: 'base', strategies: { base: { name: 'Base', extraPayments: {} } }
      };
      c.registry.liabilities[lid] = { ...defaults, ...overrides, inputs: { ...defaults.inputs, ...(overrides.inputs || {}) }, id: lid };
      // Ensure scenario-local copy exists so UI has immediate data
      if (!scen.data) scen.data = {};
      if (!scen.data.loans) scen.data.loans = {};
      scen.data.loans[lid] = cloneDeep(c.registry.liabilities[lid]);
      if (!scen.links.liabilities.includes(lid)) scen.links.liabilities.push(lid);
      return c;
  });

  const deleteLoan = (lid) => setStore(p => {
      const c = cloneDeep(p);
      const targetId = getActiveScenarioId(c);
      if (!targetId || !c.scenarios[targetId]) return p;
      const scen = c.scenarios[targetId];
      ensureLinks(scen);
      if (c.registry?.liabilities?.[lid]) delete c.registry.liabilities[lid];
      if (scen.data?.loans?.[lid]) delete scen.data.loans[lid];
      scen.links.liabilities = (scen.links.liabilities || []).filter(id => id !== lid);
      // Clean up any other scenarios that may still carry this loan locally
      Object.values(c.scenarios || {}).forEach(s => {
          if (s.data?.loans?.[lid]) delete s.data.loans[lid];
          if (s.links?.liabilities) s.links.liabilities = s.links.liabilities.filter(x => x !== lid);
      });
      return c;
  });
  const batchUpdateLoanPayments = (lid, sid, u) => setStore(p => {
      const c = cloneDeep(p);
      if (c.registry?.liabilities?.[lid]?.strategies?.[sid]) {
          const t = c.registry.liabilities[lid].strategies[sid].extraPayments;
          Object.entries(u).forEach(([k,v]) => v <= 0 ? delete t[k] : t[k] = v);
      }
      // Mirror into scenario-local copies
      Object.values(c.scenarios || {}).forEach(s => {
          const loanRef = s.data?.loans?.[lid];
          if (loanRef?.strategies?.[sid]) {
              const map = loanRef.strategies[sid].extraPayments || {};
              Object.entries(u).forEach(([k,v]) => v <= 0 ? delete map[k] : map[k] = v);
              loanRef.strategies[sid].extraPayments = map;
          }
      });
      return c;
  });
  const addLoanStrategy = (lid, n) => setStore(p => {
      const c = cloneDeep(p);
      const l = c.registry?.liabilities?.[lid];
      const newId = `strat_${Date.now()}`;
      if (l) l.strategies[newId] = { name: n, extraPayments: {} };
      Object.values(c.scenarios || {}).forEach(s => {
          const loanRef = s.data?.loans?.[lid];
          if (loanRef) {
              if (!loanRef.strategies) loanRef.strategies = {};
              loanRef.strategies[newId] = { name: n, extraPayments: {} };
          }
      });
      return c;
  });
  const renameLoanStrategy = (lid, sid, n) => setStore(p => {
      const c = cloneDeep(p);
      const l = c.registry?.liabilities?.[lid];
      if (l?.strategies?.[sid]) l.strategies[sid].name = n;
      Object.values(c.scenarios || {}).forEach(s => {
          const loanRef = s.data?.loans?.[lid];
          if (loanRef?.strategies?.[sid]) loanRef.strategies[sid].name = n;
      });
      return c;
  });
  const duplicateLoanStrategy = (lid, sid, n) => setStore(p => {
      const c = cloneDeep(p);
      const l = c.registry?.liabilities?.[lid];
      const newId = `strat_${Date.now()}`;
      if (l?.strategies?.[sid]) l.strategies[newId] = { ...cloneDeep(l.strategies[sid]), name: n };
      Object.values(c.scenarios || {}).forEach(s => {
          const loanRef = s.data?.loans?.[lid];
          if (loanRef?.strategies?.[sid]) {
              if (!loanRef.strategies) loanRef.strategies = {};
              loanRef.strategies[newId] = { ...cloneDeep(loanRef.strategies[sid]), name: n };
          }
      });
      return c;
  });
  const deleteLoanStrategy = (lid, sid) => setStore(p => {
      const c = cloneDeep(p);
      const l = c.registry?.liabilities?.[lid];
      if (l?.strategies?.[sid]) {
          delete l.strategies[sid];
          if(l.activeStrategyId === sid) l.activeStrategyId = Object.keys(l.strategies)[0];
      }
      Object.values(c.scenarios || {}).forEach(s => {
          const loanRef = s.data?.loans?.[lid];
          if (loanRef?.strategies?.[sid]) {
              delete loanRef.strategies[sid];
              if (loanRef.activeStrategyId === sid) loanRef.activeStrategyId = Object.keys(loanRef.strategies || {})[0];
          }
      });
      return c;
  });

  const createScenario = (name, cloneData) => {
       setStore(prev => {
           const newId = `scen_${Date.now()}`;
           const source = cloneData || prev.scenarios[activeId] || scenarioSkeleton();
           let newScen = cloneDeep(source);
           newScen.id = newId;
           newScen.name = name;
           if(newScen.linkedProfiles) delete newScen.linkedProfiles;
           delete newScen.__simulation_output;
           delete newScen.__assumptions_documentation;

           newScen = ensureSequenceDefaults(newScen);

           return {
               ...prev,
               meta: { ...prev.meta, activeScenarioId: newId },
               scenarios: { ...prev.scenarios, [newId]: newScen }
           };
       });
  };

  const createBlankScenario = (name) => createScenario(name, ensureScenarioShape(initialData.scenarios['scen_default'] || scenarioSkeleton()));

  const renameScenario = (id, name) => setStore(p => {
      const d = cloneDeep(p);
      if(d.scenarios[id]) d.scenarios[id].name = name;
      return d;
  });

  const deleteScenario = (id) => setStore(p => {
      const d = cloneDeep(p);
      if(Object.keys(d.scenarios).length <= 1) {
          if (confirm("You are deleting the last scenario. This will reset the application to the Example Scenario. Continue?")) {
              const defaultScen = cloneDeep(initialData.scenarios['scen_default']);
              defaultScen.name = "Example Scenario";
              const newScenarios = {};
              newScenarios[defaultScen.id] = defaultScen;
              return { ...d, meta: { ...d.meta, activeScenarioId: defaultScen.id }, scenarios: newScenarios };
          }
          return p;
      }
      delete d.scenarios[id];
      if(d.meta.activeScenarioId === id) {
          const firstId = Object.keys(d.scenarios)[0];
          d.meta.activeScenarioId = firstId;
      }
      return d;
  });

  // IMPORT: overwrite entire application state with imported file (after validation/migration)
  const importData = (importedJson) => {
      const cleanData = validateAndRepairImport(importedJson);
      const migrated = migrateStoreToV221(cleanData);

      setStore(prev => {
          const sourceScenarios = migrated.scenarios || {};
          const sourceKeys = Object.keys(sourceScenarios);
          if (sourceKeys.length === 0) {
              alert("Import failed: no scenarios found in the file.");
              return prev;
          }

          const next = cloneDeep(migrated);
          if (!next.registry) next.registry = { assets: {}, liabilities: {}, profiles: cloneDeep(next.profiles || {}) };
          if (!next.profiles) next.profiles = cloneDeep(next.registry.profiles || {});

          // Ensure each scenario has defaults/sorted sequences
          Object.keys(next.scenarios || {}).forEach(k => {
              next.scenarios[k] = ensureSequenceDefaults(next.scenarios[k]);
          });

          // Determine active scenario; prompt if missing/invalid
          const validKeys = Object.keys(next.scenarios || {});
          let activeId = next.meta?.activeScenarioId;
          if (!activeId || !validKeys.includes(activeId)) {
              const fallback = validKeys[0];
              const choice = typeof prompt === 'function'
                  ? prompt(`Select active scenario ID to use:\n${validKeys.join('\n')}`, fallback)
                  : null;
              activeId = (choice && validKeys.includes(choice)) ? choice : fallback;
          }
          next.meta = { ...(next.meta || {}), activeScenarioId: activeId };

          return rebuildStoreScenarios(next);
      });
  };

  const saveProfile = (type, name, data) => setStore(prev => {
      const next = cloneDeep(prev);
      const pid = `prof_${Date.now()}`;
      if(!next.registry) next.registry = { assets: {}, liabilities: {}, profiles: {} };
      if(!next.profiles) next.profiles = {};
      const payload = { id: pid, name, type, data: cloneDeep(data) };
      next.registry.profiles[pid] = payload;
      next.profiles[pid] = payload;

      const scen = next.scenarios[activeId];
      ensureLinks(scen);
      const seq = type === 'income' ? scen.links.profiles.income : scen.links.profiles.expenses;
      seq.push({
          profileId: pid,
          startDate: format(simulationDate, 'yyyy-MM-dd'),
          isActive: true
      });
      return next;
  });

  const updateProfile = (pid, d) => setStore(p => { const c = cloneDeep(p); if(c.registry?.profiles?.[pid]) c.registry.profiles[pid].data = cloneDeep(d); if(c.profiles?.[pid]) c.profiles[pid].data = cloneDeep(d); return c; });
  const updateProfileMeta = (pid, meta) => setStore(p => { const c = cloneDeep(p); if(c.registry?.profiles?.[pid]) { Object.assign(c.registry.profiles[pid], meta); } if(c.profiles?.[pid]) { Object.assign(c.profiles[pid], meta); } return c; });
  const renameProfile = (pid, n) => setStore(p => { const c = cloneDeep(p); if(c.registry?.profiles?.[pid]) c.registry.profiles[pid].name = n; if(c.profiles?.[pid]) c.profiles[pid].name = n; return c; });
  const deleteProfile = (pid) => setStore(p => { const c = cloneDeep(p); if(c.registry?.profiles?.[pid]) delete c.registry.profiles[pid]; if(c.profiles?.[pid]) delete c.profiles[pid]; return c; });
  const toggleProfileInScenario = (t, pid, act, date) => setStore(p => {
      const c = cloneDeep(p);
      const targetId = getActiveScenarioId(c);
      if (!targetId || !c.scenarios[targetId]) return p;
      const scen = ensureScenarioShape(c.scenarios[targetId]);
      c.scenarios[targetId] = scen;
      const seq = t === 'income' ? scen.links.profiles.income : scen.links.profiles.expenses;
      const exist = seq.find(x => x.profileId === pid);
      if(exist){ exist.isActive = act; if(date) exist.startDate = date; }
      else { seq.push({ profileId: pid, startDate: date || '2026-01-01', isActive: act }); }
      return c;
  });

  const linkAssetToScenario = (assetId) => setStore(p => {
      const c = cloneDeep(p);
      const scen = c.scenarios[activeId];
      ensureLinks(scen);
      if (!scen.links.assets.includes(assetId)) scen.links.assets.push(assetId);

      // Ensure the asset data is present in the scenario (copy from registry if missing)
      if (!scen.data.assets) scen.data.assets = { accounts: {} };
      if (!scen.data.assets.accounts) scen.data.assets.accounts = {};
      if (!scen.data.assets.accounts[assetId] && c.registry?.assets?.[assetId]) {
          scen.data.assets.accounts[assetId] = cloneDeep(c.registry.assets[assetId]);
      }
      return c;
  });

  const unlinkAssetFromScenario = (assetId) => setStore(p => {
      const c = cloneDeep(p);
      const scen = c.scenarios[activeId];
      ensureLinks(scen);
      scen.links.assets = (scen.links.assets || []).filter(id => id !== assetId);
      return c;
  });

  const linkLiabilityToScenario = (lid) => setStore(p => {
      const c = cloneDeep(p);
      const scen = c.scenarios[activeId];
      ensureLinks(scen);
      if (!scen.links.liabilities.includes(lid)) scen.links.liabilities.push(lid);

      // Ensure the liability data is present in the scenario (copy from registry if missing)
      if (!scen.data.loans) scen.data.loans = {};
      if (!scen.data.loans[lid] && c.registry?.liabilities?.[lid]) {
          scen.data.loans[lid] = cloneDeep(c.registry.liabilities[lid]);
      }
      return c;
  });

  const unlinkLiabilityFromScenario = (lid) => setStore(p => {
      const c = cloneDeep(p);
      const scen = c.scenarios[activeId];
      ensureLinks(scen);
      scen.links.liabilities = (scen.links.liabilities || []).filter(id => id !== lid);
      return c;
  });

  return (
    <DataContext.Provider value={{
      store, activeScenario, simulationDate, isLoaded,
      actions: {
        switchScenario, createScenario, createBlankScenario, renameScenario, deleteScenario, updateScenarioMeta,
        updateScenarioData, updateScenarioDate, setSimulationMonth, saveAll,
        resetAll, addAsset, deleteAsset, addLoan, deleteLoan, batchUpdateLoanPayments,
        addLoanStrategy, renameLoanStrategy, duplicateLoanStrategy, deleteLoanStrategy,
        importData, saveProfile, updateProfile, updateProfileMeta, renameProfile, deleteProfile, toggleProfileInScenario,
        linkAssetToScenario, unlinkAssetFromScenario, linkLiabilityToScenario, unlinkLiabilityFromScenario
      }
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const ctx = useContext(DataContext);
  return ctx || defaultContextValue;
};
