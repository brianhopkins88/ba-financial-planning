{
type: "file",
fileName: "src/context/DataContext.jsx",
fullContent: `import React, { createContext, useContext, useState, useEffect } from 'react';
import initialData from '../data/hgv_data.json';
import { cloneDeep, set } from 'lodash';
import { format, parseISO, isValid } from 'date-fns';

const DataContext = createContext();

const STORAGE_KEY = 'ba_financial_planner_v1';

export const DataProvider = ({ children }) => {

  // --- 1. ROBUST LOADER & MIGRATION ---
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

    // --- MIGRATION: v0.7 Flat Assets -> v0.8 Account Registry ---
    Object.values(data.scenarios).forEach(scen => {
        // Polyfills for basic structure
        if (!scen.data.globals) scen.data.globals = {};
        if (!scen.data.globals.timing) scen.data.globals.timing = { startYear: 2026, startMonth: 1 };
        if (!scen.data.expenses) scen.data.expenses = { bills: [], home: [], living: [] };
        if (!scen.data.income) scen.data.income = { brian: {}, andrea: {} };

        // ASSET MIGRATION
        if (!scen.data.assets.accounts) {
            console.log(\`Migrating Scenario \${scen.name} to Asset Registry...\`);
            scen.data.assets.accounts = {};
            const oldAssets = scen.data.assets;

            // 1. Joint
            if (oldAssets.joint) {
                const id = \`acct_joint_\${Date.now()}\`;
                scen.data.assets.accounts[id] = {
                    id, type: 'joint', name: 'Joint Investment', balance: oldAssets.joint,
                    owner: 'joint', notes: 'Migrated from v0.7'
                };
            }

            // 2. Inherited IRA
            if (oldAssets.inheritedIRA) {
                const id = \`acct_inherited_\${Date.now()}\`;
                scen.data.assets.accounts[id] = {
                    id, type: 'inherited', name: 'Inherited IRA', balance: oldAssets.inheritedIRA,
                    owner: 'brian', inputs: { endDate: '2035-12-31' }, notes: 'Migrated from v0.7'
                };
            }

            // 3. Retirement (401k)
            if (oldAssets.retirement401k) {
                 const id = \`acct_401k_\${Date.now()}\`;
                 scen.data.assets.accounts[id] = {
                     id, type: 'retirement', name: 'Combined 401k', balance: oldAssets.retirement401k,
                     owner: 'joint', notes: 'Migrated from v0.7'
                 };
            }

            // 4. Property
            if (oldAssets.homeValue) {
                const id = \`acct_prop_\${Date.now()}\`;
                scen.data.assets.accounts[id] = {
                    id, type: 'property', name: 'Primary Home', balance: oldAssets.homeValue,
                    owner: 'joint', inputs: { buildYear: 2018, zipCode: '92029' }, notes: 'Migrated from v0.7'
                };
            }
        }
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

  // --- 3. ACCESSORS ---
  const getActiveId = (currentStore = store) => {
      const id = currentStore.meta?.activeScenarioId;
      if (currentStore.scenarios && currentStore.scenarios[id]) return id;
      return Object.keys(currentStore.scenarios)[0];
  };

  const activeId = getActiveId();
  const activeScenario = store.scenarios[activeId];
  const simulationDateState = useState(() => {
      const savedDateStr = activeScenario.data.globals.currentModelDate;
      return (savedDateStr && isValid(parseISO(savedDateStr))) ? parseISO(savedDateStr) : new Date(2026, 0, 1);
  });
  const [simulationDate, setSimulationDate] = simulationDateState;

  // Sync date when scenario changes
  useEffect(() => {
      const savedDateStr = activeScenario.data.globals.currentModelDate;
      if (savedDateStr) {
          const parsed = parseISO(savedDateStr);
          if (isValid(parsed)) setSimulationDate(parsed);
      } else {
          setSimulationDate(new Date(2026, 0, 1));
      }
  }, [activeId]);

  // Sync date to store for persistence
  useEffect(() => {
      if (!isLoaded || !activeId) return;
      const dateStr = format(simulationDate, 'yyyy-MM-dd');
      if (store.scenarios[activeId].data.globals.currentModelDate !== dateStr) {
           setStore(prev => {
              const newData = cloneDeep(prev);
              newData.scenarios[activeId].data.globals.currentModelDate = dateStr;
              return newData;
           });
      }
  }, [simulationDate, activeId, isLoaded]);


  // --- ACTIONS ---

  const switchScenario = (id) => setStore(p => ({ ...p, meta: { ...p.meta, activeScenarioId: id } }));
  const updateScenarioData = (path, value) => {
    setStore(prev => {
      const newData = cloneDeep(prev);
      const id = getActiveId(newData);
      set(newData.scenarios[id].data, path, value);
      newData.scenarios[id].lastUpdated = new Date().toISOString();
      return newData;
    });
  };
  const updateScenarioDate = (y, m) => {
      updateScenarioData('globals.timing', { startYear: parseInt(y), startMonth: parseInt(m) });
  };
  const setSimulationMonth = (val) => setSimulationDate(val);
  const saveAll = () => { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); return true; };

  // --- ASSET ACTIONS ---
  const addAsset = (type) => {
      setStore(prev => {
          const newData = cloneDeep(prev);
          const id = getActiveId(newData);
          const newId = \`acct_\${Date.now()}\`;
          if (!newData.scenarios[id].data.assets.accounts) newData.scenarios[id].data.assets.accounts = {};

          const defaults = {
              id: newId, type, name: "New Account", balance: 0, owner: 'joint', active: true,
              inputs: {}
          };
          if (type === 'property') defaults.inputs = { buildYear: 2020, zipCode: '' };
          if (type === 'inherited') defaults.inputs = { endDate: '2035-12-31' };

          newData.scenarios[id].data.assets.accounts[newId] = defaults;
          return newData;
      });
  };

  const deleteAsset = (assetId) => {
      setStore(prev => {
          const newData = cloneDeep(prev);
          const id = getActiveId(newData);
          if (newData.scenarios[id].data.assets.accounts[assetId]) {
              delete newData.scenarios[id].data.assets.accounts[assetId];
          }
          return newData;
      });
  };

  const createScenario = (name, cloneData) => {
       setStore(prev => {
           const id = getActiveId(prev);
           const newId = \`scen_\${Date.now()}\`;
           const source = cloneData || prev.scenarios[id];
           const newScen = cloneDeep(source);
           newScen.id = newId; newScen.name = name;
           if(newScen.linkedProfiles) delete newScen.linkedProfiles;
           return { ...prev, meta: { ...prev.meta, activeScenarioId: newId }, scenarios: { ...prev.scenarios, [newId]: newScen } };
       });
  };
  const createBlankScenario = (name) => createScenario(name, initialData.scenarios['scen_default']);
  const renameScenario = (id, name) => setStore(p => { const d = cloneDeep(p); if(d.scenarios[id]) d.scenarios[id].name = name; return d; });
  const deleteScenario = (id) => setStore(p => {
      const d = cloneDeep(p);
      if(Object.keys(d.scenarios).length <= 1) return p;
      delete d.scenarios[id];
      if(d.meta.activeScenarioId === id) d.meta.activeScenarioId = Object.keys(d.scenarios)[0];
      return d;
  });

  const fullActions = {
      switchScenario, createScenario, createBlankScenario, renameScenario, deleteScenario,
      updateScenarioData, updateScenarioDate, setSimulationMonth, saveAll,
      addAsset, deleteAsset,
      addLoan: () => {}, deleteLoan: () => {},
  };

  return (
    <DataContext.Provider value={{
      store, activeScenario, simulationDate, isLoaded,
      actions: {
        ...fullActions,
        saveProfile: (t,n,d) => setStore(p => { const c=cloneDeep(p); const id=getActiveId(c); const pid=\`prof_\${Date.now()}\`; if(!c.profiles)c.profiles={}; c.profiles[pid]={id:pid,name:n,type:t,data:cloneDeep(d)}; if(!c.scenarios[id].data[t].profileSequence)c.scenarios[id].data[t].profileSequence=[]; c.scenarios[id].data[t].profileSequence.push({profileId:pid,startDate:'2026-01-01',isActive:true}); return c; }),
        updateProfile: (pid,d) => setStore(p => { const c=cloneDeep(p); if(c.profiles[pid])c.profiles[pid].data=cloneDeep(d); return c; }),
        renameProfile: (pid,n) => setStore(p => { const c=cloneDeep(p); if(c.profiles[pid])c.profiles[pid].name=n; return c; }),
        deleteProfile: (pid) => setStore(p => { const c=cloneDeep(p); delete c.profiles[pid]; return c; }),
        toggleProfileInScenario: (t,pid,act,date) => setStore(p => { const c=cloneDeep(p); const id=getActiveId(c); const seq=c.scenarios[id].data[t].profileSequence; const exist=seq.find(x=>x.profileId===pid); if(exist){ exist.isActive=act; if(date) exist.startDate=date; } else { seq.push({profileId:pid,startDate:date||'2026-01-01',isActive:act}); } return c; }),

        // --- UPDATED ADD LOAN ACTION ---
        addLoan: (overrides = {}) => setStore(p => {
            const c=cloneDeep(p);
            const id=getActiveId(c);
            const lid=\`loan_\${Date.now()}\`;
            if(!c.scenarios[id].data.loans) c.scenarios[id].data.loans={};

            const defaults = {
                id:lid,
                name:"New Loan",
                type:"fixed",
                active:true,
                inputs:{principal:10000,rate:0.05,payment:200,startDate:'2026-01-01',termMonths:360},
                activeStrategyId:'base',
                strategies:{base:{name:'Base',extraPayments:{}}}
            };

            c.scenarios[id].data.loans[lid] = {
                ...defaults,
                ...overrides,
                inputs: { ...defaults.inputs, ...(overrides.inputs || {}) }
            };
            return c;
        }),

        deleteLoan: (lid) => setStore(p => { const c=cloneDeep(p); const id=getActiveId(c); delete c.scenarios[id].data.loans[lid]; return c; }),
        batchUpdateLoanPayments: (lid,sid,u) => setStore(p => { const c=cloneDeep(p); const id=getActiveId(c); const t=c.scenarios[id].data.loans[lid].strategies[sid].extraPayments; Object.entries(u).forEach(([k,v])=>v<=0?delete t[k]:t[k]=v); return c; }),
        addLoanStrategy: (lid,n) => setStore(p => { const c=cloneDeep(p); const id=getActiveId(c); const l=c.scenarios[id].data.loans[lid]; l.strategies[\`strat_\${Date.now()}\`]={name:n,extraPayments:{}}; return c; }),
        renameLoanStrategy: (lid,sid,n) => setStore(p => { const c=cloneDeep(p); const id=getActiveId(c); c.scenarios[id].data.loans[lid].strategies[sid].name=n; return c; }),
        duplicateLoanStrategy: (lid,sid,n) => setStore(p => { const c=cloneDeep(p); const id=getActiveId(c); const l=c.scenarios[id].data.loans[lid]; l.strategies[\`strat_\${Date.now()}\`]={...cloneDeep(l.strategies[sid]),name:n}; return c; }),
        deleteLoanStrategy: (lid,sid) => setStore(p => { const c=cloneDeep(p); const id=getActiveId(c); const l=c.scenarios[id].data.loans[lid]; delete l.strategies[sid]; if(l.activeStrategyId===sid)l.activeStrategyId=Object.keys(l.strategies)[0]; return c; }),
        resetActiveScenario: () => setStore(p => { const c=cloneDeep(p); const id=getActiveId(c); c.scenarios[id].data=cloneDeep(initialData.scenarios['scen_default'].data); return c; }),
        importToActive: (json) => setStore(p => { const c=cloneDeep(p); const id=getActiveId(c); if(json.linkedProfiles) c.profiles = { ...c.profiles, ...json.linkedProfiles }; c.scenarios[id].data=cloneDeep(json.data); return c; }),
        importAsNew: (name, json) => setStore(p => { const c=cloneDeep(p); if(json.linkedProfiles) c.profiles = { ...c.profiles, ...json.linkedProfiles }; const newId=\`scen_\${Date.now()}\`; c.scenarios[newId]={...json, id:newId, name}; c.meta.activeScenarioId=newId; return c; }),
        createBlankScenario: (n) => createBlankScenario(n)
      }
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => useContext(DataContext);`
}