import React, { createContext, useContext, useState, useEffect } from 'react';
import initialData from '../data/hgv_data.json';
import { cloneDeep, set } from 'lodash';
import { isBefore, isAfter, parseISO, format, addMonths, subMonths } from 'date-fns';

const DataContext = createContext();

export const DataProvider = ({ children }) => {
  // Ensure we have a valid starting structure
  const validInitialData = cloneDeep(initialData);
  const activeId = validInitialData.meta.activeScenarioId;

  // 1. Ensure Global Start Date Exists
  if (!validInitialData.scenarios[activeId].data.globals.timing) {
    validInitialData.scenarios[activeId].data.globals.timing = {
      startYear: 2025,
      startMonth: 11 // Nov
    };
  }

  // 2. Ensure Profile Arrays exist
  ['income', 'expenses'].forEach(type => {
    const module = validInitialData.scenarios[activeId].data[type];
    if (!module.profileSequence) {
        module.profileSequence = [];
        if (module.activeProfileId) {
            module.profileSequence.push({
                profileId: module.activeProfileId,
                startDate: `${validInitialData.scenarios[activeId].data.globals.timing.startYear}-${String(validInitialData.scenarios[activeId].data.globals.timing.startMonth).padStart(2, '0')}-01`,
                isActive: true
            });
        }
    }
  });

  const [store, setStore] = useState(validInitialData);
  const [isLoaded, setIsLoaded] = useState(false);

  // Ephemeral State for the "Current Model Date"
  const startY = validInitialData.scenarios[activeId].data.globals.timing.startYear;
  const startM = validInitialData.scenarios[activeId].data.globals.timing.startMonth;
  const [simulationDate, setSimulationDate] = useState(new Date(startY, startM - 1, 1));

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true);
      console.log("BA Financial Data Loaded - v8.6");
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const getActiveScenario = () => store.scenarios[store.meta.activeScenarioId];

  // --- DATE ACTIONS ---
  const updateScenarioDate = (year, month) => {
    setStore(prev => {
        const newData = cloneDeep(prev);
        const activeId = newData.meta.activeScenarioId;
        newData.scenarios[activeId].data.globals.timing = { startYear: parseInt(year), startMonth: parseInt(month) };
        newData.scenarios[activeId].lastUpdated = new Date().toISOString();
        return newData;
    });
    setSimulationDate(new Date(year, month - 1, 1));
  };

  const setSimulationMonth = (dateObj) => setSimulationDate(dateObj);

  // --- SCENARIO ACTIONS ---
  const switchScenario = (scenarioId) => {
    if (store.scenarios[scenarioId]) {
      setStore(prev => ({
        ...prev,
        meta: { ...prev.meta, activeScenarioId: scenarioId }
      }));
      const timing = store.scenarios[scenarioId].data.globals.timing || { startYear: 2025, startMonth: 1 };
      setSimulationDate(new Date(timing.startYear, timing.startMonth - 1, 1));
    }
  };

  const createScenario = (newName) => {
    setStore(prev => {
      const activeId = prev.meta.activeScenarioId;
      const newId = `scen_${Date.now()}`;
      const newScenario = cloneDeep(prev.scenarios[activeId]);
      newScenario.id = newId;
      newScenario.name = newName;
      newScenario.created = new Date().toISOString();
      newScenario.lastUpdated = new Date().toISOString();

      return {
        ...prev,
        meta: { ...prev.meta, activeScenarioId: newId },
        scenarios: { ...prev.scenarios, [newId]: newScenario }
      };
    });
  };

  const updateScenarioData = (path, value) => {
    setStore(prev => {
      const newData = cloneDeep(prev);
      const activeId = newData.meta.activeScenarioId;
      set(newData.scenarios[activeId].data, path, value);
      newData.scenarios[activeId].lastUpdated = new Date().toISOString();
      return newData;
    });
  };

  // --- PROFILE ACTIONS ---
  const saveProfile = (type, name, dataToSave) => {
    setStore(prev => {
      const activeId = prev.meta.activeScenarioId;
      const newData = cloneDeep(prev);
      const newProfileId = `prof_${Date.now()}`;

      newData.profiles[newProfileId] = {
        id: newProfileId,
        name: name,
        type: type,
        data: cloneDeep(dataToSave),
        created: new Date().toISOString()
      };

      const timing = newData.scenarios[activeId].data.globals.timing;
      const defaultDate = `${timing.startYear}-${String(timing.startMonth).padStart(2, '0')}-01`;

      newData.scenarios[activeId].data[type].profileSequence.push({
          profileId: newProfileId,
          startDate: defaultDate,
          isActive: true
      });
      newData.scenarios[activeId].data[type].profileSequence.sort((a,b) => new Date(a.startDate) - new Date(b.startDate));

      return newData;
    });
  };

  // NEW: Update existing profile data
  const updateProfile = (profileId, dataToSave) => {
    setStore(prev => {
      const newData = cloneDeep(prev);
      if (newData.profiles[profileId]) {
        newData.profiles[profileId].data = cloneDeep(dataToSave);
      }
      return newData;
    });
  };

  const renameProfile = (profileId, newName) => {
    setStore(prev => {
      const newData = cloneDeep(prev);
      if (newData.profiles[profileId]) {
        newData.profiles[profileId].name = newName;
      }
      return newData;
    });
  };

  const deleteProfile = (profileId) => {
    setStore(prev => {
      const newData = cloneDeep(prev);
      const activeId = newData.meta.activeScenarioId;
      delete newData.profiles[profileId];
      ['income', 'expenses'].forEach(type => {
          if (newData.scenarios[activeId].data[type].profileSequence) {
             newData.scenarios[activeId].data[type].profileSequence =
               newData.scenarios[activeId].data[type].profileSequence.filter(p => p.profileId !== profileId);
          }
      });
      return newData;
    });
  };

  const toggleProfileInScenario = (type, profileId, isActive, dateStr) => {
      setStore(prev => {
          const newData = cloneDeep(prev);
          const activeId = newData.meta.activeScenarioId;
          const sequence = newData.scenarios[activeId].data[type].profileSequence;

          const existingIdx = sequence.findIndex(p => p.profileId === profileId);

          if (existingIdx > -1) {
              sequence[existingIdx].isActive = isActive;
              if (dateStr) sequence[existingIdx].startDate = dateStr;
          } else {
               const timing = newData.scenarios[activeId].data.globals.timing;
               const defaultDate = `${timing.startYear}-${String(timing.startMonth).padStart(2, '0')}-01`;
               sequence.push({
                   profileId: profileId,
                   startDate: dateStr || defaultDate,
                   isActive: isActive
               });
          }
          newData.scenarios[activeId].data[type].profileSequence.sort((a,b) => new Date(a.startDate) - new Date(b.startDate));
          return newData;
      });
  };

  const getEffectiveProfileData = (type) => {
      const activeId = store.meta.activeScenarioId;
      const scenario = store.scenarios[activeId];
      const sequence = scenario.data[type].profileSequence || [];

      const activeItems = sequence.filter(item =>
          item.isActive && !isAfter(parseISO(item.startDate), simulationDate)
      );

      if (activeItems.length === 0) {
          return scenario.data[type];
      }

      const effectiveItem = activeItems[activeItems.length - 1];
      const profile = store.profiles[effectiveItem.profileId];
      return profile ? profile.data : scenario.data[type];
  };

  // --- LOAN ACTIONS ---
  const addLoan = () => {
      setStore(prev => {
        const newData = cloneDeep(prev);
        const activeId = newData.meta.activeScenarioId;
        const newLoanId = `loan_${Date.now()}`;
        newData.scenarios[activeId].data.loans[newLoanId] = {
            id: newLoanId, name: "New Loan", type: "fixed", active: true,
            inputs: { principal: 10000, rate: 0.05, payment: 200, startDate: new Date().toISOString().slice(0, 10), termMonths: 60 },
            activeStrategyId: "base", strategies: { base: { name: "Minimum Payment", extraPayments: {} } }
        };
        return newData;
      });
  };
  const deleteLoan = (id) => {
    setStore(prev => {
        const newData = cloneDeep(prev);
        delete newData.scenarios[newData.meta.activeScenarioId].data.loans[id];
        return newData;
    });
  };
  const batchUpdateLoanPayments = (lid, sid, updates) => {
      setStore(prev => {
        const newData = cloneDeep(prev);
        const target = newData.scenarios[newData.meta.activeScenarioId].data.loans[lid].strategies[sid].extraPayments;
        Object.entries(updates).forEach(([k,v]) => v <= 0 ? delete target[k] : target[k] = v);
        return newData;
      });
  };
  const addLoanStrategy = (lid, name) => {
      setStore(prev => {
          const newData = cloneDeep(prev);
          const sid = `strat_${Date.now()}`;
          newData.scenarios[newData.meta.activeScenarioId].data.loans[lid].strategies[sid] = { name, extraPayments: {} };
          return newData;
      });
  };
  const deleteLoanStrategy = (lid, sid) => {
      setStore(prev => {
          const newData = cloneDeep(prev);
          delete newData.scenarios[newData.meta.activeScenarioId].data.loans[lid].strategies[sid];
          return newData;
      });
  };

  return (
    <DataContext.Provider value={{
      store,
      activeScenario: getActiveScenario(),
      simulationDate,
      isLoaded,
      getEffectiveProfileData,
      actions: {
        switchScenario,
        createScenario,
        updateScenarioData,
        updateScenarioDate,
        setSimulationMonth,
        saveProfile,
        updateProfile, // Exported
        renameProfile,
        deleteProfile,
        toggleProfileInScenario,
        addLoan,
        deleteLoan,
        addLoanStrategy,
        deleteLoanStrategy,
        batchUpdateLoanPayments
      }
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => useContext(DataContext);