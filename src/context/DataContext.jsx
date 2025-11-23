import React, { createContext, useContext, useState, useEffect } from 'react';
import initialData from '../data/hgv_data.json';
import { cloneDeep, set } from 'lodash';

const DataContext = createContext();

export const DataProvider = ({ children }) => {
  const [data, setData] = useState(initialData);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // We simulate a short load time to ensure the UI mounts cleanly
    // In a real app, this might be an API call
    const timer = setTimeout(() => {
      setIsLoaded(true);
      console.log("BA Financial Data Loaded:", data.meta.scenario);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // --- CORE LOGIC: Update any field in the JSON tree ---
  const updateData = (path, value) => {
    setData(prevData => {
      // 1. Create a deep copy so we don't mutate state directly
      const newData = cloneDeep(prevData);

      // 2. Update the specific field using lodash.set
      // path example: "loans.heloc.extraPayments.2026-03"
      set(newData, path, value);

      return newData;
    });
  };

  // --- SNAPSHOT LOGIC: Time Travel ---
  const saveSnapshot = (name) => {
    const snapshot = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      name: name || `Snapshot ${new Date().toLocaleTimeString()}`,
      data: cloneDeep(data)
    };

    setData(prev => ({
      ...prev,
      history: [...(prev.history || []), snapshot]
    }));

    console.log("Snapshot Saved:", snapshot.name);
  };

  const loadSnapshot = (snapshot) => {
    setData(cloneDeep(snapshot.data));
    console.log("Snapshot Restored:", snapshot.name);
  };

  return (
    <DataContext.Provider value={{
      data,
      isLoaded,
      updateData,
      saveSnapshot,
      loadSnapshot
    }}>
      {children}
    </DataContext.Provider>
  );
};

// Hook to easily use this context in other components
export const useData = () => useContext(DataContext);