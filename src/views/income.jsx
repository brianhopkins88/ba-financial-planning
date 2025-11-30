import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Save, TrendingUp, Calendar, CheckSquare, Square, Pencil, Trash2, Copy, Info } from 'lucide-react';
import { parseISO, isAfter } from 'date-fns';

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

const MonthSelect = ({ label, value, onChange }) => (
    <div className="flex flex-col space-y-1">
        <label className="text-xs font-bold text-slate-400 uppercase">{label}</label>
        <select
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
            value={value || 1}
            onChange={(e) => onChange(parseInt(e.target.value))}
        >
            {Array.from({length: 12}, (_, i) => i+1).map(m => (
                <option key={m} value={m}>{new Date(2000, m-1).toLocaleString('default', {month:'long'})}</option>
            ))}
        </select>
    </div>
);

export default function Income() {
  const { store, activeScenario, actions, simulationDate } = useData();
  const [showProfileMgr, setShowProfileMgr] = useState(false);

  // 1. Get Registry Data
  const type = 'income';
  const profileSequence = activeScenario.data[type].profileSequence || [];
  const assumptions = activeScenario.data.assumptions || activeScenario.data.globals || {};
  const globalStart = assumptions.timing || { startYear: 2026, startMonth: 1 };
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

  // Ensure structure exists
  ['brian', 'andrea'].forEach(p => {
      if (!editData[p].bonus) editData[p].bonus = { amount: 0, month: 12 };
      if (!editData[p].socialSecurity) editData[p].socialSecurity = { startAge: 70, monthlyAmount: 0 };
  });
  if (!editData.andrea.pension) editData.andrea.pension = { monthlyAmount: 0, inflationAdjusted: true };

  // 4. Calculate Andrea's Auto-Pension Age
  const andreaBirthYear = editData.andrea.birthYear || 1965;
  const workStatusMap = editData.workStatus || {};
  const sortedYears = Object.keys(workStatusMap).map(Number).sort((a,b) => a-b);

  let pensionStartYear = null;
  // Find first year where FTE is 0
  for (const y of sortedYears) {
      if (workStatusMap[y]?.andrea === 0) {
          pensionStartYear = y;
          break;
      }
  }
  const autoPensionAge = pensionStartYear ? (pensionStartYear - andreaBirthYear) : "N/A (Working)";


  // 5. Generate Work Status Years
  const startYear = globalStart.startYear;
  const workStatusYears = Array.from({ length: 15 }, (_, i) => startYear + i); // Extended to 15y

  const handleSaveAsNew = () => { const name = prompt("Name this New Income Profile:"); if(name) actions.saveProfile('income', name, editData); };
  const handleSaveChanges = () => { if (activeProfile && confirm(`Overwrite profile "${activeProfile.name}" with current changes?`)) { actions.updateProfile(activeProfile.profileId, editData); } };
  const handleRenameProfile = (pId, cName) => { const n = prompt("New name:", cName); if (n && n !== cName) actions.renameProfile(pId, n); };
  const handleDeleteProfile = (pId, name) => { if(confirm(`Delete "${name}"?`)) actions.deleteProfile(pId); };

  const handleToggle = (pId, active, date) => {
      if (active) {
          const conflict = profileSequence.find(p => p.isActive && p.startDate === date && p.profileId !== pId);
          if (conflict && !confirm(`Replace active profile on ${date}?`)) return;
          if (conflict) actions.toggleProfileInScenario('income', conflict.profileId, false, conflict.startDate);
      }
      actions.toggleProfileInScenario('income', pId, active, date);
  };

  const availableProfiles = Object.values(store.profiles).filter(p => p.type === 'income');

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">

      {/* HEADER */}
      <div className="bg-white border-b border-slate-200 px-8 py-6 shadow-sm z-10">
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><TrendingUp /> Income Manager</h2>
                <div className="flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Active:</span>
                    <span className="text-xs font-bold text-blue-700">{activeProfileName}</span>
                </div>
            </div>
            <p className="text-slate-500 text-sm mt-1">Manage salary, retirement income, and work status trajectory.</p>
          </div>

          <div className="flex flex-col items-end gap-2">
             <button onClick={() => setShowProfileMgr(!showProfileMgr)} className={`text-xs font-bold px-3 py-2 rounded border transition-colors flex items-center gap-2 ${showProfileMgr ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-600'}`}>
                <Calendar size={14} /> Profile Manager {showProfileMgr ? '▲' : '▼'}
             </button>
             <div className="flex items-center gap-2">
                 {activeProfile && (
                    <button onClick={handleSaveChanges} className="text-xs font-bold px-3 py-2 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 flex items-center gap-2 shadow-sm transition-colors"><Save size={14} /> Save to "{activeProfile.name}"</button>
                 )}
                 <button onClick={handleSaveAsNew} className="text-xs font-bold px-3 py-2 rounded bg-slate-800 text-white hover:bg-slate-700 flex items-center gap-2 shadow-sm transition-colors"><Copy size={14} /> Save as New</button>
             </div>
          </div>
        </div>

        {/* PROFILE MANAGER DROPDOWN */}
        {showProfileMgr && (
            <div className="mb-6 bg-slate-50 rounded-lg border border-slate-200 p-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase mb-3">Active Profile Sequence</h3>
                <div className="space-y-2">
                    {availableProfiles.length === 0 && <div className="text-sm text-slate-400 italic">No saved profiles found.</div>}
                    {availableProfiles.map(p => {
                        const seqEntry = profileSequence.find(s => s.profileId === p.id);
                        const isActive = seqEntry?.isActive;
                        const startDate = seqEntry?.startDate || globalStartDateStr;
                        return (
                            <div key={p.id} className="flex items-center gap-4 bg-white p-2 rounded border border-slate-100 shadow-sm group">
                                <button onClick={() => handleToggle(p.id, !isActive, startDate)} className={`p-1 rounded ${isActive ? 'text-blue-600' : 'text-slate-300 hover:text-slate-400'}`}>{isActive ? <CheckSquare size={20} /> : <Square size={20} />}</button>
                                <div className="flex-1 flex items-center gap-2">
                                    <div className="text-sm font-bold text-slate-700">{p.name}</div>
                                    <button onClick={() => handleRenameProfile(p.id, p.name)} className="p-1 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"><Pencil size={14} /></button>
                                </div>
                                <div className="flex items-center gap-2"><span className="text-xs text-slate-400 uppercase">Starts:</span><input type="date" className="text-sm border rounded px-2 py-1" value={startDate} disabled={!isActive} onChange={(e) => handleToggle(p.id, true, e.target.value)} /></div>
                                {!isActive && (<button onClick={() => handleDeleteProfile(p.id, p.name)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"><Trash2 size={16} /></button>)}
                            </div>
                        );
                    })}
                </div>
            </div>
        )}
      </div>

      {/* EDITING FORM */}
      <div className="max-w-6xl mx-auto space-y-6 p-8 w-full flex-1 overflow-auto">

            {/* 1. PERSONAL DETAILS & INCOME */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
              <h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2">Personal Income Configuration</h3>
              <div className="grid grid-cols-2 gap-12">

                {/* PERSON A: BRIAN */}
                <div className="space-y-6 border-r border-slate-100 pr-6">
                   <div className="flex items-center justify-between">
                       <h4 className="font-bold text-blue-600 text-sm uppercase tracking-wider">Brian</h4>
                       <div className="flex gap-2">
                           <div className="w-20"><NumberInput label="Birth Year" value={editData.brian.birthYear} onChange={(v) => actions.updateScenarioData('income.brian.birthYear', v)} /></div>
                           <div className="w-32"><MonthSelect label="Birth Month" value={editData.brian.birthMonth} onChange={(v) => actions.updateScenarioData('income.brian.birthMonth', v)} /></div>
                       </div>
                   </div>

                   <div className="bg-slate-50 p-4 rounded-lg space-y-4 border border-slate-100">
                       <h5 className="text-xs font-bold text-slate-500 uppercase">Employment Income</h5>
                       <NumberInput label="Net Annual Salary" value={editData.brian.netSalary} onChange={(v) => actions.updateScenarioData('income.brian.netSalary', v)} step="1000" />
                       <div className="grid grid-cols-2 gap-4">
                            <NumberInput label="Annual Bonus (Net)" value={editData.brian.bonus.amount} onChange={(v) => actions.updateScenarioData('income.brian.bonus.amount', v)} step="1000" />
                            <MonthSelect label="Payout Month" value={editData.brian.bonus.month} onChange={(v) => actions.updateScenarioData('income.brian.bonus.month', v)} />
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                           <NumberInput label="Gross (401k Calc)" value={editData.brian.grossForContrib} onChange={(v) => actions.updateScenarioData('income.brian.grossForContrib', v)} step="1000" />
                           <NumberInput label="401k Contrib Rate" value={editData.brian.contribPercent} onChange={(v) => actions.updateScenarioData('income.brian.contribPercent', v)} step="0.01" suffix="dec" />
                       </div>
                   </div>

                   <div className="bg-blue-50/50 p-4 rounded-lg space-y-4 border border-blue-100">
                       <h5 className="text-xs font-bold text-blue-500 uppercase">Social Security</h5>
                       <div className="grid grid-cols-2 gap-4">
                           <NumberInput label="Start Age" value={editData.brian.socialSecurity.startAge} onChange={(v) => actions.updateScenarioData('income.brian.socialSecurity.startAge', v)} />
                           <NumberInput label="Monthly Amount (Today's $)" value={editData.brian.socialSecurity.monthlyAmount} onChange={(v) => actions.updateScenarioData('income.brian.socialSecurity.monthlyAmount', v)} step="100" />
                       </div>
                       <p className="text-[10px] text-blue-400 leading-tight">
                           * First year prorated by birth month ({editData.brian.birthMonth || 1}).<br/>
                           * Amount adjusts for inflation until start date.
                       </p>
                   </div>
                </div>

                {/* PERSON B: ANDREA */}
                <div className="space-y-6">
                   <div className="flex items-center justify-between">
                       <h4 className="font-bold text-purple-600 text-sm uppercase tracking-wider">Andrea</h4>
                       <div className="flex gap-2">
                           <div className="w-20"><NumberInput label="Birth Year" value={editData.andrea.birthYear} onChange={(v) => actions.updateScenarioData('income.andrea.birthYear', v)} /></div>
                           <div className="w-32"><MonthSelect label="Birth Month" value={editData.andrea.birthMonth} onChange={(v) => actions.updateScenarioData('income.andrea.birthMonth', v)} /></div>
                       </div>
                   </div>

                   <div className="bg-slate-50 p-4 rounded-lg space-y-4 border border-slate-100">
                       <h5 className="text-xs font-bold text-slate-500 uppercase">Employment Income</h5>
                       <NumberInput label="Net Annual Salary" value={editData.andrea.netSalary} onChange={(v) => actions.updateScenarioData('income.andrea.netSalary', v)} step="1000" />
                       <div className="grid grid-cols-2 gap-4">
                            <NumberInput label="Annual Bonus (Net)" value={editData.andrea.bonus.amount} onChange={(v) => actions.updateScenarioData('income.andrea.bonus.amount', v)} step="1000" />
                            <MonthSelect label="Payout Month" value={editData.andrea.bonus.month} onChange={(v) => actions.updateScenarioData('income.andrea.bonus.month', v)} />
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                           <NumberInput label="Gross (401k Calc)" value={editData.andrea.grossForContrib} onChange={(v) => actions.updateScenarioData('income.andrea.grossForContrib', v)} step="1000" />
                           <NumberInput label="401k Contrib Rate" value={editData.andrea.contribPercent} onChange={(v) => actions.updateScenarioData('income.andrea.contribPercent', v)} step="0.01" suffix="dec" />
                       </div>
                   </div>

                   <div className="bg-purple-50/50 p-4 rounded-lg space-y-4 border border-purple-100">
                       <h5 className="text-xs font-bold text-purple-500 uppercase">Retirement Income</h5>

                       {/* SOCIAL SECURITY */}
                       <div className="grid grid-cols-2 gap-4">
                           <NumberInput label="SS Start Age" value={editData.andrea.socialSecurity.startAge} onChange={(v) => actions.updateScenarioData('income.andrea.socialSecurity.startAge', v)} />
                           <NumberInput label="SS Monthly (Today's $)" value={editData.andrea.socialSecurity.monthlyAmount} onChange={(v) => actions.updateScenarioData('income.andrea.socialSecurity.monthlyAmount', v)} step="100" />
                       </div>

                       <div className="h-px bg-purple-100 my-2"></div>

                       {/* PENSION */}
                       <div className="flex items-center justify-between">
                           <label className="text-xs font-bold text-purple-500 uppercase">Pension</label>
                           <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-1 rounded">Starts Age: {autoPensionAge}</span>
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                           <NumberInput label="Monthly Amount" value={editData.andrea.pension.monthlyAmount} onChange={(v) => actions.updateScenarioData('income.andrea.pension.monthlyAmount', v)} step="100" />
                           <div className="flex items-center pt-6">
                               <label className="flex items-center gap-2 cursor-pointer">
                                   <input
                                        type="checkbox"
                                        checked={editData.andrea.pension.inflationAdjusted}
                                        onChange={(e) => actions.updateScenarioData('income.andrea.pension.inflationAdjusted', e.target.checked)}
                                        className="rounded text-purple-600 focus:ring-purple-500"
                                   />
                                   <span className="text-sm text-slate-600 font-medium">Inflation Adjusted?</span>
                               </label>
                           </div>
                       </div>
                   </div>
                </div>
              </div>
            </div>

            {/* 2. WORK STATUS TRAJECTORY */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-slate-700">Work Status Trajectory (FTE 0.0 - 1.0)</h3>
                  <div className="text-xs text-slate-400 flex items-center gap-1"><Info size={12}/> FTE 0.0 triggers Retirement Logic</div>
              </div>

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
                                <input type="number" step="0.1" max="1.0" min="0.0" className="w-20 border rounded px-2 py-1" value={status.brian} placeholder="0" onChange={(e) => actions.updateScenarioData(`income.workStatus.${year}.brian`, parseFloat(e.target.value) || 0)} />
                            </td>
                            <td className="px-4 py-2">
                                <input type="number" step="0.1" max="1.0" min="0.0" className="w-20 border rounded px-2 py-1" value={status.andrea} placeholder="0" onChange={(e) => actions.updateScenarioData(`income.workStatus.${year}.andrea`, parseFloat(e.target.value) || 0)} />
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