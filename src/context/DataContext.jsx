import React, { createContext, useContext, useState, useEffect } from 'react';
import initialData from '../data/hgv_data.json';
import { cloneDeep, set } from 'lodash';

const DataContext = createContext();

export const DataProvider = ({ children }) => {
  // The 'store' holds the entire JSON tree (meta + scenarios)
  const [store, setStore] = useState(initialData);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => {
      setIsLoaded(true);
      console.log("BA Financial Data Loaded - v8.0");
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // --- HELPERS ---
  const getActiveScenario = () => {
    const activeId = store.meta.activeScenarioId;
    return store.scenarios[activeId];
  };

  // --- ACTIONS ---

  // 1. Switch Scenario
  const switchScenario = (scenarioId) => {
    if (store.scenarios[scenarioId]) {
      setStore(prev => ({
        ...prev,
        meta: { ...prev.meta, activeScenarioId: scenarioId }
      }));
    }
  };

  // 2. Create New Scenario (Clone Active)
  const createScenario = (newName) => {
    setStore(prev => {
      const activeId = prev.meta.activeScenarioId;
      const sourceScenario = prev.scenarios[activeId];

      const newId = `scen_${Date.now()}`;
      const newScenario = cloneDeep(sourceScenario);

      newScenario.id = newId;
      newScenario.name = newName;
      newScenario.created = new Date().toISOString();
      newScenario.lastUpdated = new Date().toISOString();

      return {
        ...prev,
        meta: { ...prev.meta, activeScenarioId: newId },
        scenarios: {
          ...prev.scenarios,
          [newId]: newScenario
        }
      };
    });
  };

  // 3. Update Data (Scoped to Active Scenario)
  // Path should be relative to the scenario data root (e.g., "assets.joint")
  const updateScenarioData = (path, value) => {
    setStore(prev => {
      const newData = cloneDeep(prev);
      const activeId = newData.meta.activeScenarioId;

      // 1. Update the value
      set(newData.scenarios[activeId].data, path, value);

      // 2. Update the timestamp
      newData.scenarios[activeId].lastUpdated = new Date().toISOString();

      return newData;
    });
  };

  // 4. Update Scenario Meta (Rename, etc)
  const updateScenarioMeta = (key, value) => {
    setStore(prev => {
      const newData = cloneDeep(prev);
      const activeId = newData.meta.activeScenarioId;
      newData.scenarios[activeId][key] = value;
      return newData;
    });
  };

  return (
    <DataContext.Provider value={{
      store,               // The full tree (rarely needed directly by views)
      activeScenario: getActiveScenario(), // The currently active data object
      isLoaded,
      actions: {
        switchScenario,
        createScenario,
        updateScenarioData,
        updateScenarioMeta
      }
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => useContext(DataContext);