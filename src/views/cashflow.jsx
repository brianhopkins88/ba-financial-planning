// src/views/cashflow.jsx
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useData } from '../context/DataContext';
import { isEqual } from 'lodash';
import {
  Plus, Trash2, Receipt, ChevronDown, ChevronRight, Calendar,
  CheckSquare, Square, CreditCard, Pencil, Copy, Table, Palmtree,
  Settings, TrendingUp, Info, CheckCircle, AlertCircle
} from 'lucide-react';
import { parseISO, isAfter, isValid, format, differenceInMonths } from 'date-fns';
import { calculateFixedLoan, calculateRevolvingLoan } from '../utils/loan_math';
import { runFinancialSimulation } from '../utils/financial_engine';
import {
  BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell
} from 'recharts';
import { TooltipHelp } from '../components/TooltipHelp';

// --- HELPER COMPONENTS (Unchanged) ---
const NumberInput = ({ label, value, onChange, step = "1", suffix, helpText }) => (
  <div className="flex flex-col space-y-1">
    <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
      {label} {helpText && <span className="text-[10px] text-slate-400 normal-case">{helpText}</span>}
    </label>
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

const Accordion = ({ title, total, children, defaultOpen = false, onAdd, open, onToggle }) => {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = typeof open === 'boolean';
  const isOpen = isControlled ? open : internalOpen;
  const toggle = () => {
    if (isControlled && onToggle) onToggle(!open);
    else setInternalOpen(!internalOpen);
  };
  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden mb-4">
      <div className="flex items-center justify-between p-4 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors" onClick={toggle}>
        <div className="flex items-center gap-2 font-bold text-slate-700">{isOpen ? <ChevronDown size={18}/> : <ChevronRight size={18}/>}{title}</div>
        <div className="flex items-center gap-4">
            {onAdd && (<button onClick={(e) => { e.stopPropagation(); onAdd(); }} className="text-slate-400 hover:text-blue-600 transition-colors"><Plus size={16}/></button>)}
            {total !== undefined && <span className="text-xs font-mono font-bold text-slate-600 bg-white px-2 py-1 rounded border border-slate-200 min-w-[80px] text-right">${total.toLocaleString()}</span>}
            <span className="text-[10px] text-slate-400">Editable list; totals auto-update</span>
        </div>
      </div>
      {isOpen && <div className="p-4 bg-white border-t border-slate-100">{children}</div>}
    </div>
  );
};

const MonthPicker = ({ value, onChange }) => {
  const safeVal = value || format(new Date(), 'yyyy-MM');
  return (
    <div className="flex items-center gap-2">
      <input
        type="month"
        className="border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
        value={safeVal}
        onChange={(e) => onChange(e.target.value)}
      />
      <input
        type="text"
        pattern="\\d{4}-\\d{2}"
        className="border border-slate-200 rounded px-2 py-2 text-xs text-slate-600 focus:ring-2 focus:ring-blue-500"
        value={safeVal}
        onChange={(e) => onChange(e.target.value)}
        placeholder="YYYY-MM"
      />
    </div>
  );
};

