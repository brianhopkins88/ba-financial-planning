import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { Plus, Trash2, Save, Receipt, ChevronDown, ChevronRight, Calendar, CheckSquare, Square, CreditCard, Pencil, Copy, BarChart3, Table, List, Palmtree, Settings, TrendingUp, DollarSign } from 'lucide-react';
import { parseISO, isAfter, format, addMonths, startOfMonth, getYear } from 'date-fns';
import { calculateFixedLoan, calculateRevolvingLoan } from '../utils/loan_math';
import { runFinancialSimulation } from '../utils/financial_engine';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';

// --- HELPERS ---
const NumberInput = ({ label, value, onChange, step = "1", suffix }) => (
  <div className="flex flex-col space-y-1">
    <label className="text-xs font-bold text-slate-400 uppercase">{label}</label>
    <div className="relative">
      <input
        type="number" step={step}
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

const BillRow = ({ item, onChange, onDelete }) => (
  <div className="flex items-center gap-2 group mb-2 pl-2 border-l-2 border-transparent hover:border-blue-400 transition-colors">
    <input
      className="flex-1 min-w-0 border-b border-slate-100 focus:border-blue-500 px-2 py-1 text-sm text-slate-700 bg-transparent outline-none transition-colors"
      value={item.name}
      onChange={(e) => onChange('name', e.target.value)}
      placeholder="Expense Name"
    />
    <div className="relative w-28 flex-shrink-0">
        <span className="absolute left-2 top-1.5 text-slate-400 text-xs">$</span>
        <input
          type="number"
          className="w-full pl-5 border-b border-slate-100 focus:border-blue-500 px-2 py-1 text-sm text-slate-700 text-right font-mono bg-transparent outline-none transition-colors"
          value={item.amount === 0 ? '' : item.amount}
          placeholder="0"
          onChange={(e) => { const val = e.target.value; onChange('amount', val === '' ? 0 : parseFloat(val)); }}
        />
    </div>
    <button onClick={onDelete} className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"><Trash2 size={16} /></button>
  </div>
);

const Accordion = ({ title, total, children, defaultOpen = false, onAdd }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden mb-4">
      <div className="flex items-center justify-between p-4 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => setIsOpen(!isOpen)}>
        <div className="flex items-center gap-2 font-bold text-slate-700">{isOpen ? <ChevronDown size={18}/> : <ChevronRight size={18}/>}{title}</div>
        <div className="flex items-center gap-4">
            {onAdd && (<button onClick={(e) => { e.stopPropagation(); onAdd(); }} className="text-slate-400 hover:text-blue-600 transition-colors"><Plus size={16}/></button>)}
            <span className="text-xs font-mono font-bold text-slate-600 bg-white px-2 py-1 rounded border border-slate-200 min-w-[80px] text-right">${total.toLocaleString()}</span>
        </div>
      </div>
      {isOpen && <div className="p-4 bg-white border-t border-slate-100">{children}</div>}
    </div>
  );
};

