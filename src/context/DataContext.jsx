import React, { createContext, useContext, useState, useEffect } from 'react';
import initialData from '../data/hgv_data.json';
import { cloneDeep, set } from 'lodash';
import { format, parseISO, isValid } from 'date-fns';

const DataContext = createContext();

const STORAGE_KEY = 'ba_financial_planner_v1';

export const DataProvider = ({ children }) => {

  // --- 1. ROBUST LOADER ---
  const [store, setStore] = useState(() => {
    let data = cloneDeep(initialData);

    try {
      const local = localStorage.getItem(STORAGE_KEY);
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed && parsed.scenarios) {
            data = parsed;
        }
      }
    } catch (e) {
      console.error("Local storage error, reverting to default JSON", e);
    }

    // Polyfills
    Object.values(data.scenarios).forEach(scen => {
        if (!scen.data.globals) scen.data.globals = {};
        if (!scen.data.globals.timing) {
            scen.data.globals.timing = { startYear: 2026, startMonth: 1 };
        }
        if (!scen.data.expenses) scen.data.expenses = { bills: [], home: [], living: [] };
        if (!scen.data.expenses.retirementBrackets) scen.data.expenses.retirementBrackets = {};

        if (!scen.data.income) scen.data.income = { brian: {}, andrea: {} };
        // Default birth years (User Updates: 1966 & 1965)
        if (!scen.data.income.brian.birthYear) scen.data.income.brian.birthYear = 1966;
        if (!scen.data.income.andrea.birthYear) scen.data.income.andrea.birthYear = 1965;
    });

    return data;
  });

  const [isLoaded, setIsLoaded] = useState(false);

  // --- 2. PERSISTENCE ---
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    }
  }, [store, isLoaded]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true);
      console.log("BA Financial Data Ready");
    }, 100);
    return () => clearTimeout(timer);
  }, []);


  // --- 3. SAFE ACCESSORS ---
  const getActiveId = (currentStore = store) => {
      const id = currentStore.meta?.activeScenarioId;
      if (currentStore.scenarios && currentStore.scenarios[id]) return id;
      return Object.keys(currentStore.scenarios)[0];
  };

  const activeId = getActiveId();
  const activeScenario = store.scenarios[activeId];
  const timing = activeScenario.data.globals.timing;

  // --- UPDATED: Date Initialization ---
  const [simulationDate, setSimulationDate] = useState(() => {
      // 1. Try to load the persisted "Model Cursor" from the scenario
      const savedDateStr = activeScenario.data.globals.currentModelDate;
      if (savedDateStr) {
          const parsed = parseISO(savedDateStr);
          if (isValid(parsed)) return parsed;
      }

      // 2. Default to January 2026
      return new Date(2026, 0, 1);
  });

  // Sync state if scenario changes (switched scenario might have a different saved date)
  useEffect(() => {
      const savedDateStr = activeScenario.data.globals.currentModelDate;
      if (savedDateStr) {
          const parsed = parseISO(savedDateStr);
          if (isValid(parsed)) {
              setSimulationDate(parsed);
              return;
          }
      }
      // Fallback if no saved date in this specific scenario
      setSimulationDate(new Date(2026, 0, 1));
  }, [activeId]);


  // --- 4. ACTIONS ---

  const switchScenario = (scenarioId) => {
    if (store.scenarios[scenarioId]) {
      setStore(prev => ({
        ...prev,
        meta: { ...prev.meta, activeScenarioId: scenarioId }
      }));
    }
  };

  const createScenario = (newName, dataToClone = null) => {
    setStore(prev => {
      const activeId = getActiveId(prev);
      const newId = `scen_${Date.now()}`;

      const sourceData = dataToClone ? dataToClone : prev.scenarios[activeId];
      const newScenario = cloneDeep(sourceData);

      newScenario.id = newId;
      newScenario.name = newName;
      newScenario.created = new Date().toISOString();
      newScenario.lastUpdated = new Date().toISOString();

      // Remove linkedProfiles metadata if cloning from an export object, we assume they are already in store
      if (newScenario.linkedProfiles) delete newScenario.linkedProfiles;

      return {
        ...prev,
        meta: { ...prev.meta, activeScenarioId: newId },
        scenarios: { ...prev.scenarios, [newId]: newScenario }
      };
    });
  };

  const createBlankScenario = (newName) => {
      createScenario(newName, initialData.scenarios['scen_default']);
  };

  const renameScenario = (scenarioId, newName) => {
    setStore(prev => {
      const newData = cloneDeep(prev);
      if (newData.scenarios[scenarioId]) {
        newData.scenarios[scenarioId].name = newName;
        newData.scenarios[scenarioId].lastUpdated = new Date().toISOString();
      }
      return newData;
    });
  };

  const deleteScenario = (scenarioId) => {
    setStore(prev => {
      const newData = cloneDeep(prev);
      const activeId = newData.meta.activeScenarioId;

      if (Object.keys(newData.scenarios).length <= 1) {
        alert("Cannot delete the only remaining scenario.");
        return prev;
      }

      delete newData.scenarios[scenarioId];
      if (activeId === scenarioId) {
        const nextId = Object.keys(newData.scenarios)[0];
        newData.meta.activeScenarioId = nextId;
      }
      return newData;
    });
  };

  // --- IMPORT ACTIONS (With Profile Merging) ---

  const mergeLinkedProfiles = (state, linkedProfiles) => {
      if (!linkedProfiles) return state;
      const newState = cloneDeep(state);
      if (!newState.profiles) newState.profiles = {};

      Object.entries(linkedProfiles).forEach(([pid, profile]) => {
          // If profile doesn't exist, add it
          if (!newState.profiles[pid]) {
              newState.profiles[pid] = profile;
          } else {
              // If it exists but is different? For now, we assume ID collision = same profile or user manually manages conflicts.
          }
      });
      return newState;
  };

  const importToActive = (scenarioObject) => {
      if (!scenarioObject || !scenarioObject.data) { alert("Invalid data"); return; }

      setStore(prev => {
          let newData = cloneDeep(prev);

          // 1. Merge Profiles if present
          if (scenarioObject.linkedProfiles) {
              newData = mergeLinkedProfiles(newData, scenarioObject.linkedProfiles);
          }

          // 2. Overwrite Scenario Data
          const id = getActiveId(newData);
          newData.scenarios[id].data = cloneDeep(scenarioObject.data);
          newData.scenarios[id].lastUpdated = new Date().toISOString();
          return newData;
      });
  };

  const importAsNew = (name, scenarioObject) => {
      if (!scenarioObject || !scenarioObject.data) { alert("Invalid data"); return; }

      // 1. Merge Profiles first (hacky but effective: update store then create scenario)
      if (scenarioObject.linkedProfiles) {
          setStore(prev => mergeLinkedProfiles(prev, scenarioObject.linkedProfiles));
      }

      // 2. Create the scenario
      const newScenStructure = {
          ...scenarioObject,
          name: name
      };
      // Clean up the linkedProfiles key before saving to scenario list
      if(newScenStructure.linkedProfiles) delete newScenStructure.linkedProfiles;

      createScenario(name, newScenStructure);
  };

  const resetActiveScenario = () => {
      setStore(prev => {
          const newData = cloneDeep(prev);
          const id = getActiveId(newData);
          newData.scenarios[id].data = cloneDeep(initialData.scenarios['scen_default'].data);
          newData.scenarios[id].lastUpdated = new Date().toISOString();
          return newData;
      });
  };

  const loadFromFile = (jsonContent) => {
      try {
          if(!jsonContent.scenarios) throw new Error("Invalid file");
          Object.values(jsonContent.scenarios).forEach(scen => {
             if (!scen.data.globals.timing) scen.data.globals.timing = { startYear: 2026, startMonth: 1 };
          });
          setStore(jsonContent);
          alert("Full Data Store loaded successfully!");
      } catch (e) {
          alert("Failed to load file: " + e.message);
      }
  };

  const updateScenarioData = (path, value) => {
    setStore(prev => {
      const newData = cloneDeep(prev);
      const id = getActiveId(newData);
      set(newData.scenarios[id].data, path, value);
      newData.scenarios[id].lastUpdated = new Date().toISOString();
      return newData;
    });
  };

  const updateScenarioDate = (year, month) => {
    setStore(prev => {
        const newData = cloneDeep(prev);
        const id = getActiveId(newData);
        newData.scenarios[id].data.globals.timing = { startYear: parseInt(year), startMonth: parseInt(month) };
        return newData;
    });
  };

  const setSimulationMonth = (dateObjOrUpdater) => {
    setSimulationDate(currentDate => {
        return typeof dateObjOrUpdater === 'function' ? dateObjOrUpdater(currentDate) : dateObjOrUpdater;
    });
  };

  // Effect to sync simulationDate to store
  useEffect(() => {
      if (!isLoaded || !activeId) return;

      const dateStr = format(simulationDate, 'yyyy-MM-dd');

      // Only update store if it's different to prevent loops
      if (store.scenarios[activeId].data.globals.currentModelDate !== dateStr) {
           setStore(prev => {
              const newData = cloneDeep(prev);
              newData.scenarios[activeId].data.globals.currentModelDate = dateStr;
              return newData;
           });
      }
  }, [simulationDate, activeId, isLoaded]);


  // --- PROFILE HELPERS ---
  const saveProfile = (type, name, dataToSave) => {
    setStore(prev => {
      const newData = cloneDeep(prev);
      const id = getActiveId(newData);
      const newProfileId = `prof_${Date.now()}`;
      if (!newData.profiles) newData.profiles = {};
      newData.profiles[newProfileId] = {
        id: newProfileId, name, type, data: cloneDeep(dataToSave), created: new Date().toISOString()
      };
      const t = newData.scenarios[id].data.globals.timing;
      const defaultDate = `${t.startYear}-${String(t.startMonth).padStart(2, '0')}-01`;
      if(!newData.scenarios[id].data[type].profileSequence) newData.scenarios[id].data[type].profileSequence = [];
      newData.scenarios[id].data[type].profileSequence.push({ profileId: newProfileId, startDate: defaultDate, isActive: true });
      newData.scenarios[id].data[type].profileSequence.sort((a,b) => new Date(a.startDate) - new Date(b.startDate));
      return newData;
    });
  };
  const updateProfile = (profileId, dataToSave) => {
    setStore(prev => {
      const newData = cloneDeep(prev);
      if (newData.profiles[profileId]) newData.profiles[profileId].data = cloneDeep(dataToSave);
      return newData;
    });
  };
  const renameProfile = (profileId, newName) => {
    setStore(prev => {
      const newData = cloneDeep(prev);
      if (newData.profiles[profileId]) newData.profiles[profileId].name = newName;
      return newData;
    });
  };
  const deleteProfile = (profileId) => {
    setStore(prev => {
      const newData = cloneDeep(prev);
      delete newData.profiles[profileId];
      Object.values(newData.scenarios).forEach(scen => {
         ['income', 'expenses'].forEach(type => {
             if (scen.data[type]?.profileSequence) {
                 scen.data[type].profileSequence = scen.data[type].profileSequence.filter(p => p.profileId !== profileId);
             }
         });
      });
      return newData;
    });
  };
  const toggleProfileInScenario = (type, profileId, isActive, dateStr) => {
      setStore(prev => {
          const newData = cloneDeep(prev);
          const id = getActiveId(newData);
          const sequence = newData.scenarios[id].data[type].profileSequence;
          const existingIdx = sequence.findIndex(p => p.profileId === profileId);
          if (existingIdx > -1) {
              sequence[existingIdx].isActive = isActive;
              if (dateStr) sequence[existingIdx].startDate = dateStr;
          } else {
               const t = newData.scenarios[id].data.globals.timing;
               const defaultDate = `${t.startYear}-${String(t.startMonth).padStart(2, '0')}-01`;
               sequence.push({ profileId, startDate: dateStr || defaultDate, isActive });
          }
          newData.scenarios[id].data[type].profileSequence.sort((a,b) => new Date(a.startDate) - new Date(b.startDate));
          return newData;
      });
  };
  const importProfileFromScenario = (targetModule, sourceScenarioId, sourceProfileId) => {
      setStore(prev => {
          const newData = cloneDeep(prev);
          const id = getActiveId(newData);
          const sourceProfile = newData.profiles[sourceProfileId];
          if (!sourceProfile) return prev;
          const newProfileId = `prof_${Date.now()}_copy`;
          newData.profiles[newProfileId] = {
              ...cloneDeep(sourceProfile), id: newProfileId, name: `${sourceProfile.name} (Imported)`, created: new Date().toISOString()
          };
          const t = newData.scenarios[id].data.globals.timing;
          const defaultDate = `${t.startYear}-${String(t.startMonth).padStart(2, '0')}-01`;
          if(!newData.scenarios[id].data[targetModule].profileSequence) newData.scenarios[id].data[targetModule].profileSequence = [];
          newData.scenarios[id].data[targetModule].profileSequence.push({ profileId: newProfileId, startDate: defaultDate, isActive: true });
          return newData;
      });
  };

  // --- LOAN ACTIONS ---
  const addLoan = () => {
      setStore(prev => {
        const newData = cloneDeep(prev);
        const id = getActiveId(newData);
        const newLoanId = `loan_${Date.now()}`;
        if (!newData.scenarios[id].data.loans) newData.scenarios[id].data.loans = {};
        newData.scenarios[id].data.loans[newLoanId] = {
            id: newLoanId, name: "New Loan", type: "fixed", active: true,
            inputs: { principal: 10000, rate: 0.05, payment: 200, startDate: new Date().toISOString().slice(0, 10), termMonths: 60 },
            activeStrategyId: "base", strategies: { base: { name: "Minimum Payment", extraPayments: {} } }
        };
        return newData;
      });
  };
  const deleteLoan = (lid) => {
    setStore(prev => {
        const newData = cloneDeep(prev);
        const id = getActiveId(newData);
        if (newData.scenarios[id].data.loans) delete newData.scenarios[id].data.loans[lid];
        return newData;
    });
  };
  const batchUpdateLoanPayments = (lid, sid, updates) => {
      setStore(prev => {
        const newData = cloneDeep(prev);
        const id = getActiveId(newData);
        const target = newData.scenarios[id]?.data?.loans?.[lid]?.strategies?.[sid]?.extraPayments;
        if (target) Object.entries(updates).forEach(([k,v]) => v <= 0 ? delete target[k] : target[k] = v);
        return newData;
    });
  };
  const addLoanStrategy = (lid, name) => {
      setStore(prev => {
          const newData = cloneDeep(prev);
          const id = getActiveId(newData);
          const sid = `strat_${Date.now()}`;
          const loan = newData.scenarios[id]?.data?.loans?.[lid];
          if (loan) loan.strategies[sid] = { name, extraPayments: {} };
          return newData;
      });
  };
  const duplicateLoanStrategy = (lid, sourceSid, newName) => {
      setStore(prev => {
          const newData = cloneDeep(prev);
          const id = getActiveId(newData);
          const loan = newData.scenarios[id]?.data?.loans?.[lid];
          if (loan && loan.strategies[sourceSid]) {
              const newSid = `strat_${Date.now()}`;
              loan.strategies[newSid] = { ...cloneDeep(loan.strategies[sourceSid]), name: newName };
          }
          return newData;
      });
  };
  const renameLoanStrategy = (lid, sid, newName) => {
      setStore(prev => {
          const newData = cloneDeep(prev);
          const id = getActiveId(newData);
          const loan = newData.scenarios[id]?.data?.loans?.[lid];
          if (loan && loan.strategies[sid]) loan.strategies[sid].name = newName;
          return newData;
      });
  };
  const deleteLoanStrategy = (lid, sid) => {
      setStore(prev => {
          const newData = cloneDeep(prev);
          const id = getActiveId(newData);
          const loan = newData.scenarios[id]?.data?.loans?.[lid];
          if (loan) {
              const keys = Object.keys(loan.strategies);
              if(keys.length <= 1) { alert("Cannot delete the only remaining profile."); return prev; }
              delete loan.strategies[sid];
              if (loan.activeStrategyId === sid) loan.activeStrategyId = Object.keys(loan.strategies)[0];
          }
          return newData;
      });
  };

  const saveAll = () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
      console.log("Manual Save Triggered");
      return true;
  };

  const resetData = () => {
      if(confirm("Factory Reset: This will wipe all local changes and reload hgv_data.json. Continue?")) {
          localStorage.removeItem(STORAGE_KEY);
          window.location.reload();
      }
  };

  return (
    <DataContext.Provider value={{
      store, activeScenario, simulationDate, isLoaded,
      actions: {
        switchScenario, createScenario, createBlankScenario, renameScenario, deleteScenario, resetActiveScenario,
        loadFromFile, importToActive, importAsNew,
        updateScenarioData, updateScenarioDate, setSimulationMonth,
        saveProfile, updateProfile, renameProfile, deleteProfile, toggleProfileInScenario, importProfileFromScenario,
        addLoan, deleteLoan, addLoanStrategy, duplicateLoanStrategy, renameLoanStrategy, deleteLoanStrategy, batchUpdateLoanPayments,
        saveAll, resetData
      }
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => useContext(DataContext);