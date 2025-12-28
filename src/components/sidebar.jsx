import React, { useState, useRef, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { generateAIAnalysisExport, generateApplicationExport } from '../utils/ai_export_utils';
import { LayoutDashboard, Receipt, Landmark, Settings, Plus, Save, MoreVertical, Upload, Download, RotateCcw, ChevronDown, Wallet, Database, Copy, Trash2, Pencil, Briefcase, Sliders, GitCompare, FolderOpen, HelpCircle } from 'lucide-react';

export default function Sidebar({ currentView, setView }) {
  const { store, activeScenario, actions } = useData();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScenarioListOpen, setIsScenarioListOpen] = useState(false);
  const [exportDir, setExportDir] = useState({ handle: null, name: '' });
  const supportsFileSystem = typeof window !== 'undefined' && 'showDirectoryPicker' in window && 'indexedDB' in window;
  const fileInputRef = useRef(null);

  const requestDirectory = async () => {
      if (!supportsFileSystem) return null;
      try {
          const dir = await window.showDirectoryPicker();
          const perm = await dir.requestPermission({ mode: 'readwrite' });
          if (perm !== 'granted') {
              alert("Permission denied. Folder not saved.");
              return null;
          }
          setExportDir({ handle: dir, name: dir.name || 'Selected Folder' });
          await saveHandle(dir);
          return dir;
      } catch (err) {
          if (err?.name !== 'AbortError') console.warn('Folder choose cancelled/failed', err);
      }
      return null;
  };

  // --- PERSIST FILE SYSTEM HANDLE ---
  const openHandleDb = () => new Promise((resolve, reject) => {
      try {
          const req = indexedDB.open('ba-planner-fs-handles', 1);
          req.onupgradeneeded = () => { req.result.createObjectStore('handles'); };
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
      } catch (err) { reject(err); }
  });

  const saveHandle = async (handle) => {
      if (!supportsFileSystem || !handle) return;
      const db = await openHandleDb();
      await new Promise((resolve, reject) => {
          const tx = db.transaction('handles', 'readwrite');
          tx.objectStore('handles').put(handle, 'exportDir');
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
      });
      db.close();
  };

  const loadHandle = async () => {
      if (!supportsFileSystem) return null;
      const db = await openHandleDb();
      const handle = await new Promise((resolve, reject) => {
          const tx = db.transaction('handles', 'readonly');
          const req = tx.objectStore('handles').get('exportDir');
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => reject(req.error);
      });
      db.close();
      return handle;
  };

  useEffect(() => {
      if (!supportsFileSystem) return;
      loadHandle().then(async (handle) => {
          if (!handle) return;
          const perm = await handle.queryPermission({ mode: 'readwrite' });
          if (perm === 'granted' || perm === 'prompt' && await handle.requestPermission({ mode: 'readwrite' }) === 'granted') {
              setExportDir({ handle, name: handle.name || 'Saved Folder' });
          }
      }).catch(err => console.warn('Load export directory failed', err));
  }, [supportsFileSystem]);

  const ensureExportHandle = async () => {
      if (!supportsFileSystem) return null;
      if (exportDir.handle) {
          const perm = await exportDir.handle.queryPermission({ mode: 'readwrite' });
          if (perm === 'granted' || (perm === 'prompt' && await exportDir.handle.requestPermission({ mode: 'readwrite' }) === 'granted')) {
              return exportDir.handle;
          }
      }
      return await requestDirectory();
  };

  const writeToChosenFolder = async (fileName, blob) => {
    const handle = await ensureExportHandle();
    if (!handle) return false;
    try {
        const fileHandle = await handle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        alert(`Saved to ${handle.name || exportDir.name || 'selected folder'}/${fileName}`);
        return true;
    } catch (err) {
        console.warn('Write to chosen folder failed, falling back to download', err);
        return false;
    }
  };

  const handleExportApplication = async () => {
    const jsonString = generateApplicationExport(store);
    const blob = new Blob([jsonString], { type: "application/json" });
    const fileName = `ba_planner_app_export_${new Date().toISOString().slice(0,10)}.json`;
    const saved = await writeToChosenFolder(fileName, blob);
    if (!saved) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    }
    setIsMenuOpen(false);
  };

  const handleExportAIAnalysis = async () => {
    const jsonString = generateAIAnalysisExport(store);
    const blob = new Blob([jsonString], { type: "application/json" });
    const fileName = `ba_planner_ai_export_${new Date().toISOString().slice(0,10)}.json`;
    const saved = await writeToChosenFolder(fileName, blob);
    if (!saved) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    }
    setIsMenuOpen(false);
  };

  const handleChooseFolder = async () => {
      if (!supportsFileSystem) {
          alert("Your browser doesn't support picking a local folder. The download will use your default download location.");
          return;
      }
      const dir = await requestDirectory();
      if (dir) setIsMenuOpen(false);
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
      if(action === 'exportFull') handleExportApplication();
      if(action === 'exportAI') handleExportAIAnalysis();
      if(action === 'create_blank') { const n = prompt("Name:"); if(n) actions.createBlankScenario(n); }
      if(action === 'upload') { fileInputRef.current.click(); }
      if(action === 'clear') {
          actions.resetAll();
      }
      if(action === 'help') setView('help');
  };

  const onFileChange = (e) => {
      const file = e.target.files[0]; if(!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
          try {
              const json = JSON.parse(ev.target.result);
              actions.importData(json);
              alert("Import Successful (entire app overwritten).");
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
        <h1 className="text-white font-bold text-lg tracking-tight">BA Planner <span className="text-blue-500">v3.4.0</span></h1>
        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"><MoreVertical size={20} /></button>
        {isMenuOpen && (
            <>
                <div className="fixed inset-0 z-30" onClick={() => setIsMenuOpen(false)}></div>
                <div className="absolute right-4 top-14 w-64 bg-white rounded-lg shadow-xl z-50 py-2 border border-slate-200 text-slate-700">
                    <button onClick={() => handleMenuItemClick('save')} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-sm"><Save size={14} className="text-blue-600"/> Save Session</button>
                    <button onClick={() => handleMenuItemClick('save_as')} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-sm"><Copy size={14} className="text-blue-400"/> Save Scenario As...</button>
                    <div className="px-4 py-2 text-[11px] text-slate-500 uppercase font-bold">Export</div>
                    <div className="px-4 pb-2">
                        <button onClick={handleChooseFolder} className="w-full text-left px-3 py-2 mb-2 bg-slate-100 rounded border border-slate-200 hover:bg-slate-50 flex items-center gap-2 text-sm text-slate-700">
                            <FolderOpen size={14} className="text-slate-500" /> {exportDir.name ? `Folder: ${exportDir.name}` : 'Choose export folder'}
                        </button>
                        {!supportsFileSystem && <div className="text-[11px] text-orange-500">Browser uses default download folder; custom path not supported.</div>}
                    </div>
                    <button onClick={() => handleMenuItemClick('exportFull')} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-sm"><Download size={14} className="text-green-600"/> Export Application Data</button>
                    <button onClick={() => handleMenuItemClick('exportAI')} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-sm"><Database size={14} className="text-emerald-600"/> Export Data For AI Analysis</button>
                    <button onClick={() => handleMenuItemClick('upload')} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-sm"><Upload size={14} className="text-orange-500"/> Import / Restore</button>
                    <div className="h-px bg-slate-100 my-1"></div>
                    <button onClick={() => handleMenuItemClick('create_blank')} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-sm"><Plus size={14} className="text-slate-600"/> Create Blank Scenario</button>
                    <button onClick={() => handleMenuItemClick('help')} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-sm"><HelpCircle size={14} className="text-indigo-600"/> Help & User Manual</button>
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
        <NavItem id="builder" label="Scenario Builder" icon={Sliders} />
        <NavItem id="cashflow" label="Cash Flow" icon={Wallet} />
        <NavItem id="loans" label="Liabilities" icon={Landmark} />
        <NavItem id="assets" label="Assets & Property" icon={Receipt} />
        <NavItem id="ledger" label="Monthly Ledger" icon={Database} />
        <NavItem id="assumptions" label="Assumptions" icon={Settings} />
        <NavItem id="compare" label="Scenario Compare" icon={GitCompare} />
      </nav>

      <div className="p-4 border-t border-slate-800 text-xs text-slate-600">
        <span className="block mb-1">Last Saved: {new Date().toLocaleTimeString()}</span>
        <span className="text-slate-500 font-mono text-[10px]">Session Active</span>
      </div>
    </div>
  );
}