// --- NET CASH FLOW SUMMARY (ENGINE-BASED) ---
const NetCashFlowSummary = ({ activeScenario, store }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const summaryData = useMemo(() => {
        // Run full simulation
        const simulation = runFinancialSimulation(activeScenario, store.profiles);
        // Aggregate Monthly Timeline to Annual
        const annualData = {};
        simulation.timeline.forEach(step => {
            const year = step.year;
            if(!annualData[year]) annualData[year] = { year, income: 0, expenses: 0, netFlow: 0, age: step.age };
            annualData[year].income += step.income;
            annualData[year].expenses += step.expenses;
            annualData[year].netFlow += step.netCashFlow;
        });
        return Object.values(annualData);
    }, [activeScenario, store.profiles]);

    return (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm mb-6 overflow-hidden">
             <div className="p-4 bg-slate-800 text-white flex justify-between items-center cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                 <div className="flex items-center gap-2 font-bold">
                     <TrendingUp size={20} className="text-emerald-400"/>
                     <span>Net Cash Flow Projection</span>
                 </div>
                 {isExpanded ? <ChevronDown size={18}/> : <ChevronRight size={18}/>}
             </div>

             {isExpanded && (
                 <div className="p-6">
                     <div className="h-64 mb-6">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={summaryData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} tickFormatter={(v) => `$${v/1000}k`} />
                                <Tooltip
                                    cursor={{fill: 'transparent'}}
                                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                                    formatter={(val, name) => [`$${Math.round(val).toLocaleString()}`, name === 'netFlow' ? 'Net Flow' : name]}
                                />
                                <ReferenceLine y={0} stroke="#94a3b8" />
                                <Bar dataKey="netFlow" radius={[4, 4, 4, 4]}>
                                    {summaryData.map((entry, index) => (
                                        <Cell key={index} fill={entry.netFlow >= 0 ? '#10b981' : '#ef4444'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                     </div>

                     <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg">
                         <table className="w-full text-sm text-right">
                             <thead className="bg-slate-50 text-xs text-slate-500 uppercase sticky top-0">
                                 <tr>
                                     <th className="px-4 py-2 text-left">Year</th>
                                     <th className="px-4 py-2 text-left">Age</th>
                                     <th className="px-4 py-2 text-emerald-600">Total Income</th>
                                     <th className="px-4 py-2 text-red-600">Total Burn</th>
                                     <th className="px-4 py-2">Net Flow</th>
                                 </tr>
                             </thead>
                             <tbody className="divide-y divide-slate-100">
                                 {summaryData.map(row => (
                                     <tr key={row.year} className="hover:bg-slate-50">
                                         <td className="px-4 py-2 text-left font-bold text-slate-700">{row.year}</td>
                                         <td className="px-4 py-2 text-left text-slate-500">{row.age}</td>
                                         <td className="px-4 py-2 text-emerald-600 font-mono">${Math.round(row.income).toLocaleString()}</td>
                                         <td className="px-4 py-2 text-red-500 font-mono">${Math.round(row.expenses).toLocaleString()}</td>
                                         <td className={`px-4 py-2 font-mono font-bold ${row.netFlow >= 0 ? 'text-slate-700' : 'text-red-600'}`}>
                                             ${Math.round(row.netFlow).toLocaleString()}
                                         </td>
                                     </tr>
                                 ))}
                             </tbody>
                         </table>
                     </div>
                 </div>
             )}
        </div>
    );
};


// --- PROFILE MANAGER ---
const ProfileMenu = ({ type, activeProfileName, onSave, onSaveAs, onToggleMgr, showMgr }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="relative">
            <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2 text-xs font-bold px-3 py-2 rounded bg-white border border-slate-200 text-slate-700 hover:border-blue-400 hover:text-blue-600 transition-all shadow-sm">
                <Settings size={14} /> <span>{type === 'income' ? 'Income Profiles' : 'Expense Profiles'}</span> <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}/>
            </button>
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-20" onClick={() => setIsOpen(false)}></div>
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-lg shadow-xl z-30 overflow-hidden">
                         <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active: {activeProfileName}</div>
                         <button onClick={() => { onSave(); setIsOpen(false); }} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3"><Save size={16} className="text-blue-600"/> Save Changes</button>
                         <button onClick={() => { onSaveAs(); setIsOpen(false); }} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3"><Copy size={16} className="text-slate-500"/> Save as New...</button>
                         <div className="h-px bg-slate-100 my-1"></div>
                         <button onClick={() => { onToggleMgr(); setIsOpen(false); }} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3"><Calendar size={16} className={showMgr ? "text-blue-600" : "text-slate-500"}/> {showMgr ? "Hide Timeline" : "Manage Timeline"}</button>
                    </div>
                </>
            )}
        </div>
    );
};

