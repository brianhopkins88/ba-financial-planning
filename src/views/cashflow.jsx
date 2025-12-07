// src/views/cashflow.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { isEqual } from 'lodash';
import {
  Plus, Trash2, Save, Receipt, ChevronDown, ChevronRight, Calendar,
  CheckSquare, Square, CreditCard, Pencil, Copy, Table, Palmtree,
  Settings, TrendingUp, Info, Cloud, CloudUpload, CheckCircle, AlertCircle, Link as LinkIcon
} from 'lucide-react';
import { parseISO, isAfter, format, addMonths, getYear } from 'date-fns';
import { calculateFixedLoan, calculateRevolvingLoan } from '../utils/loan_math';
import { runFinancialSimulation } from '../utils/financial_engine';
import {
  BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell
} from 'recharts';

// --- HELPER COMPONENTS (Unchanged) ---
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
            {total !== undefined && <span className="text-xs font-mono font-bold text-slate-600 bg-white px-2 py-1 rounded border border-slate-200 min-w-[80px] text-right">${total.toLocaleString()}</span>}
        </div>
      </div>
      {isOpen && <div className="p-4 bg-white border-t border-slate-100">{children}</div>}
    </div>
  );
};

// --- ANALYSIS TABLES (Unchanged) ---
const NetCashFlowSummary = ({ activeScenario, store }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const summaryData = useMemo(() => {
        const simulation = runFinancialSimulation(activeScenario, store.profiles);
        const annuals = simulation.timeline.filter(t => t.month === 12).map(t => ({
            year: t.year,
            netFlow: t.annualData.netCashFlow
        }));
        return annuals;
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
                                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '8px'}} formatter={(val, name) => [`$${Math.round(val).toLocaleString()}`, name === 'netFlow' ? 'Operating Net Flow' : name]} />
                                <ReferenceLine y={0} stroke="#94a3b8" />
                                <Bar dataKey="netFlow" radius={[4, 4, 4, 4]}>
                                    {summaryData.map((entry, index) => (<Cell key={index} fill={entry.netFlow >= 0 ? '#10b981' : '#ef4444'} />))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                     </div>
                 </div>
             )}
        </div>
    );
};

const CashFlowTable = ({ activeScenario, store }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const timeline = useMemo(() => {
        const sim = runFinancialSimulation(activeScenario, store.profiles);
        return sim.timeline.filter(t => t.month === 12);
    }, [activeScenario, store.profiles]);

    return (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm mb-6 overflow-hidden">
             <div className="p-4 bg-slate-700 text-white flex justify-between items-center cursor-pointer hover:bg-slate-600 transition-colors" onClick={() => setIsExpanded(!isExpanded)}>
                 <div className="flex items-center gap-2 font-bold">
                     <Table size={20} className="text-blue-300"/>
                     <span>Detailed Analysis Table (Annual)</span>
                 </div>
                 {isExpanded ? <ChevronDown size={18}/> : <ChevronRight size={18}/>}
             </div>
             {isExpanded && (
                 <div className="overflow-x-auto max-h-[600px]">
                     <table className="w-full text-xs text-left whitespace-nowrap">
                         <thead className="bg-slate-100 text-slate-500 font-bold uppercase sticky top-0 shadow-sm z-10">
                             <tr>
                                 <th className="px-3 py-3 border-b border-slate-200 text-slate-800">Year</th>
                                 <th className="px-3 py-3 border-b border-slate-200">Age</th>
                                 <th className="px-3 py-3 border-b border-slate-200 bg-blue-50/50 border-l border-blue-100 text-right">Employment</th>
                                 <th className="px-3 py-3 border-b border-slate-200 bg-blue-50/50 text-right">SS / Pension</th>
                                 <th className="px-3 py-3 border-b border-slate-200 bg-blue-50 border-r border-blue-100 text-right text-blue-700">Total Income</th>
                                 <th className="px-3 py-3 border-b border-slate-200 bg-red-50/50 border-l border-red-100 text-right">Bills</th>
                                 <th className="px-3 py-3 border-b border-slate-200 bg-red-50/50 text-right">Mrtg & Impounds</th>
                                 <th className="px-3 py-3 border-b border-slate-200 bg-red-50/50 text-right">Home</th>
                                 <th className="px-3 py-3 border-b border-slate-200 bg-red-50/50 text-right">Living</th>
                                 <th className="px-3 py-3 border-b border-slate-200 bg-red-50/50 text-right">Other Liab</th>
                                 <th className="px-3 py-3 border-b border-slate-200 bg-red-50/50 text-right">Extra Exp</th>
                                 <th className="px-3 py-3 border-b border-slate-200 bg-red-50 border-r border-red-100 text-right text-red-700">Total Exp</th>
                                 <th className="px-3 py-3 border-b border-slate-200 text-right font-bold">Operating Net Flow</th>
                             </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-100">
                             {timeline.map((row, i) => {
                                 const bd = row.annualData.breakdown;
                                 const totalInc = row.annualData.income;
                                 const totalExp = row.annualData.expenses;
                                 const netFlow = row.annualData.netCashFlow;

                                 return (
                                     <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                                         <td className="px-3 py-2 font-mono font-bold text-slate-600">{row.year}</td>
                                         <td className="px-3 py-2 text-slate-500">{row.age} / {row.spouseAge}</td>
                                         <td className="px-3 py-2 text-right text-slate-600 border-l border-slate-100 bg-blue-50/10">${Math.round(bd.income.employment).toLocaleString()}</td>
                                         <td className="px-3 py-2 text-right text-slate-600 bg-blue-50/10">${Math.round((bd.income.socialSecurity||0) + (bd.income.pension||0)).toLocaleString()}</td>
                                         <td className="px-3 py-2 text-right font-bold text-blue-600 border-r border-slate-100 bg-blue-50/20">${Math.round(totalInc).toLocaleString()}</td>
                                         <td className="px-3 py-2 text-right text-slate-600 border-l border-slate-100 bg-red-50/10">${Math.round(bd.expenses.bills).toLocaleString()}</td>
                                         <td className="px-3 py-2 text-right text-slate-600 bg-red-50/10">${Math.round(bd.expenses.impounds).toLocaleString()}</td>
                                         <td className="px-3 py-2 text-right text-slate-600 bg-red-50/10">${Math.round(bd.expenses.home).toLocaleString()}</td>
                                         <td className="px-3 py-2 text-right text-slate-600 bg-red-50/10">${Math.round(bd.expenses.living).toLocaleString()}</td>
                                         <td className="px-3 py-2 text-right text-slate-600 bg-red-50/10">${Math.round(bd.expenses.otherDebt).toLocaleString()}</td>
                                         <td className="px-3 py-2 text-right text-slate-600 bg-red-50/10">${Math.round(bd.expenses.extra).toLocaleString()}</td>
                                         <td className="px-3 py-2 text-right font-bold text-red-600 border-r border-slate-100 bg-red-50/20">${Math.round(totalExp).toLocaleString()}</td>
                                         <td className={`px-3 py-2 text-right font-bold ${netFlow >= 0 ? 'text-green-600' : 'text-red-500'}`}>${Math.round(netFlow).toLocaleString()}</td>
                                     </tr>
                                 );
                             })}
                         </tbody>
                     </table>
                 </div>
             )}
        </div>
    );
};