// --- ANALYSIS TABLES (Unchanged) ---
const NetCashFlowSummary = ({ activeScenario, store, simulation }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const summaryData = useMemo(() => {
        const sim = simulation || runFinancialSimulation(activeScenario, store.profiles);
        const annuals = sim.timeline.filter(t => t.month === 12).map(t => ({
            year: t.year,
            netFlow: t.annualData.netCashFlow
        }));
        return annuals;
    }, [activeScenario, store.profiles, simulation]);

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

const CashFlowTable = ({ activeScenario, store, simulation }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const timeline = useMemo(() => {
        const sim = simulation || runFinancialSimulation(activeScenario, store.profiles);
        return sim.timeline.filter(t => t.month === 12);
    }, [activeScenario, store.profiles, simulation]);

    return (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm mb-6 overflow-hidden">
             <div className="p-4 bg-slate-700 text-white flex justify-between items-center cursor-pointer hover:bg-slate-600 transition-colors" onClick={() => setIsExpanded(!isExpanded)}>
                 <div className="flex items-center gap-2 font-bold">
                     <Table size={20} className="text-blue-300"/>
                     <span>Detailed Analysis Table (Annual)</span>
                 </div>
                 <div className="text-[10px] uppercase text-blue-100 flex items-center gap-1">
                    <TooltipHelp text="Net flow excludes asset appreciation; see ledger for monthly detail." />
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
                                 <th className="px-3 py-3 border-b border-slate-200 bg-red-50/50 text-right">Home: Mortgage+Imp</th>
                                 <th className="px-3 py-3 border-b border-slate-200 bg-red-50/50 text-right">Home: HOA/Maint</th>
                                 <th className="px-3 py-3 border-b border-slate-200 bg-red-50/50 text-right">Home Subtotal</th>
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
                                 const homeMortgage = bd.expenses.homeMortgage || 0;
                                 const homeImpounds = bd.expenses.homeImpounds || 0;
                                 const homeOther = bd.expenses.homeOther || 0;
                                 const homeSubtotal = bd.expenses.home || (homeMortgage + homeImpounds + homeOther);

                                 return (
                                     <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                                         <td className="px-3 py-2 font-mono font-bold text-slate-600">{row.year}</td>
                                         <td className="px-3 py-2 text-slate-500">{row.age} / {row.spouseAge}</td>
                                         <td className="px-3 py-2 text-right text-slate-600 border-l border-slate-100 bg-blue-50/10">${Math.round(bd.income.employment).toLocaleString()}</td>
                                         <td className="px-3 py-2 text-right text-slate-600 bg-blue-50/10">${Math.round((bd.income.socialSecurity||0) + (bd.income.pension||0)).toLocaleString()}</td>
                                         <td className="px-3 py-2 text-right font-bold text-blue-600 border-r border-slate-100 bg-blue-50/20">${Math.round(totalInc).toLocaleString()}</td>
                                         <td className="px-3 py-2 text-right text-slate-600 border-l border-slate-100 bg-red-50/10">${Math.round(bd.expenses.bills).toLocaleString()}</td>
                                         <td className="px-3 py-2 text-right text-slate-600 bg-red-50/10">${Math.round(homeMortgage + homeImpounds).toLocaleString()}</td>
                                         <td className="px-3 py-2 text-right text-slate-600 bg-red-50/10">${Math.round(homeOther).toLocaleString()}</td>
                                         <td className="px-3 py-2 text-right text-slate-600 bg-red-50/10">${Math.round(homeSubtotal).toLocaleString()}</td>
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

const MonthlyBurnPanel = ({ activeScenario, store, simulation, monthValue, propertyCosts, onDrill }) => {
    const sim = useMemo(() => simulation || runFinancialSimulation(activeScenario, store.profiles, store.registry), [activeScenario, store.profiles, store.registry, simulation]);
    const timeline = sim.timeline || [];
    const registryAssets = store.registry?.assets || {};

    const selected = useMemo(() => {
        if (!monthValue || monthValue.length < 7) return null;
        return timeline.find(t => `${t.year}-${String(t.month).padStart(2, '0')}` === monthValue) || timeline[0];
    }, [timeline, monthValue]);

    const formatMoney = (v) => `$${Math.round(v || 0).toLocaleString()}`;
    const homeFixed = (selected?.monthlyBurn?.homeMortgage || 0) + (selected?.monthlyBurn?.homeImpounds || 0);
    const homeOther = selected?.monthlyBurn?.homeOther || 0;
    const homeTotal = selected?.monthlyBurn?.home || (homeFixed + homeOther);
    const Row = ({ label, value, drillKey, accent }) => (
        <div className="flex justify-between text-sm items-center">
            <div className="flex items-center gap-2">
                <span className="text-slate-500">{label}</span>
                {onDrill && drillKey && (
                    <button
                        onClick={() => onDrill(drillKey)}
                        className="text-[10px] uppercase font-bold text-blue-600 hover:underline"
                    >
                        Edit
                    </button>
                )}
            </div>
            <span className={`font-bold ${accent || 'text-slate-800'}`}>{formatMoney(value)}</span>
        </div>
    );

    const housingContext = () => {
        const propertyNames = Object.values(registryAssets).filter(a => a.type === 'property').map(a => a.name);
        const anyProperty = propertyNames.length > 0;
        if (!selected) return 'Unknown';
        if (selected.monthlyBurn?.home > 0 && anyProperty) return 'Own – Active Property';
        return 'Rent / No Primary Home';
    };
    const safePropertyCosts = propertyCosts || { totals: { mortgage: 0, impounds: 0, other: 0 }, details: [] };
    if (!selected) return null;

    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 mb-6">
        <div className="mb-2">
            <div className="text-xs font-bold uppercase text-slate-500">Monthly Burn (Single Month)</div>
            <div className="text-sm text-slate-500">Breakdown for {monthValue}</div>
            <div className="text-[11px] text-slate-400">Profiles and properties set above; click Edit to jump into the category below.</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded p-4 space-y-2">
                <Row label="Recurring Bills & Living" value={selected.monthlyBurn?.recurring} drillKey="recurring" />
                <Row label="Home: Mortgage + Impounds" value={homeFixed} drillKey="homeFixed" />
                <Row label="Home: HOA / Maintenance" value={homeOther} drillKey="homeOther" />
                <div className="flex justify-between text-sm border-t border-slate-200 pt-2">
                    <span className="text-slate-600 font-semibold">Home Subtotal</span>
                    <span className="font-bold text-slate-800">{formatMoney(homeTotal)}</span>
                </div>
                <Row label="Healthcare" value={selected.monthlyBurn?.healthcare} accent="text-slate-800" drillKey="living" />
                <Row label="Other Liabilities" value={selected.monthlyBurn?.otherLiabilities} drillKey="debt" />
                <Row label="Planned Discretionary" value={selected.monthlyBurn?.discretionary} drillKey="extras" />
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded p-4 space-y-2">
                <div className="text-xs font-bold uppercase text-slate-500">Context</div>
                <div className="text-sm text-slate-600">Housing: {housingContext()}</div>
                <div className="text-sm text-slate-600">Net Flow: {formatMoney(selected.netCashFlow)}</div>
                <div className="text-sm text-slate-600">Total Expenses: {formatMoney(selected.expenses)}</div>
                <div className="text-sm text-slate-600">Total Income: {formatMoney(selected.income)}</div>
                <div className="pt-2 border-t border-slate-200">
                    <div className="text-[11px] uppercase text-slate-500 font-bold mb-1">Property Costs (from Assets)</div>
                    {safePropertyCosts.details.length === 0 && <div className="text-xs text-slate-400">No active property costs this month.</div>}
                    {safePropertyCosts.details.map(d => (
                        <div key={d.id} className="flex justify-between text-xs text-slate-600">
                            <span>{d.name}</span>
                            <span className="font-mono font-bold text-slate-700">${Math.round((d.mortgage || 0) + (d.impounds || 0) + (d.other || 0)).toLocaleString()}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      </div>
    );
};

// --- SUB-MODULES ---

const IncomeEditor = ({ editData, actions, globalStart, retirementOptions = [] }) => {
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
                                <div className="w-20"><NumberInput label="Birth Year" helpText="Used for age/tax" value={editData.primary.birthYear} onChange={(v) => actions.updateScenarioData('income.primary.birthYear', v)} /></div>
                                <div className="w-32"><MonthSelect label="Birth Month" value={editData.primary.birthMonth} onChange={(v) => actions.updateScenarioData('income.primary.birthMonth', v)} /></div>
                            </div>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-lg space-y-4 border border-slate-100">
                            <NumberInput label="Net Annual Salary" helpText="After tax/withholding" value={editData.primary.netSalary} onChange={(v) => actions.updateScenarioData('income.primary.netSalary', v)} step="1000" />
                            <div className="grid grid-cols-2 gap-4">
                                <NumberInput label="Annual Bonus (Net)" helpText="Paid in the month set below" value={editData.primary.bonus.amount} onChange={(v) => actions.updateScenarioData('income.primary.bonus.amount', v)} step="1000" />
                                <MonthSelect label="Payout Month" value={editData.primary.bonus.month} onChange={(v) => actions.updateScenarioData('income.primary.bonus.month', v)} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <NumberInput label="Gross (401k Calc)" helpText="Base for contribution %" value={editData.primary.grossForContrib} onChange={(v) => actions.updateScenarioData('income.primary.grossForContrib', v)} step="1000" />
                                <NumberInput label="401k Contrib Rate" helpText="Decimal, e.g. 0.12 = 12%" value={editData.primary.contribPercent} onChange={(v) => actions.updateScenarioData('income.primary.contribPercent', v)} step="0.01" suffix="dec" />
                            </div>
                            <div className="grid grid-cols-1">
                                <div className="flex flex-col space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Contribution Account</label>
                                    <select className="border border-slate-200 rounded px-3 py-2 text-sm" value={editData.primary.retirementAccountId || ''} onChange={(e) => actions.updateScenarioData('income.primary.retirementAccountId', e.target.value || null)}>
                                        <option value="">Auto (owner/joint)</option>
                                        {retirementOptions.map(acc => (
                                            <option key={acc.id} value={acc.id}>{acc.name} ({acc.owner || 'joint'})</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="bg-blue-50/50 p-4 rounded-lg space-y-4 border border-blue-100">
                             <div className="grid grid-cols-2 gap-4">
                                <NumberInput label="FICA Start Age" helpText="Benefit kicks in at this age" value={editData.primary.socialSecurity.startAge} onChange={(v) => actions.updateScenarioData('income.primary.socialSecurity.startAge', v)} />
                                <NumberInput label="FICA Monthly ($)" helpText="Gross monthly benefit" value={editData.primary.socialSecurity.monthlyAmount} onChange={(v) => actions.updateScenarioData('income.primary.socialSecurity.monthlyAmount', v)} step="100" />
                            </div>
                        </div>
                    </div>

                    {/* Spouse */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h4 className="font-bold text-purple-600 text-sm uppercase tracking-wider">Spouse</h4>
                            <div className="flex gap-2">
                                <div className="w-20"><NumberInput label="Birth Year" helpText="Used for age/tax" value={editData.spouse.birthYear} onChange={(v) => actions.updateScenarioData('income.spouse.birthYear', v)} /></div>
                                <div className="w-32"><MonthSelect label="Birth Month" value={editData.spouse.birthMonth} onChange={(v) => actions.updateScenarioData('income.spouse.birthMonth', v)} /></div>
                            </div>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-lg space-y-4 border border-slate-100">
                            <NumberInput label="Net Annual Salary" helpText="After tax/withholding" value={editData.spouse.netSalary} onChange={(v) => actions.updateScenarioData('income.spouse.netSalary', v)} step="1000" />
                            <div className="grid grid-cols-2 gap-4">
                                <NumberInput label="Annual Bonus (Net)" helpText="Paid in the month set below" value={editData.spouse.bonus.amount} onChange={(v) => actions.updateScenarioData('income.spouse.bonus.amount', v)} step="1000" />
                                <MonthSelect label="Payout Month" value={editData.spouse.bonus.month} onChange={(v) => actions.updateScenarioData('income.spouse.bonus.month', v)} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <NumberInput label="Gross (401k Calc)" helpText="Base for contribution %" value={editData.spouse.grossForContrib} onChange={(v) => actions.updateScenarioData('income.spouse.grossForContrib', v)} step="1000" />
                                <NumberInput label="401k Contrib Rate" helpText="Decimal, e.g. 0.12 = 12%" value={editData.spouse.contribPercent} onChange={(v) => actions.updateScenarioData('income.spouse.contribPercent', v)} step="0.01" suffix="dec" />
                            </div>
                            <div className="grid grid-cols-1">
                                <div className="flex flex-col space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Contribution Account</label>
                                    <select className="border border-slate-200 rounded px-3 py-2 text-sm" value={editData.spouse.retirementAccountId || ''} onChange={(e) => actions.updateScenarioData('income.spouse.retirementAccountId', e.target.value || null)}>
                                        <option value="">Auto (owner/joint)</option>
                                        {retirementOptions.map(acc => (
                                            <option key={acc.id} value={acc.id}>{acc.name} ({acc.owner || 'joint'})</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="bg-purple-50/50 p-4 rounded-lg space-y-4 border border-purple-100">
                            <div className="grid grid-cols-2 gap-4">
                                <NumberInput label="FICA Start Age" helpText="Benefit kicks in at this age" value={editData.spouse.socialSecurity.startAge} onChange={(v) => actions.updateScenarioData('income.spouse.socialSecurity.startAge', v)} />
                                <NumberInput label="FICA Monthly ($)" helpText="Gross monthly benefit" value={editData.spouse.socialSecurity.monthlyAmount} onChange={(v) => actions.updateScenarioData('income.spouse.socialSecurity.monthlyAmount', v)} step="100" />
                            </div>
                            <div className="h-px bg-purple-100 my-2"></div>
                             <div className="flex items-center justify-between"><label className="text-xs font-bold text-purple-500 uppercase">Pension</label><span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-1 rounded">Starts Age: {autoPensionAge}</span></div>
                             <NumberInput label="Monthly Amount" helpText="Gross monthly pension" value={editData.spouse.pension.monthlyAmount} onChange={(v) => actions.updateScenarioData('income.spouse.pension.monthlyAmount', v)} step="100" />
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

const ExpensesEditor = ({ editData, actions, otherLoans, totalBills, totalLiving, totalDebtService, totalOneOffsThisMonth, activeScenario, simulationDate, propertyCosts, homeMonthLabel, handlers }) => {
    const safeHandlers = handlers || {};
    const updateBill = safeHandlers.updateBill || (() => {});
    const addBill = safeHandlers.addBill || (() => {});
    const removeBill = safeHandlers.removeBill || (() => {});
    const addFuture = safeHandlers.addFuture || (() => {});
    const updateFuture = safeHandlers.updateFuture || (() => {});
    const removeFuture = safeHandlers.removeFuture || (() => {});
    const toggleLoanLink = safeHandlers.toggleLoanLink || (() => {});
    const isLoanLinked = safeHandlers.isLoanLinked || (() => false);

    const retirementBrackets = editData.retirementBrackets || {};
    const adjustFunMoney = editData.adjustFunMoney;
    const propertyTotals = propertyCosts?.totals || { mortgage: 0, impounds: 0, other: 0 };
    const propertyDetails = propertyCosts?.details || [];
    const propertyLabel = homeMonthLabel || format(simulationDate, 'yyyy-MM');

    return (
        <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
            <Accordion title="Recurring Bills" total={totalBills} defaultOpen={true} onAdd={() => addBill('bills')}>
                <div className="space-y-1">{editData.bills.map((item, idx) => (<BillRow key={idx} item={item} onChange={(f, v) => updateBill('bills', idx, f, v)} onDelete={() => removeBill('bills', idx)} />))}</div>
            </Accordion>

            <Accordion title="Mortgage & Impounds" total={propertyTotals.mortgage + propertyTotals.impounds} defaultOpen={true}>
                <div className="space-y-2">
                    {propertyDetails.length === 0 && (
                        <div className="text-sm text-slate-400 italic">
                            No property carrying costs found for {propertyLabel}. Add mortgage links and impounds on the property in Assets & Property.
                        </div>
                    )}
                    {propertyDetails.map(detail => (
                        <div key={detail.id} className="p-3 rounded border border-slate-100 bg-slate-50">
                            <div className="flex justify-between items-center">
                                <div className="font-bold text-slate-700">{detail.name}</div>
                                <div className="text-[11px] uppercase text-slate-400">Month: {propertyLabel}</div>
                            </div>
                            <div className="flex justify-between text-sm text-slate-600 mt-1">
                                <span>Mortgage + Impounds</span>
                                <span className="font-mono font-bold text-blue-700">${Math.round((detail.mortgage || 0) + (detail.impounds || 0)).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-[11px] text-slate-500"><span>Mortgage</span><span className="font-mono">${Math.round(detail.mortgage || 0).toLocaleString()}</span></div>
                            <div className="flex justify-between text-[11px] text-slate-500"><span>Impounds</span><span className="font-mono">${Math.round(detail.impounds || 0).toLocaleString()}</span></div>
                        </div>
                    ))}
                    <div className="text-[11px] text-slate-400">Edit mortgage links and impounds in Assets → Property.</div>
                </div>
            </Accordion>

            <Accordion title="Home Expenses" total={propertyTotals.other} defaultOpen={false}>
                <div className="space-y-2">
                    {propertyDetails.length === 0 && (
                        <div className="text-sm text-slate-400 italic">
                            No HOA/maintenance costs loaded for {propertyLabel}. Add them on the property card in Assets & Property.
                        </div>
                    )}
                    {propertyDetails.map(detail => (
                        <div key={detail.id} className="p-3 rounded border border-slate-100 bg-slate-50">
                            <div className="flex justify-between items-center">
                                <div className="font-bold text-slate-700">{detail.name}</div>
                                <div className="text-[11px] uppercase text-slate-400">Month: {propertyLabel}</div>
                            </div>
                            <div className="flex justify-between text-sm text-slate-600 mt-1">
                                <span>HOA / Maintenance</span>
                                <span className="font-mono font-bold text-blue-700">${Math.round(detail.other || 0).toLocaleString()}</span>
                            </div>
                        </div>
                    ))}
                    <div className="text-[11px] text-slate-400">Edit HOA/maintenance in Assets → Property.</div>
                </div>
            </Accordion>
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

const OverviewExpenseQuickEdit = ({ editData, actions, otherLoans, totalBills, totalLiving, totalDebtService, totalOneOffsThisMonth, propertyCosts, homeMonthLabel, handlers, activeScenario, simulationDate, drillSignal }) => {
    const safeHandlers = handlers || {};
    const updateBill = safeHandlers.updateBill || (() => {});
    const addBill = safeHandlers.addBill || (() => {});
    const removeBill = safeHandlers.removeBill || (() => {});
    const addFuture = safeHandlers.addFuture || (() => {});
    const updateFuture = safeHandlers.updateFuture || (() => {});
    const removeFuture = safeHandlers.removeFuture || (() => {});
    const toggleLoanLink = safeHandlers.toggleLoanLink || (() => {});
    const isLoanLinked = safeHandlers.isLoanLinked || (() => false);

    const retirementBrackets = editData.retirementBrackets || {};
    const adjustFunMoney = editData.adjustFunMoney;
    const propertyTotals = propertyCosts?.totals || { mortgage: 0, impounds: 0, other: 0 };
    const propertyDetails = propertyCosts?.details || [];
    const propertyLabel = homeMonthLabel || format(simulationDate, 'yyyy-MM');

    const billsRef = useRef(null);
    const livingRef = useRef(null);
    const homeFixedRef = useRef(null);
    const homeOtherRef = useRef(null);
    const debtRef = useRef(null);
    const extrasRef = useRef(null);

    const [openSections, setOpenSections] = useState({
        bills: true,
        living: false,
        homeFixed: true,
        homeOther: false,
        debt: false,
        extras: false
    });

    const scrollToSection = useCallback((key) => {
        const refMap = { bills: billsRef, living: livingRef, homeFixed: homeFixedRef, homeOther: homeOtherRef, debt: debtRef, extras: extrasRef };
        setOpenSections(prev => ({ ...prev, [key]: true }));
        const ref = refMap[key]?.current;
        if (ref) ref.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, [billsRef, livingRef, homeFixedRef, homeOtherRef, debtRef, extrasRef]);

    useEffect(() => {
        if (!drillSignal?.target) return;
        const map = {
            recurring: ['bills', 'living'],
            homeFixed: ['homeFixed'],
            homeOther: ['homeOther'],
            debt: ['debt'],
            extras: ['extras']
        };
        const targets = map[drillSignal.target] || [drillSignal.target];
        setOpenSections(prev => {
            const next = { ...prev };
            targets.forEach(k => { next[k] = true; });
            return next;
        });
        const refMap = { bills: billsRef, living: livingRef, homeFixed: homeFixedRef, homeOther: homeOtherRef, debt: debtRef, extras: extrasRef };
        const firstRef = refMap[targets[0]];
        if (firstRef?.current) setTimeout(() => firstRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    }, [drillSignal, billsRef, livingRef, homeFixedRef, homeOtherRef, debtRef, extrasRef]);

    const quickLinks = [
        { key: 'bills', label: 'Recurring Bills' },
        { key: 'homeFixed', label: 'Mortgage + Impounds' },
        { key: 'homeOther', label: 'HOA / Maint' },
        { key: 'debt', label: 'Other Liabilities' },
        { key: 'extras', label: 'Discretionary / One-Offs' },
    ];

    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                    <div className="text-xs font-bold uppercase text-slate-500">Expense Drilldown</div>
                    <div className="text-sm text-slate-500">Edit categories directly from the monthly burn view.</div>
                </div>
                <div className="flex flex-wrap gap-2">
                    {quickLinks.map(link => (
                        <button
                            key={link.key}
                            onClick={() => scrollToSection(link.key)}
                            className="text-[11px] font-bold px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 hover:border-blue-400 hover:text-blue-600 transition-colors"
                        >
                            {link.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div ref={billsRef}>
                    <Accordion
                        title="Recurring Bills"
                        total={totalBills}
                        defaultOpen={true}
                        open={openSections.bills}
                        onToggle={(next) => setOpenSections(prev => ({ ...prev, bills: typeof next === 'boolean' ? next : !prev.bills }))}
                        onAdd={() => addBill('bills')}
                    >
                        <div className="space-y-1">
                            {editData.bills.map((item, idx) => (
                                <BillRow key={idx} item={item} onChange={(f, v) => updateBill('bills', idx, f, v)} onDelete={() => removeBill('bills', idx)} />
                            ))}
                        </div>
                    </Accordion>

                    <div ref={livingRef}>
                        <Accordion
                            title="Living Essentials"
                            total={totalLiving}
                            defaultOpen={false}
                            open={openSections.living}
                            onToggle={(next) => setOpenSections(prev => ({ ...prev, living: typeof next === 'boolean' ? next : !prev.living }))}
                            onAdd={() => addBill('living')}
                        >
                            <div className="space-y-1">
                                {editData.living.map((item, idx) => (
                                    <BillRow key={idx} item={item} onChange={(f, v) => updateBill('living', idx, f, v)} onDelete={() => removeBill('living', idx)} />
                                ))}
                            </div>
                        </Accordion>
                    </div>
                </div>

                <div className="space-y-4">
                    <div ref={homeFixedRef}>
                        <Accordion
                            title="Mortgage & Impounds (from Properties)"
                            total={propertyTotals.mortgage + propertyTotals.impounds}
                            defaultOpen={true}
                            open={openSections.homeFixed}
                            onToggle={(next) => setOpenSections(prev => ({ ...prev, homeFixed: typeof next === 'boolean' ? next : !prev.homeFixed }))}
                        >
                            <div className="space-y-2">
                                {propertyDetails.length === 0 && (
                                    <div className="text-sm text-slate-400 italic">
                                        No property carrying costs found for {propertyLabel}. Add mortgage links and impounds on the property in Assets & Property.
                                    </div>
                                )}
                                {propertyDetails.map(detail => (
                                    <div key={detail.id} className="p-3 rounded border border-slate-100 bg-slate-50">
                                        <div className="flex justify-between items-center">
                                            <div className="font-bold text-slate-700">{detail.name}</div>
                                            <div className="text-[11px] uppercase text-slate-400">Month: {propertyLabel}</div>
                                        </div>
                                        <div className="flex justify-between text-sm text-slate-600 mt-1">
                                            <span>Mortgage + Impounds</span>
                                            <span className="font-mono font-bold text-blue-700">${Math.round((detail.mortgage || 0) + (detail.impounds || 0)).toLocaleString()}</span>
                                        </div>
                                    </div>
                                ))}
                                <div className="text-[11px] text-slate-400">Edit mortgage links and impounds in Assets → Property.</div>
                            </div>
                        </Accordion>
                    </div>

                    <div ref={homeOtherRef}>
                        <Accordion
                            title="HOA / Maintenance (from Properties)"
                            total={propertyTotals.other}
                            defaultOpen={false}
                            open={openSections.homeOther}
                            onToggle={(next) => setOpenSections(prev => ({ ...prev, homeOther: typeof next === 'boolean' ? next : !prev.homeOther }))}
                        >
                            <div className="space-y-2">
                                {propertyDetails.length === 0 && (
                                    <div className="text-sm text-slate-400 italic">
                                        No HOA/maintenance costs loaded for {propertyLabel}. Add them on the property card in Assets & Property.
                                    </div>
                                )}
                                {propertyDetails.map(detail => (
                                    <div key={detail.id} className="p-3 rounded border border-slate-100 bg-slate-50">
                                        <div className="flex justify-between items-center">
                                            <div className="font-bold text-slate-700">{detail.name}</div>
                                            <div className="text-[11px] uppercase text-slate-400">Month: {propertyLabel}</div>
                                        </div>
                                        <div className="flex justify-between text-sm text-slate-600 mt-1">
                                            <span>HOA / Maintenance</span>
                                            <span className="font-mono font-bold text-blue-700">${Math.round(detail.other || 0).toLocaleString()}</span>
                                        </div>
                                    </div>
                                ))}
                                <div className="text-[11px] text-slate-400">Edit HOA/maintenance in Assets → Property.</div>
                            </div>
                        </Accordion>
                    </div>

                    <div ref={debtRef}>
                        <Accordion
                            title="Other Liabilities (toggle to include)"
                            total={totalDebtService}
                            defaultOpen={false}
                            open={openSections.debt}
                            onToggle={(next) => setOpenSections(prev => ({ ...prev, debt: typeof next === 'boolean' ? next : !prev.debt }))}
                        >
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
                    </div>
                </div>
            </div>

            <div className="mt-2" ref={extrasRef}>
                <Accordion
                    title="Discretionary & One-Off Plans"
                    total={totalOneOffsThisMonth}
                    defaultOpen={false}
                    open={openSections.extras}
                    onToggle={(next) => setOpenSections(prev => ({ ...prev, extras: typeof next === 'boolean' ? next : !prev.extras }))}
                >
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
  const [viewTab, setViewTab] = useState('overview'); // 'overview' | 'projections' | 'expenses' | 'income'
  const [showProfileMgr, setShowProfileMgr] = useState(false);
  const [drillSignal, setDrillSignal] = useState(null);

  // State to track which profile ID is currently "Loaded" in the editor
  const [editingProfileId, setEditingProfileId] = useState(null);

  // Guard for missing scenario data
  if (!activeScenario?.data) {
      return <div className="p-6 text-slate-500">No scenario loaded.</div>;
  }

  // Data Loading
  const incomeData = activeScenario.data.income || {};
  const expenseData = activeScenario.data.expenses || {};
  // Ensure defaults
  expenseData.bills = expenseData.bills || [];
  expenseData.home = expenseData.home || [];
  expenseData.living = expenseData.living || [];
  expenseData.impounds = expenseData.impounds || [];
  expenseData.oneOffs = expenseData.oneOffs || [];
  expenseData.retirementBrackets = expenseData.retirementBrackets || {};
  expenseData.linkedLoanIds = expenseData.linkedLoanIds || [];

  const assumptions = activeScenario.data.assumptions || activeScenario.data.globals || {};
  const globalStart = assumptions.timing || { startYear: 2026, startMonth: 1 };
  const globalStartDateStr = `${globalStart.startYear}-${String(globalStart.startMonth).padStart(2, '0')}-01`;
  const scenarioStartDate = useMemo(() => new Date(globalStart.startYear, globalStart.startMonth - 1, 1), [globalStart.startYear, globalStart.startMonth]);
  const simulation = useMemo(() => runFinancialSimulation(activeScenario, store.profiles, store.registry), [activeScenario, store.profiles, store.registry]);
  const savedProfileSelections = activeScenario.data.ui?.cashflow?.selectedProfiles || {};

  useEffect(() => {
      if (viewTab === 'income' && activeTab !== 'income') {
          setActiveTab('income');
      } else if (viewTab !== 'income' && activeTab !== 'expenses') {
          setActiveTab('expenses');
      }
  }, [viewTab, activeTab]);

  useEffect(() => {
      if (viewTab === 'overview' || viewTab === 'projections') {
          setShowProfileMgr(false);
      }
  }, [viewTab]);

  // Determine which profile is *Active in the Timeline* for the current date
  const timelineActiveProfile = useMemo(() => {
      const tabData = activeScenario.data[activeTab] || {};
      const seq = tabData.profileSequence || [];
      const activeItems = seq
        .map(item => {
            const parsed = item.startDate ? parseISO(item.startDate) : null;
            return { ...item, parsed };
        })
        .filter(item => item.isActive && item.parsed && isValid(item.parsed) && !isAfter(item.parsed, simulationDate));
      if (activeItems.length === 0) return null;
      activeItems.sort((a, b) => b.startDate.localeCompare(a.startDate));
      const effectiveItem = activeItems[0];
      return store.profiles[effectiveItem.profileId] ? { ...store.profiles[effectiveItem.profileId], ...effectiveItem } : null;
  }, [activeScenario, activeTab, simulationDate, store.profiles]);

  // Sync editingProfileId to saved selection or timeline active profile
  useEffect(() => {
      const cached = savedProfileSelections[activeTab];
      const fallback = timelineActiveProfile?.id;
      const nextId = cached || fallback || null;
      if (nextId && editingProfileId !== nextId) {
          setEditingProfileId(nextId);
      }
  }, [activeTab, savedProfileSelections, timelineActiveProfile, editingProfileId]);

  // Persist selected profile per tab so it survives navigation
  useEffect(() => {
      if (editingProfileId && savedProfileSelections[activeTab] !== editingProfileId) {
          actions.updateScenarioData(`ui.cashflow.selectedProfiles.${activeTab}`, editingProfileId);
      }
  }, [editingProfileId, activeTab, savedProfileSelections, actions]);

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
  const [burnDate, setBurnDate] = useState(simulationDate);
  const normalizedBurnDate = useMemo(() => {
      const candidate = burnDate || simulationDate || new Date();
      const d = candidate instanceof Date ? candidate : new Date(candidate);
      if (Number.isNaN(d.valueOf())) return new Date();
      return d;
  }, [burnDate, simulationDate]);

  // Keep the planning month in sync with the model date when it changes elsewhere
  useEffect(() => {
      if (simulationDate && (!burnDate || format(burnDate, 'yyyy-MM') !== format(simulationDate, 'yyyy-MM'))) {
          setBurnDate(simulationDate);
      }
  }, [simulationDate, burnDate]);

  const burnMonthKey = format(normalizedBurnDate, 'yyyy-MM');
  const loansMap = activeScenario.data.loans || {};

  const loanCalculations = useMemo(() => {
      const results = {};
      Object.values(loansMap).forEach(loan => {
          if (!loan.active) return;
          const stratId = loan.activeStrategyId || 'base';
          const strategy = loan.strategies?.[stratId] || { extraPayments: {} };
          if (loan.type === 'revolving') results[loan.id] = { calc: calculateRevolvingLoan(loan.inputs, strategy.extraPayments), strategy };
          else results[loan.id] = { calc: calculateFixedLoan(loan.inputs, strategy.extraPayments), strategy };
      });
      return results;
  }, [loansMap]);

  const getLoanSnapshotForMonth = (loan, monthKey) => {
      const entry = loanCalculations[loan.id];
      if (!entry) return null;
      const { calc, strategy } = entry;
      const row = calc.schedule.find(r => r.date === monthKey);
      if (!row) return null;
      const extraPayment = strategy?.extraPayments?.[monthKey] || 0;
      const basePayment = Math.max((row.payment || 0) - extraPayment, 0);
      return { total: row.payment, basePayment, extraPayment };
  };

  const propertyLinkedLoanIds = useMemo(() => {
      const ids = new Set();
      Object.values(activeScenario.data.assets.accounts || {}).forEach(asset => {
          if (asset.type !== 'property') return;
          (asset.inputs?.linkedLoanIds || []).forEach(id => ids.add(id));
          if (asset.inputs?.linkedLoanId) ids.add(asset.inputs.linkedLoanId);
      });
      Object.values(loansMap).forEach(loan => {
          if (loan.propertyLinked || loan.linkedPropertyId) ids.add(loan.id);
          if (loan.type === 'mortgage') ids.add(loan.id);
      });
      return ids;
  }, [activeScenario.data.assets.accounts, loansMap]);

  const isPropertyOwnedOn = useCallback((monthKey, startDateStr, sellDateStr) => {
      if (!monthKey) return false;
      const startKey = startDateStr ? startDateStr.substring(0, 7) : null;
      const sellKey = sellDateStr ? sellDateStr.substring(0, 7) : null;
      const afterStart = !startKey || startKey <= monthKey;
      const beforeSell = !sellKey || monthKey <= sellKey;
      return afterStart && beforeSell;
  }, []);

  const activeLoanObjects = Object.values(loansMap).map(loan => {
    if (loan.active === false) return null;
    const snap = getLoanSnapshotForMonth(loan, currentMonthKey);
    if (!snap) return null;
    const isPropLinked = propertyLinkedLoanIds.has(loan.id);
    return { id: loan.id, name: loan.name, type: loan.type, total: snap.total, basePayment: snap.basePayment, extraPayment: snap.extraPayment, isPropertyLinked: isPropLinked };
  }).filter(Boolean);

  const mortgageLoans = activeLoanObjects.filter(l => l.isPropertyLinked);
  const otherLoans = activeLoanObjects.filter(l => !l.isPropertyLinked);

  const getPropertyCostsForMonth = useCallback((monthKey) => {
      const monthDate = parseISO(`${monthKey}-01`);
      if (!isValid(monthDate)) return { totals: { mortgage: 0, impounds: 0, other: 0 }, details: [], hasActiveProperty: false };

      const inflationRate = assumptions.inflation?.general || 0.025;
      const propTaxRate = assumptions.inflation?.propertyTax || 0.02;
      const propInsRate = assumptions.inflation?.propertyInsurance || inflationRate;
      const elapsedYears = differenceInMonths(monthDate, scenarioStartDate) / 12;
      const inflationMult = Math.pow(1 + inflationRate, elapsedYears);
      const propTaxMult = Math.pow(1 + propTaxRate, elapsedYears);
      const propInsMult = Math.pow(1 + propInsRate, elapsedYears);

      const totals = { mortgage: 0, impounds: 0, other: 0 };
      const details = [];

      Object.values(activeScenario.data.assets.accounts || {}).forEach(asset => {
          if (asset.type !== 'property') return;
          if (!isPropertyOwnedOn(monthKey, asset.inputs?.startDate, asset.inputs?.sellDate)) return;
          const costs = asset.inputs?.carryingCosts || {};
          const impounds = costs.impounds || [];
          const other = costs.other || [];
          let impTotal = 0, otherTotal = 0, mortTotal = 0;

          impounds.forEach(item => {
              let m = inflationMult;
              const n = (item.name || '').toLowerCase();
              if (n.includes('tax')) m = propTaxMult;
              else if (n.includes('insurance')) m = propInsMult;
              impTotal += (item.amount || 0) * m;
          });

          other.forEach(item => { otherTotal += (item.amount || 0) * inflationMult; });

          const linkedLoans = asset.inputs?.linkedLoanIds || [];
          linkedLoans.forEach(lid => {
              const loan = loansMap[lid];
              if (!loan || loan.active === false) return;
              const snap = getLoanSnapshotForMonth(loan, monthKey);
              if (snap) mortTotal += snap.total;
          });

          totals.mortgage += mortTotal;
          totals.impounds += impTotal;
          totals.other += otherTotal;
          details.push({ id: asset.id, name: asset.name, mortgage: mortTotal, impounds: impTotal, other: otherTotal });
      });

      return { totals, details, hasActiveProperty: details.length > 0 };
  }, [activeScenario.data.assets.accounts, assumptions, getLoanSnapshotForMonth, isPropertyOwnedOn, loansMap, scenarioStartDate]);

  const calculateTotal = (arr) => arr.reduce((sum, item) => sum + (item.amount || 0), 0);
  const totalBills = calculateTotal(expenseData.bills);
  const totalLiving = calculateTotal(expenseData.living);
  const totalOneOffsThisMonth = useMemo(() => expenseData.oneOffs.filter(item => item.date === currentMonthKey).reduce((sum, item) => sum + (item.amount || 0), 0), [expenseData.oneOffs, currentMonthKey]);
  const propertyCosts = useMemo(() => getPropertyCostsForMonth(burnMonthKey), [getPropertyCostsForMonth, burnMonthKey]);
  const resolveProfileForDate = useCallback((type, dateStr, returnId = false) => {
      const seq = activeScenario.links?.profiles?.[type] || activeScenario.data?.[type]?.profileSequence || [];
      const activeItems = seq
        .filter(item => item.isActive && item.startDate && item.startDate <= dateStr)
        .sort((a, b) => b.startDate.localeCompare(a.startDate));
      if (activeItems.length === 0) return returnId ? '' : 'Not set';
      const match = activeItems[0];
      if (returnId) return match.profileId || '';
      return store.profiles[match.profileId]?.name || match.profileId || 'Not set';
  }, [activeScenario, store.profiles]);

  const expenseProfiles = useMemo(() => Object.values(store.profiles).filter(p => p.type === 'expenses'), [store.profiles]);
  const incomeProfiles = useMemo(() => Object.values(store.profiles).filter(p => p.type === 'income'), [store.profiles]);

  const switchProfileForType = useCallback((type, profileId) => {
      if (!profileId) return;
      const targetProfile = store.profiles[profileId];
      const currentData = activeScenario.data[type] || {};
      if (targetProfile) {
          const mergedData = {
              ...targetProfile.data,
              profileSequence: currentData.profileSequence || []
          };
          actions.updateScenarioData(type, mergedData);
      }
      actions.updateScenarioData(`ui.cashflow.selectedProfiles.${type}`, profileId);
      if (type === activeTab) setEditingProfileId(profileId);
  }, [actions, activeScenario.data, activeTab, store.profiles]);

  const getLinkedTotal = (loans, monthKey, useBase = false) => {
      const links = expenseData.linkedLoanIds;
      const compute = (loan) => {
          const snap = getLoanSnapshotForMonth(loan, monthKey);
          if (!snap) return 0;
          return useBase ? snap.basePayment : snap.total;
      };
      if (!links) return loans.reduce((s,i) => s + compute(i), 0);
      return loans.filter(l => links.includes(l.id)).reduce((s,i) => s + compute(i), 0);
  };

  const totalDebtService = getLinkedTotal(otherLoans, currentMonthKey);

  const totalOneOffsBurnMonth = expenseData.oneOffs.filter(item => item.date === burnMonthKey).reduce((sum, item) => sum + item.amount, 0);
  const baseDebtService = getLinkedTotal(otherLoans, burnMonthKey, true);
  const linkedExtraDebt = getLinkedTotal(mortgageLoans, burnMonthKey, false) - getLinkedTotal(mortgageLoans, burnMonthKey, true)
                        + getLinkedTotal(otherLoans, burnMonthKey, false) - getLinkedTotal(otherLoans, burnMonthKey, true);
  const plannedDiscretionary = totalOneOffsBurnMonth + linkedExtraDebt;

  const burnRow = useMemo(() => {
      if (!simulation?.timeline) return null;
      return simulation.timeline.find(t => (t.date || '').startsWith(burnMonthKey)) || simulation.timeline[0];
  }, [simulation, burnMonthKey]);
  const burnMonthly = burnRow?.monthlyBurn || {};
  const recurringBillsLiving = burnMonthly.recurring ?? (totalBills + totalLiving);
  const fixedHomeExpenses = burnMonthly.home ?? (propertyCosts.totals.mortgage + propertyCosts.totals.impounds + propertyCosts.totals.other);
  const homeMortgageImpounds = (burnMonthly.homeMortgage || 0) + (burnMonthly.homeImpounds || 0);
  const homeOtherDisplay = burnMonthly.homeOther ?? propertyCosts.totals.other ?? 0;
  const otherLiabilitiesFixed = burnMonthly.otherLiabilities ?? baseDebtService;
  const burnTotal = recurringBillsLiving + fixedHomeExpenses + otherLiabilitiesFixed + plannedDiscretionary;

  // Expense editing helpers shared between Overview and the Expenses tab
  const updateBill = useCallback((category, index, field, value) => {
      const list = [...(expenseData[category] || [])];
      list[index] = { ...list[index], [field]: value };
      actions.updateScenarioData(`expenses.${category}`, list);
  }, [expenseData, actions]);

  const addBill = useCallback((category) => {
      const list = [...(expenseData[category] || [])];
      list.push({ id: Date.now(), name: "New Item", amount: 0 });
      actions.updateScenarioData(`expenses.${category}`, list);
  }, [expenseData, actions]);

  const removeBill = useCallback((category, index) => {
      const list = [...(expenseData[category] || [])];
      list.splice(index, 1);
      actions.updateScenarioData(`expenses.${category}`, list);
  }, [expenseData, actions]);

  const addFuture = useCallback(() => {
      const list = [...(expenseData.oneOffs || [])];
      list.push({ id: Date.now(), date: format(simulationDate, 'yyyy-MM'), name: 'New Expense', amount: 0 });
      actions.updateScenarioData('expenses.oneOffs', list);
  }, [expenseData.oneOffs, simulationDate, actions]);

  const updateFuture = useCallback((id, field, value) => {
      const list = (expenseData.oneOffs || []).map(item => item.id === id ? { ...item, [field]: value } : item);
      actions.updateScenarioData('expenses.oneOffs', list);
  }, [expenseData.oneOffs, actions]);

  const removeFuture = useCallback((id) => {
      const list = (expenseData.oneOffs || []).filter(item => item.id !== id);
      actions.updateScenarioData('expenses.oneOffs', list);
  }, [expenseData.oneOffs, actions]);

  const toggleLoanLink = useCallback((loanId) => {
      const allActiveIds = Object.values(activeScenario.data.loans || {}).filter(l => l.active).map(l => l.id);
      const currentLinks = expenseData.linkedLoanIds || allActiveIds;
      let newLinks;
      if (currentLinks.includes(loanId)) {
          newLinks = currentLinks.filter(id => id !== loanId);
      } else {
          newLinks = [...currentLinks, loanId];
      }
      actions.updateScenarioData('expenses.linkedLoanIds', newLinks);
  }, [expenseData.linkedLoanIds, activeScenario.data.loans, actions]);

  const isLoanLinked = useCallback((loanId) => {
      if (!expenseData.linkedLoanIds) return true;
      return expenseData.linkedLoanIds.includes(loanId);
  }, [expenseData.linkedLoanIds]);

  const expenseHandlers = useMemo(() => ({
      updateBill,
      addBill,
      removeBill,
      addFuture,
      updateFuture,
      removeFuture,
      toggleLoanLink,
      isLoanLinked
  }), [updateBill, addBill, removeBill, addFuture, updateFuture, removeFuture, toggleLoanLink, isLoanLinked]);

  const handleDrill = useCallback((target) => {
      setViewTab('overview');
      setDrillSignal({ target, ts: Date.now() });
  }, []);

  const duplicateCurrentToExpenseProfile = () => {
      const name = prompt("Save current expense setup as new profile name:");
      if (!name) return;
      actions.saveProfile('expenses', name, expenseData);
  };

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
              profileSequence: activeScenario.data[activeTab]?.profileSequence || []
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
  const availableRetirementAccounts = useMemo(() => Object.values(store.registry?.assets || {}).filter(a => a.type === 'retirement'), [store.registry]);
  const tabOptions = [
      { id: 'overview', label: 'Overview' },
      { id: 'projections', label: 'Projections' },
      { id: 'expenses', label: 'Expenses' },
      { id: 'income', label: 'Income' }
  ];

  const handleTabChange = useCallback((tab) => {
      setViewTab(tab);
      if (tab !== 'overview') setDrillSignal(null);
  }, []);

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      {/* HEADER */}
      <div className="bg-white border-b border-slate-200 px-8 py-6 shadow-sm z-10">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3">
                 <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Receipt /> Cash Flow Manager</h2>
                 <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full border border-slate-200">v2.3 layout</span>
            </div>
            <div className="text-sm text-slate-500 mt-1">Use the tabs to move between overview, projections, and editing expense/income profiles.</div>
          </div>
          <div className="text-right">
             <div className="text-[10px] uppercase font-bold text-slate-400">Active Month</div>
             <div className="text-sm font-semibold text-slate-700">{burnMonthKey}</div>
             <div className="text-[10px] text-slate-400">Set in Planning Context</div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg shadow-sm">
                <div className="text-[10px] uppercase font-bold text-slate-500">Recurring</div>
                <div className="text-xl font-bold text-slate-800">${Math.round(recurringBillsLiving).toLocaleString()}</div>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg shadow-sm">
                <div className="text-[10px] uppercase font-bold text-slate-500">Home: Mortgage+Imp</div>
                <div className="text-xl font-bold text-blue-700">${Math.round(homeMortgageImpounds).toLocaleString()}</div>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg shadow-sm">
                <div className="text-[10px] uppercase font-bold text-slate-500">Home: HOA/Maint</div>
                <div className="text-xl font-bold text-blue-700">${Math.round(homeOtherDisplay).toLocaleString()}</div>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg shadow-sm">
                <div className="text-[10px] uppercase font-bold text-slate-500">Other Liabilities</div>
                <div className="text-xl font-bold text-slate-800">${Math.round(otherLiabilitiesFixed).toLocaleString()}</div>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg shadow-sm">
                <div className="text-[10px] uppercase font-bold text-slate-500">Planned Discretionary</div>
                <div className="text-xl font-bold text-emerald-600">${Math.round(plannedDiscretionary).toLocaleString()}</div>
            </div>
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg shadow-sm">
                <div className="text-[10px] uppercase font-bold text-red-500">Total Burn</div>
                <div className="text-xl font-bold text-red-600">${Math.round(burnTotal).toLocaleString()}</div>
            </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
            <div className="flex flex-wrap bg-slate-100 p-1 rounded-lg gap-1">
                {tabOptions.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => handleTabChange(tab.id)}
                        className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all border ${viewTab === tab.id ? 'bg-white text-blue-600 shadow-sm border-blue-200' : 'text-slate-600 border-transparent hover:text-slate-800'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-2">
                <Info size={12}/> Projections live on their own tab; Overview keeps burn + quick edits together.
            </div>
        </div>
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-auto p-8 max-w-6xl mx-auto w-full">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-bold text-slate-700">Planning Context</div>
                  <div className="text-[11px] text-slate-400">Pick month, profiles, and see active properties before reviewing outputs.</div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                  <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-slate-500">Month</span>
                      <input
                          type="month"
                          className="border border-slate-300 rounded px-2 py-1 text-sm font-semibold text-slate-700"
                          value={burnMonthKey}
                          onChange={(e) => {
                              const val = e.target.value;
                              if (!val) return;
                              setBurnDate(new Date(`${val}-01`));
                          }}
                      />
                      <span className="text-[10px] text-slate-400 mt-1">Starts at scenario month</span>
                  </div>
                  <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-blue-500">Expense Profile</span>
                      <select
                          className="border border-blue-200 rounded px-2 py-1 text-sm font-semibold text-slate-700"
                          value={savedProfileSelections.expenses || resolveProfileForDate('expenses', `${burnMonthKey}-01`, true) || ''}
                          onChange={(e) => switchProfileForType('expenses', e.target.value)}
                      >
                          {expenseProfiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <button onClick={duplicateCurrentToExpenseProfile} className="text-[10px] text-blue-600 mt-1 underline">Duplicate current to new profile</button>
                  </div>
                  <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-emerald-500">Income Profile</span>
                      <select
                          className="border border-emerald-200 rounded px-2 py-1 text-sm font-semibold text-slate-700"
                          value={savedProfileSelections.income || resolveProfileForDate('income', `${burnMonthKey}-01`, true) || ''}
                          onChange={(e) => switchProfileForType('income', e.target.value)}
                      >
                          {incomeProfiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                  </div>
                  <div className="flex-1 min-w-[220px]">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Active Properties (this month)</span>
                      <div className="flex flex-wrap gap-2 mt-1">
                          {propertyCosts.details.length === 0 && <span className="text-xs text-slate-400">None</span>}
                          {propertyCosts.details.map(d => (
                              <span key={d.id} className="text-xs bg-slate-100 border border-slate-200 px-2 py-1 rounded-full text-slate-700">
                                  {d.name}
                              </span>
                          ))}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">Property costs flow from Assets; edit those on the property card.</div>
                  </div>
              </div>
          </div>

          {viewTab === 'overview' && (
              <>
                  <MonthlyBurnPanel
                    activeScenario={activeScenario}
                    store={store}
                    simulation={simulation}
                    monthValue={burnMonthKey}
                    propertyCosts={propertyCosts}
                    onDrill={handleDrill}
                  />
                  <OverviewExpenseQuickEdit
                    editData={expenseData}
                    actions={actions}
                    otherLoans={otherLoans}
                    totalBills={totalBills}
                    totalLiving={totalLiving}
                    totalDebtService={totalDebtService}
                    totalOneOffsThisMonth={totalOneOffsThisMonth}
                    propertyCosts={propertyCosts}
                    homeMonthLabel={burnMonthKey}
                    handlers={expenseHandlers}
                    activeScenario={activeScenario}
                    simulationDate={simulationDate}
                    drillSignal={drillSignal}
                  />
              </>
          )}

          {viewTab === 'projections' && (
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wide">Projections & Analysis</h3>
                    <div className="text-[11px] text-slate-400">Annual views, separated from editing for clarity</div>
                </div>
                <NetCashFlowSummary activeScenario={activeScenario} store={store} simulation={simulation} />
                <CashFlowTable activeScenario={activeScenario} store={store} simulation={simulation} />
              </div>
          )}

          {viewTab === 'expenses' && (
              <div className="space-y-4 mt-4">
                  <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                          <div className="text-xs font-bold uppercase text-slate-500">Active Expense Profile</div>
                          <div className="text-sm text-slate-600">Manage timeline and save changes; selections persist when navigating.</div>
                          {editingProfileId && editingProfileId !== timelineActiveProfile?.id && (
                              <div className="text-[10px] text-orange-500 bg-orange-50 px-2 py-1 rounded border border-orange-100 inline-flex items-center gap-1 mt-1">
                                  <Info size={10}/> Not active in timeline for {format(simulationDate, 'MMM yyyy')}
                              </div>
                          )}
                      </div>
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
                  {showProfileMgr && (
                      <ProfileManager
                          type={activeTab}
                          profiles={store.profiles}
                          sequence={activeScenario.data[activeTab]?.profileSequence || []}
                          actions={actions}
                          globalStartDateStr={globalStartDateStr}
                      />
                  )}
                  <ExpensesEditor
                     editData={expenseData}
                     actions={actions}
                     otherLoans={otherLoans}
                     totalBills={totalBills}
                     totalLiving={totalLiving}
                     totalDebtService={totalDebtService}
                     totalOneOffsThisMonth={totalOneOffsThisMonth}
                     activeScenario={activeScenario}
                     simulationDate={simulationDate}
                     propertyCosts={propertyCosts}
                     homeMonthLabel={burnMonthKey}
                     handlers={expenseHandlers}
                  />
              </div>
          )}

          {viewTab === 'income' && (
              <div className="space-y-4 mt-4">
                  <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                          <div className="text-xs font-bold uppercase text-slate-500">Active Income Profile</div>
                          <div className="text-sm text-slate-600">Pick, edit, and save income timelines without losing your place.</div>
                          {editingProfileId && editingProfileId !== timelineActiveProfile?.id && (
                              <div className="text-[10px] text-orange-500 bg-orange-50 px-2 py-1 rounded border border-orange-100 inline-flex items-center gap-1 mt-1">
                                  <Info size={10}/> Not active in timeline for {format(simulationDate, 'MMM yyyy')}
                              </div>
                          )}
                      </div>
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
                  {showProfileMgr && (
                      <ProfileManager
                          type={activeTab}
                          profiles={store.profiles}
                          sequence={activeScenario.data[activeTab]?.profileSequence || []}
                          actions={actions}
                          globalStartDateStr={globalStartDateStr}
                      />
                  )}
                  <IncomeEditor editData={incomeData} actions={actions} globalStart={globalStart} retirementOptions={availableRetirementAccounts} />
              </div>
          )}
      </div>
    </div>
  );
}
