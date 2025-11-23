import React, { useState } from 'react';
import { DataProvider, useData } from './context/DataContext';
import { LayoutDashboard, Home, Banknote, PieChart, Settings, PlusCircle, Copy } from 'lucide-react';
import Assumptions from './views/assumptions';

// --- DASHBOARD (Placeholder for Phase 2) ---
const Dashboard = () => {
  const { activeScenario } = useData();
  const d = activeScenario.data;

  // Quick calc for verification (Safe access in case fields are missing)
  const safeVal = (val) => val || 0;

  // Net Worth = (Assets) - (Liabilities)
  // Note: Adjust paths based on your specific JSON structure in V8
  const assets = safeVal(d.assets.joint) + safeVal(d.assets.retirement401k) + safeVal(d.assets.inheritedIRA) + safeVal(d.assets.homeValue);
  const liabilities = safeVal(d.loans?.mortgage?.inputs?.principal) + safeVal(d.loans?.heloc?.inputs?.balance);
  const netWorth = assets - liabilities;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-slate-800">Financial Overview</h2>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <div className="text-sm text-slate-500 font-medium uppercase tracking-wider">Net Worth</div>
          <div className="text-3xl font-bold text-slate-800 mt-2">
            ${netWorth.toLocaleString()}
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <div className="text-sm text-slate-500 font-medium uppercase tracking-wider">Liquidity (Joint)</div>
          <div className="text-3xl font-bold text-blue-600 mt-2">
             ${safeVal(d.assets.joint).toLocaleString()}
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <div className="text-sm text-slate-500 font-medium uppercase tracking-wider">Active Scenario</div>
          <div className="text-lg font-bold text-slate-700 mt-3 truncate">
            {activeScenario.name}
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <div className="text-blue-500 mt-1">ℹ️</div>
        <div className="text-sm text-blue-800">
          <span className="font-bold">System Ready (v8.0):</span> You are viewing the <strong>{activeScenario.name}</strong> scenario.
          <br/>
          Use the <strong>Assumptions</strong> tab to modify inputs. Changes are saved automatically to this scenario.
        </div>
      </div>
    </div>
  );
};

// --- SIDEBAR (With Scenario Selector) ---
const Sidebar = ({ activeTab, setActiveTab }) => {
  const { store, activeScenario, actions } = useData();

  const menu = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'assumptions', label: 'Assumptions', icon: Settings }, // Refactored
    { id: 'loans', label: 'Loans & Debt', icon: Home }, // New
    { id: 'expenses', label: 'Expenses', icon: Banknote }, // New
    { id: 'strategies', label: 'Strategies', icon: PieChart },
  ];

  return (
    <div className="w-64 bg-slate-900 text-white h-screen flex flex-col shadow-xl flex-shrink-0">
      {/* App Header */}
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-xl font-bold text-blue-400 tracking-tight">BA Financial</h1>
        <div className="text-xs text-slate-500 mt-1">Planning Modeler v8.0</div>
      </div>

      {/* Scenario Manager */}
      <div className="px-4 py-4 bg-slate-800 border-b border-slate-700">
        <label className="text-xs text-slate-400 font-semibold uppercase mb-2 block flex justify-between">
          <span>Scenario</span>
          <span className="text-slate-500 font-normal">Switch / Create</span>
        </label>

        {/* Dropdown */}
        <div className="relative mb-3">
          <select
            className="w-full bg-slate-900 border border-slate-600 text-sm rounded px-2 py-2 text-slate-200 focus:ring-1 focus:ring-blue-500 outline-none appearance-none"
            value={activeScenario.id}
            onChange={(e) => actions.switchScenario(e.target.value)}
          >
            {Object.values(store.scenarios).map(scen => (
              <option key={scen.id} value={scen.id}>
                {scen.name}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-2.5 pointer-events-none text-slate-400">
            <Settings size={14} />
          </div>
        </div>

        {/* New Scenario Action */}
        <button
          onClick={() => {
            const name = prompt("Name for new scenario:", `Clone of ${activeScenario.name}`);
            if (name) actions.createScenario(name);
          }}
          className="w-full flex items-center justify-center gap-2 text-xs bg-blue-700 hover:bg-blue-600 py-2 rounded text-white transition-colors border border-blue-600"
        >
          <PlusCircle size={14} /> Clone to New Scenario
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {menu.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
              activeTab === item.id
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <item.icon size={20} />
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          Online
        </div>
      </div>
    </div>
  );
};

// --- MAIN LAYOUT ---
const MainContent = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { isLoaded, activeScenario } = useData();

  if (!isLoaded) return (
    <div className="flex items-center justify-center h-screen w-full bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <div className="text-slate-400 font-medium">Loading Financial Engine...</div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 overflow-auto relative">
        {/* Top Header */}
        <header className="bg-white h-16 border-b border-slate-200 flex items-center px-8 justify-between sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-slate-700 capitalize">
              {activeTab.replace(/([A-Z])/g, ' $1').trim()}
            </h2>
            <span className="px-3 py-1 bg-slate-100 rounded-full text-xs text-slate-500 font-medium border border-slate-200">
              {activeScenario.name}
            </span>
          </div>
          <div className="text-xs text-slate-500 text-right">
            <div>Data as of</div>
            <div className="font-mono font-medium text-slate-700">
              {new Date(activeScenario.lastUpdated).toLocaleString()}
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="min-h-[calc(100vh-4rem)]">
          {activeTab === 'dashboard' && <Dashboard />}

          {activeTab === 'assumptions' && <Assumptions />}

          {/* Placeholders for Future Modules */}
          {['loans', 'expenses', 'strategies'].includes(activeTab) && (
            <div className="flex flex-col items-center justify-center h-[70vh] text-slate-400">
              <div className="p-4 bg-white rounded-full shadow-sm mb-4">
                <Settings size={48} className="text-slate-200" />
              </div>
              <h3 className="text-lg font-semibold text-slate-600">Module Under Construction</h3>
              <p className="text-sm mt-2">The <strong>{activeTab}</strong> engine is coming in Phase 2.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default function App() {
  return (
    <DataProvider>
      <MainContent />
    </DataProvider>
  );
}