// --- SUB-MODULES ---

const IncomeEditor = ({ editData, actions, globalStart }) => {
    const workStatusYears = Array.from({ length: 15 }, (_, i) => globalStart.startYear + i);
    const workStatusMap = editData.workStatus || {};
    const spouseBirthYear = editData.spouse.birthYear || 1968;
    const sortedYears = Object.keys(workStatusMap).map(Number).sort((a,b) => a-b);
    let pensionStartYear = null;
    for (const y of sortedYears) { if (workStatusMap[y]?.spouse === 0) { pensionStartYear = y; break; } }
    const autoPensionAge = pensionStartYear ? (pensionStartYear - spouseBirthYear) : "N/A";

    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            {/* PERSONAL INCOME */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                <h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2">Personal Income Configuration</h3>
                <div className="grid grid-cols-2 gap-12">
                    {/* Primary */}
                    <div className="space-y-6 border-r border-slate-100 pr-6">
                        <div className="flex items-center justify-between">
                            <h4 className="font-bold text-blue-600 text-sm uppercase tracking-wider">Primary</h4>
                            <div className="flex gap-2">
                                <div className="w-20"><NumberInput label="Birth Year" value={editData.primary.birthYear} onChange={(v) => actions.updateScenarioData('income.primary.birthYear', v)} /></div>
                                <div className="w-32"><MonthSelect label="Birth Month" value={editData.primary.birthMonth} onChange={(v) => actions.updateScenarioData('income.primary.birthMonth', v)} /></div>
                            </div>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-lg space-y-4 border border-slate-100">
                            <NumberInput label="Net Annual Salary" value={editData.primary.netSalary} onChange={(v) => actions.updateScenarioData('income.primary.netSalary', v)} step="1000" />
                            <div className="grid grid-cols-2 gap-4">
                                <NumberInput label="Annual Bonus (Net)" value={editData.primary.bonus.amount} onChange={(v) => actions.updateScenarioData('income.primary.bonus.amount', v)} step="1000" />
                                <MonthSelect label="Payout Month" value={editData.primary.bonus.month} onChange={(v) => actions.updateScenarioData('income.primary.bonus.month', v)} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <NumberInput label="Gross (401k Calc)" value={editData.primary.grossForContrib} onChange={(v) => actions.updateScenarioData('income.primary.grossForContrib', v)} step="1000" />
                                <NumberInput label="401k Contrib Rate" value={editData.primary.contribPercent} onChange={(v) => actions.updateScenarioData('income.primary.contribPercent', v)} step="0.01" suffix="dec" />
                            </div>
                        </div>
                        <div className="bg-blue-50/50 p-4 rounded-lg space-y-4 border border-blue-100">
                             <div className="grid grid-cols-2 gap-4">
                                <NumberInput label="FICA Start Age" value={editData.primary.socialSecurity.startAge} onChange={(v) => actions.updateScenarioData('income.primary.socialSecurity.startAge', v)} />
                                <NumberInput label="FICA Monthly ($)" value={editData.primary.socialSecurity.monthlyAmount} onChange={(v) => actions.updateScenarioData('income.primary.socialSecurity.monthlyAmount', v)} step="100" />
                            </div>
                        </div>
                    </div>

                    {/* Spouse */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h4 className="font-bold text-purple-600 text-sm uppercase tracking-wider">Spouse</h4>
                            <div className="flex gap-2">
                                <div className="w-20"><NumberInput label="Birth Year" value={editData.spouse.birthYear} onChange={(v) => actions.updateScenarioData('income.spouse.birthYear', v)} /></div>
                                <div className="w-32"><MonthSelect label="Birth Month" value={editData.spouse.birthMonth} onChange={(v) => actions.updateScenarioData('income.spouse.birthMonth', v)} /></div>
                            </div>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-lg space-y-4 border border-slate-100">
                            <NumberInput label="Net Annual Salary" value={editData.spouse.netSalary} onChange={(v) => actions.updateScenarioData('income.spouse.netSalary', v)} step="1000" />
                            <div className="grid grid-cols-2 gap-4">
                                <NumberInput label="Annual Bonus (Net)" value={editData.spouse.bonus.amount} onChange={(v) => actions.updateScenarioData('income.spouse.bonus.amount', v)} step="1000" />
                                <MonthSelect label="Payout Month" value={editData.spouse.bonus.month} onChange={(v) => actions.updateScenarioData('income.spouse.bonus.month', v)} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <NumberInput label="Gross (401k Calc)" value={editData.spouse.grossForContrib} onChange={(v) => actions.updateScenarioData('income.spouse.grossForContrib', v)} step="1000" />
                                <NumberInput label="401k Contrib Rate" value={editData.spouse.contribPercent} onChange={(v) => actions.updateScenarioData('income.spouse.contribPercent', v)} step="0.01" suffix="dec" />
                            </div>
                        </div>
                        <div className="bg-purple-50/50 p-4 rounded-lg space-y-4 border border-purple-100">
                            <div className="grid grid-cols-2 gap-4">
                                <NumberInput label="FICA Start Age" value={editData.spouse.socialSecurity.startAge} onChange={(v) => actions.updateScenarioData('income.spouse.socialSecurity.startAge', v)} />
                                <NumberInput label="FICA Monthly ($)" value={editData.spouse.socialSecurity.monthlyAmount} onChange={(v) => actions.updateScenarioData('income.spouse.socialSecurity.monthlyAmount', v)} step="100" />
                            </div>
                            <div className="h-px bg-purple-100 my-2"></div>
                             <div className="flex items-center justify-between"><label className="text-xs font-bold text-purple-500 uppercase">Pension</label><span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-1 rounded">Starts Age: {autoPensionAge}</span></div>
                             <NumberInput label="Monthly Amount" value={editData.spouse.pension.monthlyAmount} onChange={(v) => actions.updateScenarioData('income.spouse.pension.monthlyAmount', v)} step="100" />
                        </div>
                    </div>
                </div>
            </div>

            {/* WORK STATUS */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                <h3 className="font-bold text-slate-700 mb-4">Work Status Trajectory (FTE 0.0 - 1.0)</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50"><tr><th className="px-4 py-2">Year</th><th className="px-4 py-2 text-blue-600">Primary FTE</th><th className="px-4 py-2 text-purple-600">Spouse FTE</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                            {workStatusYears.map((year) => {
                                const status = editData.workStatus?.[year] || { primary: 0, spouse: 0 };
                                return (
                                    <tr key={year}>
                                        <td className="px-4 py-2 font-bold text-slate-600">{year}</td>
                                        <td className="px-4 py-2"><input type="number" step="0.1" max="1.0" min="0.0" className="w-20 border rounded px-2 py-1" value={status.primary} onChange={(e) => actions.updateScenarioData(`income.workStatus.${year}.primary`, parseFloat(e.target.value) || 0)} /></td>
                                        <td className="px-4 py-2"><input type="number" step="0.1" max="1.0" min="0.0" className="w-20 border rounded px-2 py-1" value={status.spouse} onChange={(e) => actions.updateScenarioData(`income.workStatus.${year}.spouse`, parseFloat(e.target.value) || 0)} /></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const FutureExpensesModule = ({ oneOffs, onChange, onAdd, onDelete, activeScenario, actions, retirementBrackets, adjustFunMoney }) => {
    // Extract extra payments from Loan Strategies for display
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
                    payments.push({ id: `loan-${loan.id}-${date}`, date: date, name: `Extra Principal: ${loan.name}`, amount: amount, isLocked: true });
                }
            });
        });
        return payments;
    }, [activeScenario]);

    const mergedData = [...oneOffs, ...debtPayments].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
    const brackets = [65, 70, 75, 80, 85, 90];

    return (
        <div className="mt-2 space-y-6">
            <div>
                <div className="flex justify-between mb-2"><div className="text-xs font-bold text-slate-500 uppercase">One-Off & Planned Items</div><button onClick={onAdd} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 flex items-center gap-1 font-bold shadow-sm"><Plus size={12}/> Add Item</button></div>
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                     <table className="w-full text-sm text-left">
                         <thead className="bg-slate-50 text-xs text-slate-500 uppercase font-semibold border-b border-slate-200"><tr><th className="px-4 py-3 w-32">Date</th><th className="px-4 py-3">Description</th><th className="px-4 py-3 text-right">Amount</th><th className="w-10"></th></tr></thead>
                         <tbody className="divide-y divide-slate-100">
                             {mergedData.map((item, idx) => (
                                 <tr key={item.id || idx} className={item.isLocked ? 'bg-slate-50/50 italic text-slate-500' : 'hover:bg-blue-50/30'}>
                                     <td className="p-2">{item.isLocked ? <span className="pl-2 font-mono text-xs">{item.date}</span> : <input type="month" className="w-full border-slate-200 rounded text-xs py-1" value={item.date || ''} onChange={(e) => onChange(item.id, 'date', e.target.value)} />}</td>
                                     <td className="p-2">{item.isLocked ? <div className="flex items-center gap-2 pl-2"><CreditCard size={12} className="text-slate-400"/><span>{item.name}</span></div> : <input type="text" className="w-full bg-transparent px-2 py-1" value={item.name} onChange={(e) => onChange(item.id, 'name', e.target.value)} />}</td>
                                     <td className="p-2 text-right">{item.isLocked ? <span className="pr-2 font-bold">${item.amount.toLocaleString()}</span> : <input type="number" className="w-full text-right bg-transparent px-2 py-1 font-bold" value={item.amount} onChange={(e) => onChange(item.id, 'amount', parseFloat(e.target.value))} />}</td>
                                     <td className="p-2 text-center">{!item.isLocked && <button onClick={() => onDelete(item.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={14}/></button>}</td>
                                 </tr>
                             ))}
                         </tbody>
                     </table>
                </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-3">
                        <Palmtree className="text-blue-500 mt-1" />
                        <div>
                            <h4 className="font-bold text-blue-700 text-sm">Long Term Fun Money (Retirement)</h4>
                            <p className="text-xs text-slate-500">Specify annual budget for travel/holidays by 5-year age brackets (starts at Age 65).</p>
                        </div>
                    </div>

                    {/* --- ADDED TOGGLE SWITCH --- */}
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <span className="text-xs font-bold text-slate-500 uppercase">Inflation Adj?</span>
                        <div className="relative">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={adjustFunMoney !== false} // Default to Checked (true) if undefined
                                onChange={(e) => actions.updateScenarioData('expenses.adjustFunMoney', e.target.checked)}
                            />
                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                        </div>
                    </label>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {brackets.map(age => (
                        <div key={age} className="bg-white p-2 rounded border border-slate-200 shadow-sm">
                            <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Age {age}-{age+4}</div>
                            <div className="relative"><span className="absolute left-2 top-1.5 text-slate-400 text-xs">$</span><input type="number" step="1000" className="w-full pl-4 pr-1 py-1 text-sm font-mono font-bold text-slate-700 border border-slate-100 rounded focus:ring-1 focus:ring-blue-500 outline-none" value={retirementBrackets[age] || ''} placeholder="0" onChange={(e) => actions.updateScenarioData(`expenses.retirementBrackets.${age}`, parseFloat(e.target.value) || 0)} /></div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const ExpensesEditor = ({ editData, actions, mortgageLoans, otherLoans, totalBills, totalHome, totalLiving, totalImpounds, totalMortgageService, totalDebtService, totalOneOffsThisMonth, activeScenario, simulationDate }) => {
    const updateBill = (category, index, field, value) => { const list = [...editData[category]]; list[index] = { ...list[index], [field]: value }; actions.updateScenarioData(`expenses.${category}`, list); };
    const addBill = (category) => { const list = [...editData[category]]; list.push({ id: Date.now(), name: "New Item", amount: 0 }); actions.updateScenarioData(`expenses.${category}`, list); };
    const removeBill = (category, index) => { const list = [...editData[category]]; list.splice(index, 1); actions.updateScenarioData(`expenses.${category}`, list); };

    const addFuture = () => { const list = [...editData.oneOffs]; list.push({ id: Date.now(), date: format(simulationDate, 'yyyy-MM'), name: 'New Expense', amount: 0 }); actions.updateScenarioData('expenses.oneOffs', list); };
    const updateFuture = (id, f, v) => { const list = editData.oneOffs.map(i => i.id === id ? { ...i, [f]: v } : i); actions.updateScenarioData('expenses.oneOffs', list); };
    const removeFuture = (id) => { const list = editData.oneOffs.filter(i => i.id !== id); actions.updateScenarioData('expenses.oneOffs', list); };

    const toggleLoanLink = (loanId) => {
        let currentLinks = editData.linkedLoanIds;
        if (!currentLinks) {
            const allActiveIds = Object.values(activeScenario.data.loans).filter(l => l.active).map(l => l.id);
            currentLinks = allActiveIds;
        }
        let newLinks;
        if (currentLinks.includes(loanId)) {
            newLinks = currentLinks.filter(id => id !== loanId);
        } else {
            newLinks = [...currentLinks, loanId];
        }
        actions.updateScenarioData('expenses.linkedLoanIds', newLinks);
    };

    const isLoanLinked = (loanId) => {
        if (!editData.linkedLoanIds) return true;
        return editData.linkedLoanIds.includes(loanId);
    };

    const retirementBrackets = editData.retirementBrackets || {};
    const adjustFunMoney = editData.adjustFunMoney;

    return (
        <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
            <Accordion title="Recurring Bills" total={totalBills} defaultOpen={true} onAdd={() => addBill('bills')}>
                <div className="space-y-1">{editData.bills.map((item, idx) => (<BillRow key={idx} item={item} onChange={(f, v) => updateBill('bills', idx, f, v)} onDelete={() => removeBill('bills', idx)} />))}</div>
            </Accordion>

            <Accordion title="Mortgage & Impounds" total={totalMortgageService + totalImpounds} defaultOpen={true} onAdd={() => addBill('impounds')}>
                <div className="space-y-1">
                    {mortgageLoans.map(loan => {
                        const linked = isLoanLinked(loan.id);
                        return (
                            <div key={loan.id} className={`flex items-center gap-3 p-2 border-b border-slate-50 rounded mb-1 transition-colors ${linked ? 'bg-blue-50/50' : 'opacity-60 bg-slate-50'}`}>
                                <input
                                    type="checkbox"
                                    checked={linked}
                                    onChange={() => toggleLoanLink(loan.id)}
                                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                                />
                                <div className="flex-1 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <CreditCard size={14} className={linked ? "text-blue-500" : "text-slate-400"}/>
                                        <span className={`text-sm font-bold ${linked ? 'text-blue-700' : 'text-slate-500'}`}>{loan.name}</span>
                                    </div>
                                    <span className={`font-mono text-sm font-bold ${linked ? 'text-blue-700' : 'text-slate-400'}`}>
                                        ${loan.total.toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                    {editData.impounds.map((item, idx) => (<BillRow key={idx} item={item} onChange={(f, v) => updateBill('impounds', idx, f, v)} onDelete={() => removeBill('impounds', idx)} />))}
                </div>
            </Accordion>

            <Accordion title="Home Expenses" total={totalHome} defaultOpen={false} onAdd={() => addBill('home')}><div className="space-y-1">{editData.home.map((item, idx) => (<BillRow key={idx} item={item} onChange={(f, v) => updateBill('home', idx, f, v)} onDelete={() => removeBill('home', idx)} />))}</div></Accordion>
            <Accordion title="Living Expenses" total={totalLiving} defaultOpen={false} onAdd={() => addBill('living')}><div className="space-y-1">{editData.living.map((item, idx) => (<BillRow key={idx} item={item} onChange={(f, v) => updateBill('living', idx, f, v)} onDelete={() => removeBill('living', idx)} />))}</div></Accordion>

            <Accordion title="Other Liabilities" total={totalDebtService} defaultOpen={false}>
                <div className="space-y-0.5">
                    {otherLoans.length === 0 && <div className="text-sm text-slate-400 italic p-2">No other active loans found.</div>}
                    {otherLoans.map(loan => {
                        const linked = isLoanLinked(loan.id);
                        return (
                            <div key={loan.id} className={`flex items-center gap-3 py-2 px-2 border-b border-slate-50 rounded transition-colors ${linked ? 'hover:bg-slate-50' : 'opacity-60'}`}>
                                <input
                                    type="checkbox"
                                    checked={linked}
                                    onChange={() => toggleLoanLink(loan.id)}
                                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                                />
                                <div className="flex-1 flex items-center justify-between">
                                    <span className={`text-sm font-bold ${linked ? 'text-slate-700' : 'text-slate-500'}`}>{loan.name}</span>
                                    <span className={`font-mono text-sm font-bold ${linked ? 'text-slate-700' : 'text-slate-400'}`}>${loan.total.toLocaleString()}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Accordion>

            <Accordion title="Extra Expense Planning" total={totalOneOffsThisMonth} defaultOpen={false}>
                <FutureExpensesModule
                    oneOffs={editData.oneOffs}
                    onAdd={addFuture}
                    onChange={updateFuture}
                    onDelete={removeFuture}
                    activeScenario={activeScenario}
                    actions={actions}
                    retirementBrackets={retirementBrackets}
                    adjustFunMoney={adjustFunMoney}
                />
            </Accordion>
        </div>
    );
};

// --- PROFILE MANAGER ---

const ProfileMenu = ({ type, availableProfiles, editingProfileId, isDirty, onSwitchProfile, onSave, onSaveAs, onUpdateDescription, onToggleMgr, showMgr }) => {
    const [isOpen, setIsOpen] = useState(false);
    const editingProfile = availableProfiles.find(p => p.id === editingProfileId);
    const editingName = editingProfile?.name || "Unsaved Draft";
    const description = editingProfile?.description || "";

    return (
        <div className="flex items-center gap-2">
            <div className="relative">
                <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2 text-xs font-bold px-3 py-2 rounded bg-white border border-slate-200 text-slate-700 hover:border-blue-400 hover:text-blue-600 transition-all shadow-sm">
                    <Settings size={14} />
                    <span className="max-w-[120px] truncate">{editingName}</span>
                    <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}/>
                </button>
                {isOpen && (
                    <>
                        <div className="fixed inset-0 z-20" onClick={() => setIsOpen(false)}></div>
                        <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-lg shadow-xl z-30 overflow-hidden">
                             {/* DESCRIPTION BLOCK */}
                             {editingProfileId && (
                                 <div className="p-3 bg-slate-50 border-b border-slate-100">
                                     <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Description</label>
                                     <textarea
                                        className="w-full text-xs text-slate-600 bg-white border border-slate-200 rounded p-2 focus:border-blue-400 outline-none resize-none h-16"
                                        placeholder="Describe this profile..."
                                        value={description}
                                        onChange={(e) => onUpdateDescription(editingProfileId, e.target.value)}
                                     />
                                 </div>
                             )}

                             <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Load / Edit Profile</div>
                             <div className="max-h-48 overflow-y-auto">
                                {availableProfiles.length === 0 && <div className="px-4 py-2 text-xs text-slate-400 italic">No saved profiles.</div>}
                                {availableProfiles.map(p => (
                                    <button key={p.id} onClick={() => { onSwitchProfile(p.id); setIsOpen(false); }} className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between hover:bg-slate-50 ${p.id === editingProfileId ? 'text-blue-700 font-bold bg-blue-50/50' : 'text-slate-600'}`}>
                                        <span className="truncate">{p.name}</span>
                                        {p.id === editingProfileId && <CheckSquare size={14}/>}
                                    </button>
                                ))}
                             </div>

                             <div className="h-px bg-slate-100 my-1"></div>
                             <button onClick={() => { onSaveAs(); setIsOpen(false); }} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3"><Copy size={16} className="text-slate-500"/> Save as New Profile...</button>
                             <button onClick={() => { onToggleMgr(); setIsOpen(false); }} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3"><Calendar size={16} className={showMgr ? "text-blue-600" : "text-slate-500"}/> {showMgr ? "Hide Timeline" : "Manage Timeline"}</button>
                        </div>
                    </>
                )}
            </div>

            {/* SYNC INDICATOR & SAVE ACTION */}
            {editingProfileId && (
                <div className="flex items-center">
                     {isDirty ? (
                         <button
                             onClick={onSave}
                             className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-wider hover:bg-amber-200 transition-colors shadow-sm animate-in fade-in"
                             title="Local changes are not saved to master profile"
                         >
                            <AlertCircle size={12}/> Unsaved Changes
                         </button>
                     ) : (
                         <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase tracking-wider border border-emerald-100 shadow-sm" title="Synced with master profile">
                            <CheckCircle size={12}/> Synced
                         </div>
                     )}
                </div>
            )}
        </div>
    );
};

const ProfileManager = ({ type, profiles, sequence, actions, globalStartDateStr }) => {
    const availableProfiles = Object.values(profiles).filter(p => p.type === type);
    const handleToggle = (pId, active, date) => {
      if (date < globalStartDateStr) { alert(`Profile cannot start before scenario start date (${globalStartDateStr}).`); return; }
      actions.toggleProfileInScenario(type, pId, active, date);
    };
    const handleRename = (pId, cName) => { const n = prompt("New name:", cName); if (n && n !== cName) actions.renameProfile(pId, n); };
    const handleDelete = (pId, name) => { if(confirm(`Delete "${name}"?`)) actions.deleteProfile(pId); };

    return (
        <div className="mb-6 bg-slate-50 rounded-lg border border-slate-200 p-4">
             <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase">{type} Profile Sequence</h3>
                <div className="text-[10px] text-slate-400 italic">Latest start date supersedes older ones</div>
             </div>
             <div className="space-y-2">
                 {availableProfiles.length === 0 && <div className="text-sm text-slate-400 italic">No saved profiles found.</div>}
                 {availableProfiles.map(p => {
                     const seqEntry = sequence.find(s => s.profileId === p.id);
                     const isActive = seqEntry?.isActive;
                     const startDate = seqEntry?.startDate || globalStartDateStr;
                     return (
                         <div key={p.id} className="flex items-center gap-4 bg-white p-2 rounded border border-slate-100 shadow-sm group">
                             <button onClick={() => handleToggle(p.id, !isActive, startDate)} className={`p-1 rounded ${isActive ? 'text-blue-600' : 'text-slate-300 hover:text-slate-400'}`}>{isActive ? <CheckSquare size={20} /> : <Square size={20} />}</button>
                             <div className="flex-1 flex items-center gap-2"><div className="text-sm font-bold text-slate-700">{p.name}</div><button onClick={() => handleRename(p.id, p.name)} className="p-1 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"><Pencil size={14} /></button></div>
                             <div className="flex items-center gap-2"><span className="text-xs text-slate-400 uppercase">Start:</span><input type="date" className={`text-sm border rounded px-2 py-1 outline-none focus:border-blue-500 ${!isActive ? 'text-slate-400 bg-slate-50' : 'text-slate-700 font-bold'}`} value={startDate} disabled={!isActive} min={globalStartDateStr} onChange={(e) => handleToggle(p.id, true, e.target.value)} /></div>
                             {!isActive && (<button onClick={() => handleDelete(p.id, p.name)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"><Trash2 size={16} /></button>)}
                         </div>
                     );
                 })}
             </div>
        </div>
    );
};

// --- MAIN CASH FLOW COMPONENT ---

export default function CashFlow() {
  const { store, activeScenario, actions, simulationDate } = useData();
  const [activeTab, setActiveTab] = useState('expenses'); // 'income' | 'expenses'
  const [showProfileMgr, setShowProfileMgr] = useState(false);

  // State to track which profile ID is currently "Loaded" in the editor
  const [editingProfileId, setEditingProfileId] = useState(null);

  // Data Loading
  const incomeData = activeScenario.data.income;
  const expenseData = activeScenario.data.expenses;
  // Ensure defaults
  if (!expenseData.oneOffs) expenseData.oneOffs = [];
  if (!expenseData.impounds) expenseData.impounds = [];
  if (!expenseData.retirementBrackets) expenseData.retirementBrackets = {};

  const assumptions = activeScenario.data.assumptions || activeScenario.data.globals || {};
  const globalStart = assumptions.timing || { startYear: 2026, startMonth: 1 };
  const globalStartDateStr = `${globalStart.startYear}-${String(globalStart.startMonth).padStart(2, '0')}-01`;

  // Determine which profile is *Active in the Timeline* for the current date
  const timelineActiveProfile = useMemo(() => {
      const seq = activeScenario.data[activeTab].profileSequence || [];
      const activeItems = seq.filter(item => item.isActive && !isAfter(parseISO(item.startDate), simulationDate));
      if (activeItems.length === 0) return null;
      activeItems.sort((a, b) => b.startDate.localeCompare(a.startDate));
      const effectiveItem = activeItems[0];
      return store.profiles[effectiveItem.profileId] ? { ...store.profiles[effectiveItem.profileId], ...effectiveItem } : null;
  }, [activeScenario, activeTab, simulationDate, store.profiles]);

  // Sync editingProfileId to timeline active profile IF user hasn't manually switched (or on first load)
  useEffect(() => {
      if (timelineActiveProfile && editingProfileId === null) {
          setEditingProfileId(timelineActiveProfile.id);
      }
  }, [timelineActiveProfile]);

  // Also reset editing ID when tab changes to avoid carrying over state
  useEffect(() => { setEditingProfileId(null); }, [activeTab]);

  // --- DIRTY CHECKING LOGIC ---
  const isDirty = useMemo(() => {
      if (!editingProfileId) return false;
      const masterProfile = store.profiles[editingProfileId];
      if (!masterProfile) return false;

      // Extract current editor state, stripping out 'profileSequence' which belongs to Scenario
      const currentEditorState = activeTab === 'income' ? incomeData : expenseData;
      const { profileSequence, ...cleanEditorState } = currentEditorState;

      // Compare with Master Profile Data
      return !isEqual(cleanEditorState, masterProfile.data);
  }, [editingProfileId, store.profiles, activeTab, incomeData, expenseData]);


  // Load Loans for Payment Calculation for the Editor
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

  const calculateTotal = (arr) => arr.reduce((sum, item) => sum + (item.amount || 0), 0);
  const totalBills = calculateTotal(expenseData.bills);
  const totalHome = calculateTotal(expenseData.home);
  const totalLiving = calculateTotal(expenseData.living);
  const totalImpounds = calculateTotal(expenseData.impounds);

  const getLinkedTotal = (loans) => {
      const links = expenseData.linkedLoanIds;
      // Default to ALL if undefined
      if (!links) return loans.reduce((s,i) => s+i.total, 0);
      return loans.filter(l => links.includes(l.id)).reduce((s,i) => s+i.total, 0);
  };

  const totalMortgageService = getLinkedTotal(mortgageLoans);
  const totalDebtService = getLinkedTotal(otherLoans);

  const totalOneOffsThisMonth = expenseData.oneOffs.filter(item => item.date === currentMonthKey).reduce((sum, item) => sum + item.amount, 0);
  const monthlyBurn = totalBills + totalHome + totalLiving + totalImpounds + totalMortgageService + totalDebtService;

  // --- ACTIONS ---

  const saveToMaster = () => {
      if (editingProfileId) {
          const currentData = activeTab === 'income' ? incomeData : expenseData;
          const { profileSequence, ...cleanData } = currentData;
          actions.updateProfile(editingProfileId, cleanData);
      }
  };

  const handleUpdateDescription = (profileId, newDesc) => {
      // We need to update the description property on the profile object, NOT in the 'data' block
      // This requires a new action or manual update logic
      // Assuming 'updateProfile' only updates 'data', we need to check DataContext
      // Looking at DataContext: updateProfile updates .data.
      // I need to add an action to update metadata like description.
      // But I can cheat by updating the whole object if store structure allows, or add a specific action.
      // Let's assume I need to add 'updateProfileMeta' to DataContext later.
      // For now, I'll direct update via existing mechanisms if possible or add logic.
      // Actually, I'll add 'updateProfileMeta' to DataContext in step 7.
      actions.updateProfileMeta(profileId, { description: newDesc });
  };

  const handleSwitchProfile = (newId) => {
      if (isDirty) {
          saveToMaster();
      }

      // Load New Data
      const targetProfile = store.profiles[newId];
      if (targetProfile) {
          const mergedData = {
              ...targetProfile.data,
              profileSequence: activeScenario.data[activeTab].profileSequence
          };
          actions.updateScenarioData(activeTab, mergedData);
          setEditingProfileId(newId);
      }
  };

  const handleSaveAs = () => {
      const name = prompt(`Name for new ${activeTab} profile:`);
      if(name) {
          actions.saveProfile(activeTab, name, activeTab === 'income' ? incomeData : expenseData);
      }
  };

  // Available profiles for the menu
  const availableProfiles = Object.values(store.profiles).filter(p => p.type === activeTab);

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
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button onClick={() => setActiveTab('expenses')} className={`px-4 py-1 text-xs font-bold rounded-md transition-all ${activeTab === 'expenses' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Expenses</button>
                    <button onClick={() => setActiveTab('income')} className={`px-4 py-1 text-xs font-bold rounded-md transition-all ${activeTab === 'income' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Income</button>
                </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
             <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Editing:</span>
                <ProfileMenu
                    type={activeTab}
                    availableProfiles={availableProfiles}
                    editingProfileId={editingProfileId}
                    isDirty={isDirty}
                    onSwitchProfile={handleSwitchProfile}
                    onSave={saveToMaster}
                    onSaveAs={handleSaveAs}
                    onUpdateDescription={handleUpdateDescription}
                    onToggleMgr={() => setShowProfileMgr(!showProfileMgr)}
                    showMgr={showProfileMgr}
                />
             </div>
             {editingProfileId && editingProfileId !== timelineActiveProfile?.id && (
                 <div className="text-[10px] text-orange-500 bg-orange-50 px-2 py-1 rounded border border-orange-100 flex items-center gap-1">
                    <Info size={10}/> Not active in timeline for {format(simulationDate, 'MMM yyyy')}
                 </div>
             )}
          </div>
        </div>
        {showProfileMgr && (
            <ProfileManager
                type={activeTab}
                profiles={store.profiles}
                sequence={activeScenario.data[activeTab].profileSequence || []}
                actions={actions}
                globalStartDateStr={globalStartDateStr}
            />
        )}
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-auto p-8 max-w-6xl mx-auto w-full">
          <NetCashFlowSummary activeScenario={activeScenario} store={store} />
          <CashFlowTable activeScenario={activeScenario} store={store} />

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