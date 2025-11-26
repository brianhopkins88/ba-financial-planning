import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { Plus, Save, TrendingUp, Calendar, CheckSquare, Square, AlertTriangle, Pencil, Trash2, Copy } from 'lucide-react';
import { format, parseISO, isAfter, isBefore } from 'date-fns';

const NumberInput = ({ label, value, onChange, step = "1", suffix }) => (
  <div className="flex flex-col space-y-1">
    <label className="text-xs font-bold text-slate-400 uppercase">{label}</label>
    <div className="relative">
      <input
        type="number"
        step={step}
        className="w-full border border-slate-300 rounded px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
        value={value === undefined || value === null ? '' : value}
        placeholder="0"
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      />
      {suffix && <span className="absolute right-3 top-2 text-xs text-slate-400">{suffix}</span>}
    </div>
  </div>
);

export default function Income() {
  const { store, activeScenario, actions, simulationDate } = useData();
  const [showProfileMgr, setShowProfileMgr] = useState(false);

  // 1. Get Registry Data
  const type = 'income';
  const profileSequence = activeScenario.data[type].profileSequence || [];
  const globalStart = activeScenario.data.globals.timing;
  const globalStartDateStr = `${globalStart.startYear}-${String(globalStart.startMonth).padStart(2, '0')}-01`;

  // 2. Derive Active Profile
  const getActiveProfile = () => {
      const activeItems = profileSequence.filter(item =>
          item.isActive && !isAfter(parseISO(item.startDate), simulationDate)
      );
      if (activeItems.length === 0) return null;
      const effectiveItem = activeItems[activeItems.length - 1];
      const profile = store.profiles[effectiveItem.profileId];
      return profile ? { ...profile, ...effectiveItem } : null;
  };
  const activeProfile = getActiveProfile();
  const activeProfileName = activeProfile ? activeProfile.name : "Custom / None";

  // 3. Edit Data (Scratchpad)
  const editData = activeScenario.data.income;

  // 4. Generate Work Status Years
  const startYear = globalStart.startYear;
  const workStatusYears = Array.from({ length: 11 }, (_, i) => startYear + i);

  const handleSaveAsNew = () => {
    const name = prompt("Name this New Income Profile:");
    if(name) actions.saveProfile('income', name, editData);
  };

  const handleSaveChanges = () => {
      if (activeProfile && confirm(`Overwrite profile "${activeProfile.name}" with current changes?`)) {
          actions.updateProfile(activeProfile.profileId, editData);
      }
  };

  const handleRenameProfile = (pId, currentName) => {
    const newName = prompt("Enter new profile name:", currentName);
    if (newName && newName !== currentName) {
      actions.renameProfile(pId, newName);
    }
  };

  const handleDeleteProfile = (pId, name) => {
     if(confirm(`Delete profile "${name}"?`)) {
         actions.deleteProfile(pId);
     }
  };

  const handleToggle = (pId, active, date) => {
      if (active) {
          const conflict = profileSequence.find(p => p.isActive && p.startDate === date && p.profileId !== pId);
          if (conflict) {
              if(!confirm(`Warning: Another profile is already active on ${date}. \n\nClick OK to deactivate the old one and proceed.`)) {
                  return;
              }
              actions.toggleProfileInScenario('income', conflict.profileId, false, conflict.startDate);
          }
      }

      if (!active) {
          const proposedActive = profileSequence.filter(p =>
              p.profileId !== pId &&
              p.isActive &&
              !isAfter(parseISO(p.startDate), simulationDate)
          );

          const itemBeingDisabled = profileSequence.find(p => p.profileId === pId);
          const isRelevantToCurrentDate = !isAfter(parseISO(itemBeingDisabled?.startDate || date), simulationDate);

          if (isRelevantToCurrentDate) {
              if (proposedActive.length === 0) {
                  alert("Cannot disable: At least one profile must be active and cover the current simulation date.");
                  return;
              }
          }
      }

      actions.toggleProfileInScenario('income', pId, active, date);
  };

  const availableProfiles = Object.values(store.profiles).filter(p => p.type === 'income');

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">

      {/* HEADER & PROFILE MANAGER */}
      <div className="bg-white border-b border-slate-200 px-8 py-6 shadow-sm z-10">
        <div className="flex justify-between items-start mb-6">

          {/* HEADER TITLE & ACTIVE BADGE */}
          <div>
            <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><TrendingUp /> Income Manager</h2>
                <div className="flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Active:</span>
                    <span className="text-xs font-bold text-blue-700">{activeProfileName}</span>
                </div>
            </div>
            <p className="text-slate-500 text-sm mt-1">Manage active salary, contributions, and retirement glide path.</p>
          </div>

          <div className="flex flex-col items-end gap-2">
             <button
                onClick={() => setShowProfileMgr(!showProfileMgr)}
                className={`text-xs font-bold px-3 py-2 rounded border transition-colors flex items-center gap-2 ${showProfileMgr ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-600'}`}
             >
                <Calendar size={14} /> Profile Manager {showProfileMgr ? '▲' : '▼'}
             </button>

             <div className="flex items-center gap-2">
                 {activeProfile && (
                    <button onClick={handleSaveChanges} className="text-xs font-bold px-3 py-2 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 flex items-center gap-2 shadow-sm transition-colors" title="Save changes to current profile">
                        <Save size={14} /> Save to "{activeProfile.name}"
                    </button>
                 )}
                 <button onClick={handleSaveAsNew} className="text-xs font-bold px-3 py-2 rounded bg-slate-800 text-white hover:bg-slate-700 flex items-center gap-2 shadow-sm transition-colors" title="Save as new Profile">
                    <Copy size={14} /> Save as New
                 </button>
             </div>
          </div>
        </div>

        {/* TIMELINE DROPDOWN */}
        {showProfileMgr && (
            <div className="mb-6 bg-slate-50 rounded-lg border border-slate-200 p-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase mb-3">Active Profile Sequence</h3>
                <div className="space-y-2">
                    {availableProfiles.length === 0 && <div className="text-sm text-slate-400 italic">No saved profiles found. Save one to create a timeline.</div>}
                    {availableProfiles.map(p => {
                        const seqEntry = profileSequence.find(s => s.profileId === p.id);
                        const isActive = seqEntry?.isActive;
                        const startDate = seqEntry?.startDate || globalStartDateStr;

                        return (
                            <div key={p.id} className="flex items-center gap-4 bg-white p-2 rounded border border-slate-100 shadow-sm group">
                                <button
                                    onClick={() => handleToggle(p.id, !isActive, startDate)}
                                    className={`p-1 rounded ${isActive ? 'text-blue-600' : 'text-slate-300 hover:text-slate-400'}`}
                                >
                                    {isActive ? <CheckSquare size={20} /> : <Square size={20} />}
                                </button>
                                <div className="flex-1 flex items-center gap-2">
                                    <div className="text-sm font-bold text-slate-700">{p.name}</div>
                                    <button
                                        onClick={() => handleRenameProfile(p.id, p.name)}
                                        className="p-1 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                                        title="Rename Profile"
                                    >
                                        <Pencil size={14} />
                                    </button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-400 uppercase">Starts:</span>
                                    <input
                                        type="date"
                                        className={`text-sm border rounded px-2 py-1 ${!isActive ? 'text-slate-300' : 'text-slate-700 font-bold'}`}
                                        value={startDate}
                                        disabled={!isActive}
                                        onChange={(e) => handleToggle(p.id, true, e.target.value)}
                                    />
                                </div>
                                {!isActive && (
                                    <button
                                        onClick={() => handleDeleteProfile(p.id, p.name)}
                                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                        title="Delete Profile"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        )}
      </div>

      {/* EDITING FORM */}
      <div className="max-w-4xl mx-auto space-y-6 p-8 w-full">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-slate-700 flex items-center gap-2">Active Income Sources</h3>
                  <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">Editing Scenario Scratchpad</span>
              </div>

              <div className="grid grid-cols-2 gap-8">
                {/* PERSON A */}
                <div className="space-y-4">
                   <h4 className="font-bold text-blue-600 text-sm uppercase">Brian</h4>
                   <NumberInput
                     label="Net Annual Take-Home"
                     value={editData.brian.netSalary}
                     onChange={(v) => actions.updateScenarioData('income.brian.netSalary', v)}
                     step="1000"
                   />
                   <NumberInput
                     label="Gross (For 401k Calc)"
                     value={editData.brian.grossForContrib}
                     onChange={(v) => actions.updateScenarioData('income.brian.grossForContrib', v)}
                     step="1000"
                   />
                   <NumberInput
                     label="401k Contribution Rate"
                     value={editData.brian.contribPercent}
                     onChange={(v) => actions.updateScenarioData('income.brian.contribPercent', v)}
                     step="0.01"
                     suffix="dec"
                   />
                </div>

                {/* PERSON B */}
                <div className="space-y-4">
                   <h4 className="font-bold text-purple-600 text-sm uppercase">Andrea</h4>
                   <NumberInput
                     label="Net Annual Take-Home"
                     value={editData.andrea.netSalary}
                     onChange={(v) => actions.updateScenarioData('income.andrea.netSalary', v)}
                     step="1000"
                   />
                   <NumberInput
                     label="Gross (For 401k Calc)"
                     value={editData.andrea.grossForContrib}
                     onChange={(v) => actions.updateScenarioData('income.andrea.grossForContrib', v)}
                     step="1000"
                   />
                   <NumberInput
                     label="401k Contribution Rate"
                     value={editData.andrea.contribPercent}
                     onChange={(v) => actions.updateScenarioData('income.andrea.contribPercent', v)}
                     step="0.01"
                     suffix="dec"
                   />
                </div>
              </div>
            </div>

            {/* WORK STATUS TABLE */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
              <h3 className="font-bold text-slate-700 mb-4">Work Status Trajectory (0.0 - 1.0)</h3>
              <p className="text-sm text-slate-400 mb-4">
                 Extended to 10 years from Scenario Start. Defaults to 0 if unset.
              </p>
              <div className="overflow-x-auto">
                 <table className="w-full text-sm text-left">
                   <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                     <tr>
                       <th className="px-4 py-2">Year</th>
                       <th className="px-4 py-2 text-blue-600">Brian FTE</th>
                       <th className="px-4 py-2 text-purple-600">Andrea FTE</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                     {workStatusYears.map((year) => {
                       const status = editData.workStatus?.[year] || { brian: 0, andrea: 0 };
                       return (
                        <tr key={year}>
                            <td className="px-4 py-2 font-bold text-slate-600">{year}</td>
                            <td className="px-4 py-2">
                            <input
                                type="number" step="0.1" max="1.0"
                                className="w-20 border rounded px-2 py-1"
                                value={status.brian}
                                placeholder="0"
                                onChange={(e) => actions.updateScenarioData(`income.workStatus.${year}.brian`, parseFloat(e.target.value) || 0)}
                            />
                            </td>
                            <td className="px-4 py-2">
                                <input
                                type="number" step="0.1" max="1.0"
                                className="w-20 border rounded px-2 py-1"
                                value={status.andrea}
                                placeholder="0"
                                onChange={(e) => actions.updateScenarioData(`income.workStatus.${year}.andrea`, parseFloat(e.target.value) || 0)}
                            />
                            </td>
                        </tr>
                       );
                     })}
                   </tbody>
                 </table>
              </div>
            </div>
      </div>
    </div>
  );
}