const ProfileManager = ({ type, profiles, sequence, actions, simulationDate, globalStartDateStr }) => {
    const availableProfiles = Object.values(profiles).filter(p => p.type === type);

    const handleToggle = (pId, active, date) => {
      if (active) {
          const conflict = sequence.find(p => p.isActive && p.startDate === date && p.profileId !== pId);
          if (conflict && !confirm(`Replace active profile on ${date}?`)) return;
          if (conflict) actions.toggleProfileInScenario(type, conflict.profileId, false, conflict.startDate);
      }
      actions.toggleProfileInScenario(type, pId, active, date);
    };

    const handleRename = (pId, cName) => { const n = prompt("New name:", cName); if (n && n !== cName) actions.renameProfile(pId, n); };
    const handleDelete = (pId, name) => { if(confirm(`Delete "${name}"?`)) actions.deleteProfile(pId); };

    return (
        <div className="mb-6 bg-slate-50 rounded-lg border border-slate-200 p-4">
             <h3 className="text-xs font-bold text-slate-400 uppercase mb-3">{type} Profile Sequence</h3>
             <div className="space-y-2">
                 {availableProfiles.length === 0 && <div className="text-sm text-slate-400 italic">No saved profiles found.</div>}
                 {availableProfiles.map(p => {
                     const seqEntry = sequence.find(s => s.profileId === p.id);
                     const isActive = seqEntry?.isActive;
                     const startDate = seqEntry?.startDate || globalStartDateStr;
                     return (
                         <div key={p.id} className="flex items-center gap-4 bg-white p-2 rounded border border-slate-100 shadow-sm group">
                             <button onClick={() => handleToggle(p.id, !isActive, startDate)} className={`p-1 rounded ${isActive ? 'text-blue-600' : 'text-slate-300 hover:text-slate-400'}`}>{isActive ? <CheckSquare size={20} /> : <Square size={20} />}</button>
                             <div className="flex-1 flex items-center gap-2">
                                 <div className="text-sm font-bold text-slate-700">{p.name}</div>
                                 <button onClick={() => handleRename(p.id, p.name)} className="p-1 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"><Pencil size={14} /></button>
                             </div>
                             <div className="flex items-center gap-2"><span className="text-xs text-slate-400 uppercase">Starts:</span><input type="date" className="text-sm border rounded px-2 py-1" value={startDate} disabled={!isActive} onChange={(e) => handleToggle(p.id, true, e.target.value)} /></div>
                             {!isActive && (<button onClick={() => handleDelete(p.id, p.name)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"><Trash2 size={16} /></button>)}
                         </div>
                     );
                 })}
             </div>
        </div>
    );
};


// --- EDITOR COMPONENTS ---

const IncomeEditor = ({ editData, actions, globalStart }) => {
    // Structure Check
    ['brian', 'andrea'].forEach(p => {
        if (!editData[p].bonus) editData[p].bonus = { amount: 0, month: 12 };
        if (!editData[p].socialSecurity) editData[p].socialSecurity = { startAge: 70, monthlyAmount: 0 };
    });
    if (!editData.andrea.pension) editData.andrea.pension = { monthlyAmount: 0, inflationAdjusted: true };

    const startYear = globalStart.startYear || 2026;
    const workStatusYears = Array.from({ length: 15 }, (_, i) => startYear + i);

    // Auto-Calc Pension Age
    let pensionStartYear = null;
    const sortedYears = Object.keys(editData.workStatus || {}).map(Number).sort((a,b)=>a-b);
    for(const y of sortedYears) { if(editData.workStatus[y]?.andrea === 0) { pensionStartYear = y; break; } }
    const autoPensionAge = pensionStartYear ? (pensionStartYear - (editData.andrea.birthYear || 1965)) : "N/A";

    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
              <h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2">Personal Income Configuration</h3>
              <div className="grid grid-cols-2 gap-12">
                {/* PERSON A: BRIAN */}
                <div className="space-y-6 border-r border-slate-100 pr-6">
                   <div className="flex items-center justify-between"><h4 className="font-bold text-blue-600 text-sm uppercase tracking-wider">Brian</h4><div className="flex gap-2"><div className="w-20"><NumberInput label="Birth Year" value={editData.brian.birthYear} onChange={(v) => actions.updateScenarioData('income.brian.birthYear', v)} /></div><div className="w-32"><MonthSelect label="Birth Month" value={editData.brian.birthMonth} onChange={(v) => actions.updateScenarioData('income.brian.birthMonth', v)} /></div></div></div>
                   <div className="bg-slate-50 p-4 rounded-lg space-y-4 border border-slate-100"><h5 className="text-xs font-bold text-slate-500 uppercase">Employment Income</h5><NumberInput label="Net Annual Salary" value={editData.brian.netSalary} onChange={(v) => actions.updateScenarioData('income.brian.netSalary', v)} step="1000" /><div className="grid grid-cols-2 gap-4"><NumberInput label="Annual Bonus (Net)" value={editData.brian.bonus.amount} onChange={(v) => actions.updateScenarioData('income.brian.bonus.amount', v)} step="1000" /><MonthSelect label="Payout Month" value={editData.brian.bonus.month} onChange={(v) => actions.updateScenarioData('income.brian.bonus.month', v)} /></div><div className="grid grid-cols-2 gap-4"><NumberInput label="Gross (401k Calc)" value={editData.brian.grossForContrib} onChange={(v) => actions.updateScenarioData('income.brian.grossForContrib', v)} step="1000" /><NumberInput label="401k Contrib Rate" value={editData.brian.contribPercent} onChange={(v) => actions.updateScenarioData('income.brian.contribPercent', v)} step="0.01" suffix="dec" /></div></div>
                   <div className="bg-blue-50/50 p-4 rounded-lg space-y-4 border border-blue-100"><h5 className="text-xs font-bold text-blue-500 uppercase">Social Security</h5><div className="grid grid-cols-2 gap-4"><NumberInput label="Start Age" value={editData.brian.socialSecurity.startAge} onChange={(v) => actions.updateScenarioData('income.brian.socialSecurity.startAge', v)} /><NumberInput label="Monthly Amount (Today's $)" value={editData.brian.socialSecurity.monthlyAmount} onChange={(v) => actions.updateScenarioData('income.brian.socialSecurity.monthlyAmount', v)} step="100" /></div></div>
                </div>
                {/* PERSON B: ANDREA */}
                <div className="space-y-6">
                   <div className="flex items-center justify-between"><h4 className="font-bold text-purple-600 text-sm uppercase tracking-wider">Andrea</h4><div className="flex gap-2"><div className="w-20"><NumberInput label="Birth Year" value={editData.andrea.birthYear} onChange={(v) => actions.updateScenarioData('income.andrea.birthYear', v)} /></div><div className="w-32"><MonthSelect label="Birth Month" value={editData.andrea.birthMonth} onChange={(v) => actions.updateScenarioData('income.andrea.birthMonth', v)} /></div></div></div>
                   <div className="bg-slate-50 p-4 rounded-lg space-y-4 border border-slate-100"><h5 className="text-xs font-bold text-slate-500 uppercase">Employment Income</h5><NumberInput label="Net Annual Salary" value={editData.andrea.netSalary} onChange={(v) => actions.updateScenarioData('income.andrea.netSalary', v)} step="1000" /><div className="grid grid-cols-2 gap-4"><NumberInput label="Annual Bonus (Net)" value={editData.andrea.bonus.amount} onChange={(v) => actions.updateScenarioData('income.andrea.bonus.amount', v)} step="1000" /><MonthSelect label="Payout Month" value={editData.andrea.bonus.month} onChange={(v) => actions.updateScenarioData('income.andrea.bonus.month', v)} /></div><div className="grid grid-cols-2 gap-4"><NumberInput label="Gross (401k Calc)" value={editData.andrea.grossForContrib} onChange={(v) => actions.updateScenarioData('income.andrea.grossForContrib', v)} step="1000" /><NumberInput label="401k Contrib Rate" value={editData.andrea.contribPercent} onChange={(v) => actions.updateScenarioData('income.andrea.contribPercent', v)} step="0.01" suffix="dec" /></div></div>
                   <div className="bg-purple-50/50 p-4 rounded-lg space-y-4 border border-purple-100"><h5 className="text-xs font-bold text-purple-500 uppercase">Retirement Income</h5><div className="grid grid-cols-2 gap-4"><NumberInput label="SS Start Age" value={editData.andrea.socialSecurity.startAge} onChange={(v) => actions.updateScenarioData('income.andrea.socialSecurity.startAge', v)} /><NumberInput label="SS Monthly (Today's $)" value={editData.andrea.socialSecurity.monthlyAmount} onChange={(v) => actions.updateScenarioData('income.andrea.socialSecurity.monthlyAmount', v)} step="100" /></div><div className="h-px bg-purple-100 my-2"></div><div className="flex items-center justify-between"><label className="text-xs font-bold text-purple-500 uppercase">Pension</label><span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-1 rounded">Starts Age: {autoPensionAge}</span></div><div className="grid grid-cols-2 gap-4"><NumberInput label="Monthly Amount" value={editData.andrea.pension.monthlyAmount} onChange={(v) => actions.updateScenarioData('income.andrea.pension.monthlyAmount', v)} step="100" /><div className="flex items-center pt-6"><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={editData.andrea.pension.inflationAdjusted} onChange={(e) => actions.updateScenarioData('income.andrea.pension.inflationAdjusted', e.target.checked)} className="rounded text-purple-600 focus:ring-purple-500"/><span className="text-sm text-slate-600 font-medium">Inflation Adjusted?</span></label></div></div></div>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-slate-700">Work Status Trajectory (FTE 0.0 - 1.0)</h3></div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left"><thead className="text-xs text-slate-500 uppercase bg-slate-50"><tr><th className="px-4 py-2">Year</th><th className="px-4 py-2 text-blue-600">Brian FTE</th><th className="px-4 py-2 text-purple-600">Andrea FTE</th></tr></thead><tbody className="divide-y divide-slate-100">{workStatusYears.map((year) => { const status = editData.workStatus?.[year] || { brian: 0, andrea: 0 }; return (<tr key={year}><td className="px-4 py-2 font-bold text-slate-600">{year}</td><td className="px-4 py-2"><input type="number" step="0.1" max="1.0" min="0.0" className="w-20 border rounded px-2 py-1" value={status.brian} placeholder="0" onChange={(e) => actions.updateScenarioData(`income.workStatus.${year}.brian`, parseFloat(e.target.value) || 0)} /></td><td className="px-4 py-2"><input type="number" step="0.1" max="1.0" min="0.0" className="w-20 border rounded px-2 py-1" value={status.andrea} placeholder="0" onChange={(e) => actions.updateScenarioData(`income.workStatus.${year}.andrea`, parseFloat(e.target.value) || 0)} /></td></tr>); })}</tbody></table>
                </div>
            </div>
        </div>
    );
};

// --- FUTURE EXPENSES SUBMODULE (Restored Features) ---
const FutureExpensesModule = ({ oneOffs, onChange, onAdd, onDelete, activeScenario, actions }) => {
    // 1. Debt Integration: Extract extra payments from Loan Strategies
    const debtPayments = useMemo(() => {
        const payments = [];
        const loans = activeScenario.data.loans || {};
        Object.values(loans).forEach(loan => {
            if (!loan.active) return;
            const stratId = loan.activeStrategyId || 'base';
            const strategy = loan.strategies?.[stratId];
            if (!strategy?.extraPayments) return;
            Object.entries(strategy.extraPayments).forEach(([date, amount]) => {
                if (amount > 0) {
                    payments.push({
                        id: `loan-${loan.id}-${date}`,
                        date: date,
                        name: `Extra Principal: ${loan.name}`,
                        amount: amount,
                        notes: 'Auto-pulled from Liabilities',
                        isLocked: true,
                        type: 'debt'
                    });
                }
            });
        });
        return payments;
    }, [activeScenario]);

    const mergedData = [...oneOffs, ...debtPayments].sort((a, b) => {
        const dateA = a.date || '9999-99';
        const dateB = b.date || '9999-99';
        return dateA.localeCompare(dateB);
    });

    // 2. Fun Money (Retirement Brackets)
    const retirementBrackets = activeScenario.data.expenses.retirementBrackets || {};
    const brackets = [65, 70, 75, 80, 85, 90];
    const brianBirthYear = activeScenario.data.income.brian.birthYear || 1966;

    return (
        <div className="mt-2 space-y-6">
            <div>
                <div className="flex justify-between mb-2">
                    <div className="text-xs font-bold text-slate-500 uppercase">One-Off & Planned Items</div>
                    <button onClick={onAdd} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 flex items-center gap-1 font-bold shadow-sm"><Plus size={12}/> Add Item</button>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                     <table className="w-full text-sm text-left">
                         <thead className="bg-slate-50 text-xs text-slate-500 uppercase font-semibold border-b border-slate-200"><tr><th className="px-4 py-3 w-32">Month/Year</th><th className="px-4 py-3">Expense Name</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 w-10"></th></tr></thead>
                         <tbody className="divide-y divide-slate-100">
                             {mergedData.map((item, idx) => (
                                 <tr key={item.id || idx} className={item.isLocked ? 'bg-slate-50/50 italic text-slate-500' : 'hover:bg-blue-50/30'}>
                                     <td className="p-2">
                                         {item.isLocked ? <span className="pl-2 font-mono text-xs">{item.date}</span> : <input type="month" className="w-full border-slate-200 rounded text-slate-600 font-mono text-xs py-1" value={item.date || ''} onChange={(e) => onChange(item.id, 'date', e.target.value)} />}
                                     </td>
                                     <td className="p-2">
                                         {item.isLocked ? <div className="flex items-center gap-2 pl-2"><CreditCard size={12} className="text-slate-400"/><span>{item.name}</span></div> : <input type="text" className="w-full border-b border-transparent hover:border-slate-200 focus:border-blue-400 outline-none bg-transparent px-2 py-1" value={item.name} onChange={(e) => onChange(item.id, 'name', e.target.value)} placeholder="Description"/>}
                                     </td>
                                     <td className="p-2 text-right">
                                         {item.isLocked ? <span className="pr-2 font-mono font-bold">${item.amount.toLocaleString()}</span> : <input type="number" className="w-full text-right border-b border-transparent hover:border-slate-200 focus:border-blue-400 outline-none bg-transparent px-2 py-1 font-mono font-bold text-slate-700" value={item.amount} onChange={(e) => onChange(item.id, 'amount', parseFloat(e.target.value))} />}
                                     </td>
                                     <td className="p-2 text-center">{!item.isLocked && <button onClick={() => onDelete(item.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={14}/></button>}</td>
                                 </tr>
                             ))}
                             {mergedData.length === 0 && <tr><td colSpan="4" className="p-4 text-center text-slate-400 italic">No future expenses planned.</td></tr>}
                         </tbody>
                     </table>
                </div>
            </div>

            {/* RESTORED FUN MONEY SECTION */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="flex items-start gap-3 mb-4">
                    <Palmtree className="text-blue-500 mt-1" />
                    <div>
                        <h4 className="font-bold text-blue-700 text-sm">Long Term Fun Money (Retirement)</h4>
                        <p className="text-xs text-slate-500">Specify annual budget for travel/holidays by 5-year age brackets (starts at Age 65).</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {brackets.map(age => {
                         const val = retirementBrackets[age] || 0;
                         return (
                            <div key={age} className="bg-white p-2 rounded border border-slate-200 shadow-sm">
                                <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Age {age}-{age+4}</div>
                                <div className="relative">
                                    <span className="absolute left-2 top-1.5 text-slate-400 text-xs">$</span>
                                    <input
                                        type="number"
                                        step="1000"
                                        className="w-full pl-4 pr-1 py-1 text-sm font-mono font-bold text-slate-700 border border-slate-100 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                                        value={val === 0 ? '' : val}
                                        placeholder="0"
                                        onChange={(e) => actions.updateScenarioData(`expenses.retirementBrackets.${age}`, parseFloat(e.target.value) || 0)}
                                    />
                                </div>
                            </div>
                         )
                    })}
                </div>
            </div>
        </div>
    );
};

const ExpensesEditor = ({ editData, actions, mortgageLoans, otherLoans, totalBills, totalHome, totalLiving, totalImpounds, totalMortgageService, totalDebtService, totalOneOffsThisMonth, activeScenario, simulationDate }) => {
    // Actions
    const updateBill = (category, index, field, value) => { const list = [...editData[category]]; list[index] = { ...list[index], [field]: value }; actions.updateScenarioData(`expenses.${category}`, list); };
    const addBill = (category) => { const list = [...editData[category]]; list.push({ id: Date.now(), name: "New Item", amount: 0 }); actions.updateScenarioData(`expenses.${category}`, list); };
    const removeBill = (category, index) => { const list = [...editData[category]]; list.splice(index, 1); actions.updateScenarioData(`expenses.${category}`, list); };

    // Future Expense Actions
    const addFuture = () => { const list = [...editData.oneOffs]; list.push({ id: Date.now(), date: format(simulationDate, 'yyyy-MM'), name: 'New Expense', amount: 0 }); actions.updateScenarioData('expenses.oneOffs', list); };
    const updateFuture = (id, f, v) => { const list = editData.oneOffs.map(i => i.id === id ? { ...i, [f]: v } : i); actions.updateScenarioData('expenses.oneOffs', list); };
    const removeFuture = (id) => { const list = editData.oneOffs.filter(i => i.id !== id); actions.updateScenarioData('expenses.oneOffs', list); };

    return (
        <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
            <Accordion title="Recurring Bills" total={totalBills} defaultOpen={true} onAdd={() => addBill('bills')}>
                <div className="space-y-1">{editData.bills.map((item, idx) => (<BillRow key={idx} item={item} onChange={(f, v) => updateBill('bills', idx, f, v)} onDelete={() => removeBill('bills', idx)} />))}</div>
            </Accordion>

            <Accordion title="Mortgage & Impounds" total={totalMortgageService + totalImpounds} defaultOpen={true} onAdd={() => addBill('impounds')}>
                <div className="space-y-1">
                    {mortgageLoans.map(loan => (
                        <div key={loan.id} className="flex items-center justify-between p-2 border-b border-slate-50 bg-blue-50/30 rounded mb-1">
                            <div className="flex items-center gap-2"><CreditCard size={14} className="text-blue-500"/><span className="text-sm font-bold text-blue-700">{loan.name}</span></div>
                            <span className="font-mono text-sm font-bold text-blue-700">${loan.total.toLocaleString()}</span>
                        </div>
                    ))}
                    {editData.impounds.map((item, idx) => (<BillRow key={idx} item={item} onChange={(f, v) => updateBill('impounds', idx, f, v)} onDelete={() => removeBill('impounds', idx)} />))}
                </div>
            </Accordion>

            <Accordion title="Home Expenses" total={totalHome} defaultOpen={false} onAdd={() => addBill('home')}>
                <div className="space-y-1">{editData.home.map((item, idx) => (<BillRow key={idx} item={item} onChange={(f, v) => updateBill('home', idx, f, v)} onDelete={() => removeBill('home', idx)} />))}</div>
            </Accordion>

            <Accordion title="Living Expenses" total={totalLiving} defaultOpen={false} onAdd={() => addBill('living')}>
                <div className="space-y-1">{editData.living.map((item, idx) => (<BillRow key={idx} item={item} onChange={(f, v) => updateBill('living', idx, f, v)} onDelete={() => removeBill('living', idx)} />))}</div>
            </Accordion>

            <Accordion title="Other Liabilities" total={totalDebtService} defaultOpen={false}>
                <div className="space-y-0.5">
                    {otherLoans.length === 0 && <div className="text-sm text-slate-400 italic p-2">No other active loans found.</div>}
                    {otherLoans.map(loan => (
                        <div key={loan.id} className="py-2 px-2 border-b border-slate-50 hover:bg-slate-50 rounded flex justify-between items-center">
                            <span className="text-sm font-bold text-slate-700">{loan.name}</span>
                            <span className="font-mono text-sm font-bold text-slate-700">${loan.total.toLocaleString()}</span>
                        </div>
                    ))}
                </div>
            </Accordion>

            <Accordion title="Extra Expense Planning" total={totalOneOffsThisMonth} defaultOpen={false}>
                <FutureExpensesModule
                    oneOffs={editData.oneOffs}
                    onAdd={addFuture}
                    onChange={updateFuture}
                    onDelete={removeFuture}
                    activeScenario={activeScenario} // Pass activeScenario to enable Debt integration
                    actions={actions}
                />
            </Accordion>
        </div>
    );
};


// --- MAIN CASH FLOW COMPONENT ---

export default function CashFlow() {
  const { store, activeScenario, actions, simulationDate } = useData();
  const [activeTab, setActiveTab] = useState('expenses'); // 'income' | 'expenses'
  const [showProfileMgr, setShowProfileMgr] = useState(false);

  // DATA PREP
  const incomeData = activeScenario.data.income;
  const expenseData = activeScenario.data.expenses;
  // Initialize Arrays
  if (!expenseData.oneOffs) expenseData.oneOffs = [];
  if (!expenseData.impounds) expenseData.impounds = [];

  const assumptions = activeScenario.data.assumptions || activeScenario.data.globals || {};
  const globalStart = assumptions.timing || { startYear: 2026, startMonth: 1 };
  const globalStartDateStr = `${globalStart.startYear}-${String(globalStart.startMonth).padStart(2, '0')}-01`;

  // PROFILE LOGIC
  const getActiveProfile = (type) => {
      const seq = activeScenario.data[type].profileSequence || [];
      const activeItems = seq.filter(item => item.isActive && !isAfter(parseISO(item.startDate), simulationDate));
      if (activeItems.length === 0) return null;
      const effectiveItem = activeItems[activeItems.length - 1];
      const profile = store.profiles[effectiveItem.profileId];
      return profile ? { ...profile, ...effectiveItem } : null;
  };

  const activeIncomeProfile = getActiveProfile('income');
  const activeExpenseProfile = getActiveProfile('expenses');

  // LOAN MATH for Expenses
  const currentMonthKey = format(simulationDate, 'yyyy-MM');
  const loanCalculations = useMemo(() => {
      const results = {};
      Object.values(activeScenario.data.loans).forEach(loan => {
          if (!loan.active) return;
          const stratId = loan.activeStrategyId || 'base';
          const strategy = loan.strategies?.[stratId] || { extraPayments: {} };
          if (loan.type === 'revolving') results[loan.id] = calculateRevolvingLoan(loan.inputs, strategy.extraPayments);
          else results[loan.id] = calculateFixedLoan(loan.inputs, strategy.extraPayments);
      });
      return results;
  }, [activeScenario]);

  const activeLoanObjects = Object.values(activeScenario.data.loans).map(loan => {
    if (loan.active === false) return null;
    const calc = loanCalculations[loan.id];
    if (!calc) return null;
    const row = calc.schedule.find(r => r.date === currentMonthKey);
    if (!row) return null;
    return { id: loan.id, name: loan.name, type: loan.type, total: row.payment };
  }).filter(Boolean);

  const mortgageLoans = activeLoanObjects.filter(l => l.type === 'mortgage');
  const otherLoans = activeLoanObjects.filter(l => l.type !== 'mortgage');

  // TOTALS
  const calculateTotal = (arr) => arr.reduce((sum, item) => sum + (item.amount || 0), 0);
  const totalBills = calculateTotal(expenseData.bills);
  const totalHome = calculateTotal(expenseData.home);
  const totalLiving = calculateTotal(expenseData.living);
  const totalImpounds = calculateTotal(expenseData.impounds);
  const totalMortgageService = mortgageLoans.reduce((sum, item) => sum + item.total, 0);
  const totalDebtService = otherLoans.reduce((sum, item) => sum + item.total, 0);
  const totalOneOffsThisMonth = expenseData.oneOffs.filter(item => item.date === currentMonthKey).reduce((sum, item) => sum + item.amount, 0);

  const monthlyBurn = totalBills + totalHome + totalLiving + totalImpounds + totalMortgageService + totalDebtService;

  // Handlers
  const handleSaveProfile = () => {
      const type = activeTab;
      const activeProf = type === 'income' ? activeIncomeProfile : activeExpenseProfile;
      const data = type === 'income' ? incomeData : expenseData;
      if (activeProf && confirm(`Overwrite "${activeProf.name}" with current ${type} settings?`)) {
          actions.updateProfile(activeProf.profileId, data);
      }
  };
  const handleSaveAs = () => {
      const name = prompt(`Name for new ${activeTab} profile:`);
      if(name) actions.saveProfile(activeTab, name, activeTab === 'income' ? incomeData : expenseData);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      {/* HEADER */}
      <div className="bg-white border-b border-slate-200 px-8 py-6 shadow-sm z-10">
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="flex items-center gap-3">
                 <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Receipt /> Cash Flow Manager</h2>
            </div>
            <div className="flex items-center gap-4 mt-2">
                <div className="text-sm text-slate-500">Monthly Burn: <span className="text-xl font-bold text-red-500">${Math.round(monthlyBurn).toLocaleString()}</span></div>
                {/* Tab Switcher */}
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button onClick={() => setActiveTab('expenses')} className={`px-4 py-1 text-xs font-bold rounded-md transition-all ${activeTab === 'expenses' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Expenses</button>
                    <button onClick={() => setActiveTab('income')} className={`px-4 py-1 text-xs font-bold rounded-md transition-all ${activeTab === 'income' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Income</button>
                </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
             <ProfileMenu
                type={activeTab}
                activeProfileName={activeTab === 'income' ? (activeIncomeProfile?.name || "None") : (activeExpenseProfile?.name || "None")}
                onSave={handleSaveProfile}
                onSaveAs={handleSaveAs}
                onToggleMgr={() => setShowProfileMgr(!showProfileMgr)}
                showMgr={showProfileMgr}
             />
          </div>
        </div>

        {showProfileMgr && (
            <ProfileManager
                type={activeTab}
                profiles={store.profiles}
                sequence={activeScenario.data[activeTab].profileSequence || []}
                actions={actions}
                simulationDate={simulationDate}
                globalStartDateStr={globalStartDateStr}
            />
        )}
      </div>

      <div className="flex-1 overflow-auto p-8 max-w-4xl mx-auto w-full">
          {/* TOP SECTION: NET CASH FLOW SUMMARY */}
          <NetCashFlowSummary activeScenario={activeScenario} store={store} />

          {/* MAIN CONTENT AREA */}
          {activeTab === 'income' ? (
              <IncomeEditor editData={incomeData} actions={actions} globalStart={globalStart} />
          ) : (
              <ExpensesEditor
                 editData={expenseData}
                 actions={actions}
                 mortgageLoans={mortgageLoans}
                 otherLoans={otherLoans}
                 totalBills={totalBills}
                 totalHome={totalHome}
                 totalLiving={totalLiving}
                 totalImpounds={totalImpounds}
                 totalMortgageService={totalMortgageService}
                 totalDebtService={totalDebtService}
                 totalOneOffsThisMonth={totalOneOffsThisMonth}
                 activeScenario={activeScenario}
                 simulationDate={simulationDate}
              />
          )}
      </div>
    </div>
  );
}