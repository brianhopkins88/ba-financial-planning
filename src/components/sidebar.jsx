import React from 'react';
import { useData } from '../context/DataContext';
import { LayoutDashboard, Receipt, Landmark, Settings, Plus, Save, TrendingUp } from 'lucide-react';

export default function Sidebar({ currentView, setView }) {
  const { store, activeScenario, actions } = useData();
  const handleScenarioChange = (e) => actions.switchScenario(e.target.value);

  const handleNewScenario = () => {
    const name = prompt("Name for new scenario:", "New Scenario");
    if (name) actions.createScenario(name);
  };
  const handleSaveScenario = () => {
    const name = prompt("Save Snapshot as:", `${activeScenario.name} (Saved)`);
    if(name) actions.createScenario(name);
  };

  const NavItem = ({ id, label, icon: Icon }) => (
    <button
      onClick={() => setView(id)}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
        currentView === id ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
      }`}
    >
      <Icon size={18} />
      <span className="font-medium text-sm">{label}</span>
    </button>
  );

  return (
    <div className="w-64 bg-slate-900 text-slate-300 flex flex-col h-screen flex-shrink-0">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-white font-bold text-lg tracking-tight">BA Planner <span className="text-blue-500">v8.6</span></h1>
      </div>

      <div className="p-4 border-b border-slate-800 space-y-3">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Scenario</div>
        <div className="relative">
          <select value={activeScenario.id} onChange={handleScenarioChange}
            className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer">
            {Object.values(store.scenarios).map(scen => (
              <option key={scen.id} value={scen.id}>{scen.name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
            <button onClick={handleNewScenario} className="flex items-center justify-center gap-2 text-xs bg-slate-800 hover:bg-slate-700 py-2 rounded text-slate-400 transition-colors">
              <Plus size={14} /> New
            </button>
            <button onClick={handleSaveScenario} className="flex items-center justify-center gap-2 text-xs bg-blue-900/30 hover:bg-blue-900/50 text-blue-400 border border-blue-900/50 py-2 rounded transition-colors">
              <Save size={14} /> Save
            </button>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 px-3">Modules</div>
        <NavItem id="dashboard" label="Dashboard" icon={LayoutDashboard} />
        <NavItem id="income" label="Income & Work" icon={TrendingUp} />
        <NavItem id="expenses" label="Expenses" icon={Receipt} />
        <NavItem id="loans" label="Loans & Debt" icon={Landmark} />
        <NavItem id="assumptions" label="Assumptions" icon={Settings} />
      </nav>

      <div className="p-4 border-t border-slate-800 text-xs text-slate-600">
        Data Last Updated:<br/>
        <span className="text-slate-500 font-mono">{new Date(activeScenario.lastUpdated).toLocaleDateString()}</span>
      </div>
    </div>
  );
}