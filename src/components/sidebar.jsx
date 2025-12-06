import React, { useState, useRef } from 'react';
import { useData } from '../context/DataContext';
import { generateAIExport } from '../utils/ai_export_utils';
import { LayoutDashboard, Receipt, Landmark, Settings, Plus, Save, MoreVertical, Upload, Download, RotateCcw, ChevronDown, Wallet, Database, Copy, Trash2, Pencil, Briefcase } from 'lucide-react';

export default function Sidebar({ currentView, setView }) {
  const { store, activeScenario, actions } = useData();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScenarioListOpen, setIsScenarioListOpen] = useState(false);
  const fileInputRef = useRef(null);

  const handleExportFull = () => {
    const jsonString = generateAIExport(store);
    const blob = new Blob([jsonString], { type: "application/json" });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ba_planner_full_export_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    setIsMenuOpen(false);
  };

  const handleSaveAs = () => {
      const n = prompt("Save Current Scenario As (New Name):", `${activeScenario.name} (Copy)`);
      if(n) actions.createScenario(n);
      setIsMenuOpen(false);
  };

  const handleMenuItemClick = (action) => {
      setIsMenuOpen(false);
      if(action === 'save') { actions.saveAll(); alert("Session saved locally."); }
      if(action === 'save_as') handleSaveAs();
      if(action === 'export') handleExportFull();
      if(action === 'create_blank') { const n = prompt("Name:"); if(n) actions.createBlankScenario(n); }
      if(action === 'upload') { fileInputRef.current.click(); }
      if(action === 'clear') {
          if(confirm("Are you sure you want to reset to the default Example Scenario? This will wipe your local changes.")) {
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

              const choice = prompt(
                  "Import Options:\n" +
                  "1. Type 'new' to create a NEW Scenario (Recommended)\n" +
                  "2. Type 'overwrite' to replace the CURRENT Active Scenario",
                  "new"
              );

              if (choice) {
                  const mode = choice.toLowerCase().includes('over') ? 'overwrite_active' : 'new';
                  actions.importData(json, mode);
                  alert(`Import Successful (${mode === 'new' ? 'Created New Scenario' : 'Overwrote Active Scenario'})`);
              }
          } catch(e) {
              console.error(e);
              alert("Error parsing JSON.");
          }
          e.target.value = null;
      };
      reader.readAsText(file);
  };

  const handleScenarioClick = (id) => { actions.switchScenario(id); setIsScenarioListOpen(false); };
  const handleNewScenario = () => { const n = prompt("Name:"); if(n) { actions.createScenario(n); setIsScenarioListOpen(false); } };

  const handleRenameActive = () => {
      const n = prompt("Rename Scenario:", activeScenario.name);
      if(n) actions.renameScenario(activeScenario.id, n);
  };

  const handleDeleteActive = () => {
      if(confirm(`Delete "${activeScenario.name}"?`)) actions.deleteScenario(activeScenario.id);
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
    <div className="w-64 bg-slate-900 text-slate-300 flex flex-col h-screen flex-shrink-0 relative">
      <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={onFileChange} />

      {/* HEADER */}
      <div className="p-6 border-b border-slate-800 flex justify-between items-center relative z-20">
        <h1 className="text-white font-bold text-lg tracking-tight">BA Planner <span className="text-blue-500">v1.3</span></h1>
        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"><MoreVertical size={20} /></button>
        {isMenuOpen && (
            <>
                <div className="fixed inset-0 z-30" onClick={() => setIsMenuOpen(false)}></div>
                <div className="absolute right-4 top-14 w-64 bg-white rounded-lg shadow-xl z-50 py-2 border border-slate-200 text-slate-700">
                    <button onClick={() => handleMenuItemClick('save')} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-sm"><Save size={14} className="text-blue-600"/> Save Session</button>
                    <button onClick={() => handleMenuItemClick('save_as')} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-sm"><Copy size={14} className="text-blue-400"/> Save Scenario As...</button>
                    <button onClick={() => handleMenuItemClick('export')} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-sm"><Download size={14} className="text-green-600"/> Export AI Data</button>
                    <button onClick={() => handleMenuItemClick('upload')} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-sm"><Upload size={14} className="text-orange-500"/> Import / Restore</button>
                    <div className="h-px bg-slate-100 my-1"></div>
                    <button onClick={() => handleMenuItemClick('create_blank')} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-sm"><Plus size={14} className="text-slate-600"/> Create Blank Scenario</button>
                    <button onClick={() => handleMenuItemClick('clear')} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-sm text-red-600 hover:bg-red-50"><RotateCcw size={14}/> Reset to Defaults</button>
                </div>
            </>
        )}
      </div>

      {/* SCENARIO SELECTOR */}
      <div className="p-4 border-b border-slate-800 space-y-3 relative z-10">
        <div className="flex justify-between items-center">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Scenario</div>
            <div className="flex gap-1">
                <button onClick={handleSaveAs} title="Save As / Duplicate" className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded"><Copy size={12}/></button>
                <button onClick={handleRenameActive} title="Rename" className="p-1 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded"><Pencil size={12}/></button>
                <button onClick={handleDeleteActive} title="Delete" className="p-1 text-slate-400 hover:text-red-500 hover:bg-slate-700 rounded"><Trash2 size={12}/></button>
            </div>
        </div>

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
        <NavItem id="cashflow" label="Cash Flow" icon={Wallet} />
        <NavItem id="loans" label="Liabilities" icon={Landmark} />
        <NavItem id="assets" label="Assets & Property" icon={Receipt} />
        <NavItem id="assumptions" label="Assumptions" icon={Settings} />
      </nav>

      <div className="p-4 border-t border-slate-800 text-xs text-slate-600">
        <span className="block mb-1">Last Saved: {new Date().toLocaleTimeString()}</span>
        <span className="text-slate-500 font-mono text-[10px]">Session Active</span>
      </div>
    </div>
  );
}