import React, { useState, useRef } from 'react';
import { useData } from '../context/DataContext';
import { LayoutDashboard, Receipt, Landmark, Settings, Plus, Save, MoreVertical, Upload, FilePlus, Download, RotateCcw, ChevronDown, Copy, Trash2, Pencil, TrendingUp, PiggyBank, RefreshCw } from 'lucide-react';

export default function Sidebar({ currentView, setView }) {
  const { store, activeScenario, actions } = useData();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScenarioListOpen, setIsScenarioListOpen] = useState(false);
  const fileInputRef = useRef(null);
  const [uploadMode, setUploadMode] = useState(null);

  const handleExportScenario = () => {
    const usedProfileIds = new Set();
    activeScenario.data.income?.profileSequence?.forEach(p => usedProfileIds.add(p.profileId));
    activeScenario.data.expenses?.profileSequence?.forEach(p => usedProfileIds.add(p.profileId));
    const linkedProfiles = {};
    usedProfileIds.forEach(id => { if(store.profiles[id]) linkedProfiles[id] = store.profiles[id]; });
    const exportObject = { ...activeScenario, linkedProfiles };
    const blob = new Blob([JSON.stringify(exportObject, null, 2)], { type: "application/json" });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${activeScenario.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link); setIsMenuOpen(false);
  };

  const handleMenuItemClick = (action) => {
      setIsMenuOpen(false);
      if(action === 'save') { actions.saveAll(); alert("Scenario saved."); }
      if(action === 'export') handleExportScenario();
      if(action === 'create_blank') { const n = prompt("Name:"); if(n) actions.createBlankScenario(n); }
      if(action === 'upload_current') { setUploadMode('current'); fileInputRef.current.click(); }
      if(action === 'upload_new') { setUploadMode('new'); fileInputRef.current.click(); }
      if(action === 'clear') {
          if(confirm("Are you sure you want to reset the current scenario to defaults? This will overwrite your changes.")) {
              actions.resetActiveScenario();
          }
      }
  };

  const onFileChange = (e) => {
      const file = e.target.files[0]; if(!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
          try {
              const json = JSON.parse(ev.target.result);
              if(uploadMode === 'current' && confirm("Overwrite?")) actions.importToActive(json);
              if(uploadMode === 'new') { const n = prompt("Name:", json.name); if(n) actions.importAsNew(n, json); }
          } catch(e) { alert("Error parsing JSON"); }
          e.target.value = null;
      };
      reader.readAsText(file);
  };

  const handleScenarioClick = (id) => { actions.switchScenario(id); setIsScenarioListOpen(false); };
  const handleNewScenario = () => { const n = prompt("Name:"); if(n) { actions.createScenario(n); setIsScenarioListOpen(false); } };

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
    <div className="w-64 bg-slate-900 text-slate-300 flex flex-col h-screen flex-shrink-0 relative">
      <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={onFileChange} />

      {/* HEADER */}
      <div className="p-6 border-b border-slate-800 flex justify-between items-center relative z-20">
        <h1 className="text-white font-bold text-lg tracking-tight">BA Planner <span className="text-blue-500">v0.91</span></h1>
        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"><MoreVertical size={20} /></button>
        {isMenuOpen && (
            <>
                <div className="fixed inset-0 z-30" onClick={() => setIsMenuOpen(false)}></div>
                <div className="absolute right-4 top-14 w-64 bg-white rounded-lg shadow-xl z-50 py-2 border border-slate-200 text-slate-700">
                    <button onClick={() => handleMenuItemClick('save')} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-sm"><Save size={14} className="text-blue-600"/> Save Changes</button>
                    <button onClick={() => handleMenuItemClick('export')} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-sm"><Download size={14} className="text-green-600"/> Export Data</button>
                    <div className="h-px bg-slate-100 my-1"></div>
                    <button onClick={() => handleMenuItemClick('upload_current')} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-sm"><Upload size={14} className="text-orange-500"/> Upload to Current</button>
                    <button onClick={() => handleMenuItemClick('upload_new')} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-sm"><FilePlus size={14} className="text-purple-600"/> Upload as New</button>
                    <div className="h-px bg-slate-100 my-1"></div>
                    <button onClick={() => handleMenuItemClick('create_blank')} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-sm"><Plus size={14} className="text-slate-600"/> Create Blank</button>
                    <button onClick={() => handleMenuItemClick('clear')} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-sm text-red-600 hover:bg-red-50"><RefreshCw size={14}/> Reset to Defaults</button>
                </div>
            </>
        )}
      </div>

      {/* SCENARIO SELECTOR */}
      <div className="p-4 border-b border-slate-800 space-y-3 relative z-10">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Scenario</div>
        <div className="relative">
            <button onClick={() => setIsScenarioListOpen(!isScenarioListOpen)} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white flex justify-between items-center hover:bg-slate-700">
                <span className="truncate">{activeScenario.name}</span><ChevronDown size={14} className="text-slate-400"/>
            </button>
            {isScenarioListOpen && (
                <>
                    <div className="fixed inset-0 z-30" onClick={() => setIsScenarioListOpen(false)}></div>
                    <div className="absolute left-0 top-full mt-1 w-full bg-slate-800 rounded-lg shadow-xl border border-slate-700 z-50 overflow-hidden">
                        <div className="max-h-64 overflow-y-auto">
                            {Object.values(store.scenarios).map(scen => (
                                <div key={scen.id} className="p-2 hover:bg-slate-700 cursor-pointer border-b border-slate-700/50" onClick={() => handleScenarioClick(scen.id)}>
                                    <span className="text-sm text-slate-300">{scen.name}</span>
                                </div>
                            ))}
                        </div>
                        <button onClick={handleNewScenario} className="w-full p-2 bg-slate-900/50 text-xs text-slate-400 hover:text-blue-400 border-t border-slate-700 flex items-center justify-center gap-1 font-bold uppercase"><Plus size={12}/> Create New</button>
                    </div>
                </>
            )}
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 px-3">Modules</div>
        <NavItem id="dashboard" label="Dashboard" icon={LayoutDashboard} />
        <NavItem id="income" label="Income & Work" icon={TrendingUp} />
        <NavItem id="expenses" label="Expenses" icon={Receipt} />
        <NavItem id="loans" label="Loans & Debt" icon={Landmark} />
        <NavItem id="assets" label="Assets & Property" icon={PiggyBank} />
        <NavItem id="assumptions" label="Assumptions" icon={Settings} />
      </nav>

      <div className="p-4 border-t border-slate-800 text-xs text-slate-600">
        Last Updated:<br/><span className="text-slate-500 font-mono">{new Date(activeScenario.lastUpdated).toLocaleDateString()}</span>
      </div>
    </div>
  );
}