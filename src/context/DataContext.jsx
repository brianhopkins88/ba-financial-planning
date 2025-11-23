import React, { createContext, useContext, useState, useEffect } from 'react';
import initialData from '../data/hgv_data.json';
import { cloneDeep, set, unset } from 'lodash';

const DataContext = createContext();

export const DataProvider = ({ children }) => {
  const [store, setStore] = useState(initialData);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true);
      console.log("BA Financial Data Loaded - v8.1");
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const getActiveScenario = () => {
    const activeId = store.meta.activeScenarioId;
    return store.scenarios[activeId];
  };

  // --- ACTIONS ---

  const switchScenario = (scenarioId) => {
    if (store.scenarios[scenarioId]) {
      setStore(prev => ({
        ...prev,
        meta: { ...prev.meta, activeScenarioId: scenarioId }
      }));
    }
  };

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

  // --- LOAN MANAGEMENT ACTIONS ---

  const addLoan = () => {
    setStore(prev => {
      const newData = cloneDeep(prev);
      const activeId = newData.meta.activeScenarioId;
      const newLoanId = `loan_${Date.now()}`;

      const newLoan = {
        id: newLoanId,
        name: "New Loan",
        type: "fixed",
        inputs: {
          principal: 10000,
          rate: 0.05,
          payment: 200,
          startDate: new Date().toISOString().slice(0, 10),
          termMonths: 60
        },
        activeStrategyId: "base",
        strategies: {
          base: { name: "Minimum Payment", extraPayments: {} }
        }
      };

      newData.scenarios[activeId].data.loans[newLoanId] = newLoan;
      newData.scenarios[activeId].lastUpdated = new Date().toISOString();
      return newData;
    });
  };

  const deleteLoan = (loanId) => {
    setStore(prev => {
      const newData = cloneDeep(prev);
      const activeId = newData.meta.activeScenarioId;
      delete newData.scenarios[activeId].data.loans[loanId];
      newData.scenarios[activeId].lastUpdated = new Date().toISOString();
      return newData;
    });
  };

  // --- STRATEGY ACTIONS ---

  const addLoanStrategy = (loanId, name) => {
    setStore(prev => {
      const newData = cloneDeep(prev);
      const activeId = newData.meta.activeScenarioId;
      const stratId = `strat_${Date.now()}`;
      const newStrat = { name: name, extraPayments: {} };

      newData.scenarios[activeId].data.loans[loanId].strategies[stratId] = newStrat;
      newData.scenarios[activeId].data.loans[loanId].activeStrategyId = stratId;

      newData.scenarios[activeId].lastUpdated = new Date().toISOString();
      return newData;
    });
  };

  const deleteLoanStrategy = (loanId, stratId) => {
    setStore(prev => {
      const newData = cloneDeep(prev);
      const activeId = newData.meta.activeScenarioId;
      const loan = newData.scenarios[activeId].data.loans[loanId];

      if (stratId === 'base') return prev;

      delete loan.strategies[stratId];

      if (loan.activeStrategyId === stratId) {
        loan.activeStrategyId = 'base';
      }

      newData.scenarios[activeId].lastUpdated = new Date().toISOString();
      return newData;
    });
  };

  // NEW: BATCH UPDATE (For Drag-and-Fill)
  const batchUpdateLoanPayments = (loanId, stratId, updates) => {
    setStore(prev => {
      const newData = cloneDeep(prev);
      const activeId = newData.meta.activeScenarioId;
      const targetMap = newData.scenarios[activeId].data.loans[loanId].strategies[stratId].extraPayments;

      // updates is object: { "2026-01": 500, "2026-02": 500 }
      Object.entries(updates).forEach(([dateKey, value]) => {
        if (value <= 0) delete targetMap[dateKey];
        else targetMap[dateKey] = value;
      });

      newData.scenarios[activeId].lastUpdated = new Date().toISOString();
      return newData;
    });
  };

  return (
    <DataContext.Provider value={{
      store,
      activeScenario: getActiveScenario(),
      isLoaded,
      actions: {
        switchScenario,
        createScenario,
        updateScenarioData,
        addLoan,
        deleteLoan,
        addLoanStrategy,
        deleteLoanStrategy,
        batchUpdateLoanPayments // Exported here
      }
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => useContext(DataContext);