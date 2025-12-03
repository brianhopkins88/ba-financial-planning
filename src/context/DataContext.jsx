import React, { createContext, useContext, useState, useEffect } from 'react';
import initialData from '../data/application_data.json';
import { cloneDeep, set } from 'lodash';
import { format, parseISO, isValid } from 'date-fns';

const DataContext = createContext();

// UPDATED KEY: This invalidates the old "Brian/Andrea" data and forces "Dick/Jane" to load
const STORAGE_KEY = 'ba_financial_planner_v1.2_dick_jane';

export const DataProvider = ({ children }) => {

  // --- 1. LOADER ---
  const [store, setStore] = useState(() => {
    let data = cloneDeep(initialData);
    if (data.scenarios['scen_default']) data.scenarios['scen_default'].name = "Example Scenario";

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

  useEffect(() => { setIsLoaded(true); console.log("BA Financial Data Ready"); }, []);

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
      const startYear = scenario.data.assumptions.timing.startYear || 2026;
      const startMonth = scenario.data.assumptions.timing.startMonth || 1;
      const startDateStr = `${startYear}-${String(startMonth).padStart(2,'0')}-01`;

      ['income', 'expenses'].forEach(type => {
          if (!scenario.data[type].profileSequence) scenario.data[type].profileSequence = [];
          if (scenario.data[type].profileSequence.length === 0) {
              // ...
          } else {
              scenario.data[type].profileSequence.sort((a,b) => a.startDate.localeCompare(b.startDate));
          }
      });
      return scenario;
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
          defaultScen.name = "Example Scenario";
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

           // Ensure Sequence validity on creation
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

  const importData = (importedJson, mode = 'new') => {
      setStore(prev => {
          const newState = cloneDeep(prev);
          if (importedJson.profiles) newState.profiles = { ...newState.profiles, ...importedJson.profiles };

          const sourceScenarios = importedJson.scenarios || {};
          const sourceId = importedJson.meta?.activeScenarioId || Object.keys(sourceScenarios)[0];
          const sourceScenario = sourceScenarios[sourceId];

          if (!sourceScenario) { console.error("No valid scenario found."); return prev; }

          const cleanSource = cloneDeep(sourceScenario);
          delete cleanSource.__simulation_output;
          delete cleanSource.__assumptions_documentation;
          ensureSequenceDefaults(cleanSource);

          if (mode === 'overwrite_active') {
              const targetId = newState.meta.activeScenarioId;
              newState.scenarios[targetId].data = cleanSource.data;
              newState.scenarios[targetId].name = cleanSource.name;
              newState.scenarios[targetId].id = targetId;
          } else {
              const newId = `scen_${Date.now()}`;
              cleanSource.id = newId;
              newState.scenarios[newId] = cleanSource;
              newState.meta.activeScenarioId = newId;
          }
          return newState;
      });
  };

  const saveProfile = (type, name, data) => setStore(prev => {
      const next = cloneDeep(prev);
      const pid = `prof_${Date.now()}`;
      if(!next.profiles) next.profiles = {};
      next.profiles[pid] = { id: pid, name, type, data: cloneDeep(data) };

      // Auto-attach to sequence
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