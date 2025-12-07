import React, { createContext, useContext, useState, useEffect } from 'react';
import initialData from '../data/application_data.json';
import { cloneDeep, set, get } from 'lodash';
import { format, parseISO, isValid } from 'date-fns';

const DataContext = createContext();

// Storage key versioned for the new schema
const STORAGE_KEY = 'ba_financial_planner_v1.4_primary_spouse';

export const DataProvider = ({ children }) => {

  // --- 1. LOADER ---
  const [store, setStore] = useState(() => {
    let data = cloneDeep(initialData);
    try {
      const local = localStorage.getItem(STORAGE_KEY);
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed && parsed.scenarios) data = parsed;
      }
    } catch (e) {
      console.error("Local storage error, reverting to default JSON", e);
    }
    return data;
  });

  const [isLoaded, setIsLoaded] = useState(false);

  // --- 2. PERSISTENCE ---
  useEffect(() => {
    if (isLoaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }, [store, isLoaded]);

  useEffect(() => {
      setIsLoaded(true);
      console.log("BA Financial Data Ready (v1.4)");
  }, []);

  // --- 3. ACCESSORS ---
  const activeId = store.meta.activeScenarioId;
  const activeScenario = store.scenarios[activeId];

  const [simulationDate, setSimulationDate] = useState(() => {
      const savedDateStr = activeScenario?.data?.assumptions?.currentModelDate || activeScenario?.data?.globals?.currentModelDate;
      return (savedDateStr && isValid(parseISO(savedDateStr))) ? parseISO(savedDateStr) : new Date(2026, 0, 1);
  });

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
      // Safety Check: Ensure structure exists to prevent crashes on legacy/broken scenarios
      if (!scenario.data) scenario.data = {};
      if (!scenario.data.assumptions) scenario.data.assumptions = { timing: { startYear: 2026, startMonth: 1 } };
      if (!scenario.data.assumptions.timing) scenario.data.assumptions.timing = { startYear: 2026, startMonth: 1 };

      const startYear = scenario.data.assumptions.timing.startYear || 2026;
      const startMonth = scenario.data.assumptions.timing.startMonth || 1;

      ['income', 'expenses'].forEach(type => {
          if (!scenario.data[type]) scenario.data[type] = {}; // Safety
          if (!scenario.data[type].profileSequence) scenario.data[type].profileSequence = [];
          if (scenario.data[type].profileSequence.length > 0) {
              scenario.data[type].profileSequence.sort((a,b) => a.startDate.localeCompare(b.startDate));
          }
      });
      return scenario;
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
              // Safety: Ensure data block exists
              if (!scen.data) scen.data = {};

              // Strip AI Metadata
              delete scen.__simulation_output;
              delete scen.__assumptions_documentation;

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

      return fixed;
  };

  // --- ACTIONS ---
  const switchScenario = (id) => setStore(p => ({ ...p, meta: { ...p.meta, activeScenarioId: id } }));

  const updateScenarioData = (path, value) => {
    setStore(prev => {
      const newData = cloneDeep(prev);
      set(newData.scenarios[activeId].data, path, value);
      newData.scenarios[activeId].lastUpdated = new Date().toISOString();
      return newData;
    });
  };

  const updateScenarioMeta = (key, value) => {
      setStore(prev => {
          const newData = cloneDeep(prev);
          newData.scenarios[activeId][key] = value;
          return newData;
      });
  };

  const updateScenarioDate = (y, m) => {
      updateScenarioData('assumptions.timing', { startYear: parseInt(y), startMonth: parseInt(m) });
  };

  const setSimulationMonth = (val) => setSimulationDate(val);
  const saveAll = () => { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); return true; };

  const resetActiveScenario = () => {
      setStore(prev => {
          const next = cloneDeep(prev);
          const defaultScen = cloneDeep(initialData.scenarios['scen_default']);
          defaultScen.name = "Base Plan: Primary & Spouse";
          next.scenarios[activeId].data = defaultScen.data;
          next.scenarios[activeId].name = defaultScen.name;
          return next;
      });
      window.location.reload();
  };

  const addAsset = (type) => {
      setStore(prev => {
          const newData = cloneDeep(prev);
          const newId = `acct_${Date.now()}`;
          if (!newData.scenarios[activeId].data.assets.accounts) newData.scenarios[activeId].data.assets.accounts = {};
          const defaults = { id: newId, type, name: "New Account", balance: 0, owner: 'joint', active: true, inputs: {} };
          if (type === 'property') defaults.inputs = { buildYear: 2020, zipCode: '' };
          if (type === 'inherited') defaults.inputs = { endDate: '2035-12-31' };
          newData.scenarios[activeId].data.assets.accounts[newId] = defaults;
          return newData;
      });
  };

  const deleteAsset = (assetId) => {
      setStore(prev => {
          const newData = cloneDeep(prev);
          if (newData.scenarios[activeId].data.assets.accounts[assetId]) {
              delete newData.scenarios[activeId].data.assets.accounts[assetId];
          }
          return newData;
      });
  };

  const addLoan = (overrides = {}) => setStore(p => {
      const c = cloneDeep(p);
      const lid = `loan_${Date.now()}`;
      if(!c.scenarios[activeId].data.loans) c.scenarios[activeId].data.loans={};
      const defaults = {
          id: lid, name: "New Loan", type: "fixed", active: true,
          inputs: { principal: 10000, rate: 0.05, payment: 200, startDate: '2026-01-01', termMonths: 360 },
          activeStrategyId: 'base', strategies: { base: { name: 'Base', extraPayments: {} } }
      };
      c.scenarios[activeId].data.loans[lid] = { ...defaults, ...overrides, inputs: { ...defaults.inputs, ...(overrides.inputs || {}) } };
      return c;
  });

  const deleteLoan = (lid) => setStore(p => { const c = cloneDeep(p); delete c.scenarios[activeId].data.loans[lid]; return c; });
  const batchUpdateLoanPayments = (lid, sid, u) => setStore(p => { const c = cloneDeep(p); const t = c.scenarios[activeId].data.loans[lid].strategies[sid].extraPayments; Object.entries(u).forEach(([k,v]) => v <= 0 ? delete t[k] : t[k] = v); return c; });
  const addLoanStrategy = (lid, n) => setStore(p => { const c = cloneDeep(p); const l = c.scenarios[activeId].data.loans[lid]; l.strategies[`strat_${Date.now()}`] = { name: n, extraPayments: {} }; return c; });
  const renameLoanStrategy = (lid, sid, n) => setStore(p => { const c = cloneDeep(p); c.scenarios[activeId].data.loans[lid].strategies[sid].name = n; return c; });
  const duplicateLoanStrategy = (lid, sid, n) => setStore(p => { const c = cloneDeep(p); const l = c.scenarios[activeId].data.loans[lid]; l.strategies[`strat_${Date.now()}`] = { ...cloneDeep(l.strategies[sid]), name: n }; return c; });
  const deleteLoanStrategy = (lid, sid) => setStore(p => { const c = cloneDeep(p); const l = c.scenarios[activeId].data.loans[lid]; delete l.strategies[sid]; if(l.activeStrategyId === sid) l.activeStrategyId = Object.keys(l.strategies)[0]; return c; });

  const createScenario = (name, cloneData) => {
       setStore(prev => {
           const newId = `scen_${Date.now()}`;
           const source = cloneData || prev.scenarios[activeId];
           const newScen = cloneDeep(source);
           newScen.id = newId;
           newScen.name = name;
           if(newScen.linkedProfiles) delete newScen.linkedProfiles;
           delete newScen.__simulation_output;
           delete newScen.__assumptions_documentation;

           ensureSequenceDefaults(newScen);

           return {
               ...prev,
               meta: { ...prev.meta, activeScenarioId: newId },
               scenarios: { ...prev.scenarios, [newId]: newScen }
           };
       });
  };

  const createBlankScenario = (name) => createScenario(name, initialData.scenarios['scen_default']);

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
      if(d.meta.activeScenarioId === id) d.meta.activeScenarioId = Object.keys(d.scenarios)[0];
      return d;
  });

  // UPDATED IMPORT FUNCTION (FIX FOR MULTI-SCENARIO RESTORE)
  const importData = (importedJson, mode = 'new') => {
      const cleanData = validateAndRepairImport(importedJson);

      setStore(prev => {
          const newState = cloneDeep(prev);

          // 1. Merge Profiles (Global)
          if (cleanData.profiles) {
              newState.profiles = { ...newState.profiles, ...cleanData.profiles };
          }

          const sourceScenarios = cleanData.scenarios || {};
          const sourceKeys = Object.keys(sourceScenarios);

          if (sourceKeys.length === 0) {
              console.error("No valid scenarios found in import.");
              return prev;
          }

          // 2. Identify the Active Scenario ID from the backup
          const backupActiveId = cleanData.meta?.activeScenarioId;
          let newActiveId = null;

          // MODE: OVERWRITE ACTIVE
          if (mode === 'overwrite_active') {
              const sourceId = backupActiveId || sourceKeys[0];
              const sourceScenario = sourceScenarios[sourceId];

              if (sourceScenario) {
                  const finalScenario = cloneDeep(sourceScenario);
                  try {
                      ensureSequenceDefaults(finalScenario);
                      const targetId = newState.meta.activeScenarioId;
                      newState.scenarios[targetId].data = finalScenario.data;
                      newState.scenarios[targetId].name = finalScenario.name;
                  } catch (err) {
                      console.error("Failed to overwrite active scenario with imported data:", err);
                  }
              }
          }
          // MODE: NEW (FULL RESTORE)
          else {
              // Iterate through ALL scenarios in the import file
              sourceKeys.forEach((key, index) => {
                  try {
                      const sourceScenario = sourceScenarios[key];
                      const finalScenario = cloneDeep(sourceScenario);
                      ensureSequenceDefaults(finalScenario);

                      // Generate a unique ID to ensure we don't collide with existing keys
                      const newId = `scen_${Date.now()}_${index}`;

                      finalScenario.id = newId;
                      newState.scenarios[newId] = finalScenario;

                      // If this matches the backup's active ID, track it
                      if (key === backupActiveId) {
                          newActiveId = newId;
                      }
                      // Fallback: If no match found yet, default to the first one imported
                      if (!newActiveId && index === 0) {
                          newActiveId = newId;
                      }
                  } catch (err) {
                      console.warn(`Skipping malformed scenario '${key}' during import:`, err);
                  }
              });

              // 3. Switch active scenario to the restored one (prioritizing the one that was active in backup)
              if (newActiveId) {
                  newState.meta.activeScenarioId = newActiveId;
              }
          }

          return newState;
      });
  };

  const saveProfile = (type, name, data) => setStore(prev => {
      const next = cloneDeep(prev);
      const pid = `prof_${Date.now()}`;
      if(!next.profiles) next.profiles = {};
      next.profiles[pid] = { id: pid, name, type, data: cloneDeep(data) };

      if (!next.scenarios[activeId].data[type].profileSequence) next.scenarios[activeId].data[type].profileSequence = [];
      next.scenarios[activeId].data[type].profileSequence.push({
          profileId: pid,
          startDate: format(simulationDate, 'yyyy-MM-dd'),
          isActive: true
      });
      return next;
  });

  const updateProfile = (pid, d) => setStore(p => { const c = cloneDeep(p); if(c.profiles[pid]) c.profiles[pid].data = cloneDeep(d); return c; });
  const updateProfileMeta = (pid, meta) => setStore(p => { const c = cloneDeep(p); if(c.profiles[pid]) { Object.assign(c.profiles[pid], meta); } return c; });
  const renameProfile = (pid, n) => setStore(p => { const c = cloneDeep(p); if(c.profiles[pid]) c.profiles[pid].name = n; return c; });
  const deleteProfile = (pid) => setStore(p => { const c = cloneDeep(p); delete c.profiles[pid]; return c; });
  const toggleProfileInScenario = (t, pid, act, date) => setStore(p => {
      const c = cloneDeep(p);
      const seq = c.scenarios[activeId].data[t].profileSequence;
      const exist = seq.find(x => x.profileId === pid);
      if(exist){ exist.isActive = act; if(date) exist.startDate = date; }
      else { seq.push({ profileId: pid, startDate: date || '2026-01-01', isActive: act }); }
      return c;
  });

  return (
    <DataContext.Provider value={{
      store, activeScenario, simulationDate, isLoaded,
      actions: {
        switchScenario, createScenario, createBlankScenario, renameScenario, deleteScenario, updateScenarioMeta,
        updateScenarioData, updateScenarioDate, setSimulationMonth, saveAll,
        resetActiveScenario, addAsset, deleteAsset, addLoan, deleteLoan, batchUpdateLoanPayments,
        addLoanStrategy, renameLoanStrategy, duplicateLoanStrategy, deleteLoanStrategy,
        importData, saveProfile, updateProfile, updateProfileMeta, renameProfile, deleteProfile, toggleProfileInScenario
      }
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => useContext(DataContext);