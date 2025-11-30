import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { Plus, Trash2, Save, Receipt, ChevronDown, ChevronRight, Calendar, CheckSquare, Square, CreditCard, Pencil, Copy, BarChart3, Table, List, Palmtree, Settings } from 'lucide-react';
import { parseISO, isAfter, format, addMonths, startOfMonth, getYear } from 'date-fns';
import { calculateFixedLoan, calculateRevolvingLoan } from '../utils/loan_math';

// --- UTILITY COMPONENTS ---

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
          onChange={(e) => {
            const val = e.target.value;
            onChange('amount', val === '' ? 0 : parseFloat(val));
          }}
        />
    </div>
    <button onClick={onDelete} className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
      <Trash2 size={16} />
    </button>
  </div>
);

const Accordion = ({ title, total, children, defaultOpen = false, onAdd }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden mb-4">
      <div
        className="flex items-center justify-between p-4 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2 font-bold text-slate-700">
          {isOpen ? <ChevronDown size={18}/> : <ChevronRight size={18}/>}
          {title}
        </div>
        <div className="flex items-center gap-4">
            {onAdd && (
                <button
                    onClick={(e) => { e.stopPropagation(); onAdd(); }}
                    className="text-slate-400 hover:text-blue-600 transition-colors"
                    title="Add Item"
                >
                    <Plus size={16}/>
                </button>
            )}
            <span className="text-xs font-mono font-bold text-slate-600 bg-white px-2 py-1 rounded border border-slate-200 min-w-[80px] text-right">
                ${total.toLocaleString()}
            </span>
        </div>
      </div>
      {isOpen && (
        <div className="p-4 bg-white border-t border-slate-100">
           {children}
        </div>
      )}
    </div>
  );
};

// --- PROFILE MENU COMPONENT ---
const ProfileMenu = ({ activeProfileName, onSave, onSaveAs, onToggleMgr, showMgr }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 text-xs font-bold px-3 py-2 rounded bg-white border border-slate-200 text-slate-700 hover:border-blue-400 hover:text-blue-600 transition-all shadow-sm"
            >
                <Settings size={14} />
                <span>Profile Actions</span>
                <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}/>
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-20" onClick={() => setIsOpen(false)}></div>
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-lg shadow-xl z-30 overflow-hidden">
                         <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                             Active: {activeProfileName}
                         </div>
                         <button onClick={() => { onSave(); setIsOpen(false); }} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3">
                            <Save size={16} className="text-blue-600"/> Save Changes
                         </button>
                         <button onClick={() => { onSaveAs(); setIsOpen(false); }} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3">
                            <Copy size={16} className="text-slate-500"/> Save as New Profile...
                         </button>
                         <div className="h-px bg-slate-100 my-1"></div>
                         <button onClick={() => { onToggleMgr(); setIsOpen(false); }} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3">
                            <Calendar size={16} className={showMgr ? "text-blue-600" : "text-slate-500"}/>
                            {showMgr ? "Hide Profile Timeline" : "Manage Profile Timeline"}
                         </button>
                    </div>
                </>
            )}
        </div>
    );
};

// --- EXPENSE SUMMARY COMPONENT ---
const ExpenseSummary = ({ activeScenario, simulationDate }) => {
    const [expandedYear, setExpandedYear] = useState(null);

    const summaryData = useMemo(() => {
        const startYear = getYear(simulationDate);
        const projectionYears = 35;

        // FIXED: Updated path to assumptions
        const assumptions = activeScenario.data.assumptions || activeScenario.data.globals || { inflation: { general: 0.025 } };
        const inflationRate = assumptions.inflation.general || 0.025;
        const brianBirthYear = activeScenario.data.income.brian.birthYear || 1966;

        // 1. Pre-Calculate Loan Schedules
        const loanAnnualTotals = {};

        Object.values(activeScenario.data.loans).forEach(loan => {
            if (!loan.active) return;

            const stratId = loan.activeStrategyId || 'base';
            const strategy = loan.strategies?.[stratId] || { extraPayments: {} };

            let result;
            if (loan.type === 'revolving') {
                result = calculateRevolvingLoan(loan.inputs, strategy.extraPayments);
            } else {
                result = calculateFixedLoan(loan.inputs, strategy.extraPayments);
            }

            result.schedule.forEach(row => {
                const y = row.date.split('-')[0];
                if (!loanAnnualTotals[y]) loanAnnualTotals[y] = {};
                if (!loanAnnualTotals[y][loan.id]) {
                    loanAnnualTotals[y][loan.id] = { name: loan.name, amount: 0 };
                }
                loanAnnualTotals[y][loan.id].amount += row.payment;
            });
        });

        // 2. Base Recurring Costs (Annualized)
        const calcAnnual = (arr) => arr.reduce((sum, i) => sum + (i.amount || 0), 0) * 12;
        const baseBills = calcAnnual(activeScenario.data.expenses.bills);
        const baseHome = calcAnnual(activeScenario.data.expenses.home);
        const baseLiving = calcAnnual(activeScenario.data.expenses.living);
        const baseImpounds = calcAnnual(activeScenario.data.expenses.impounds);

        const data = [];

        for (let i = 0; i < projectionYears; i++) {
            const year = startYear + i;
            const inflationMult = Math.pow(1 + inflationRate, i);
            const brianAge = year - brianBirthYear;

            // A. Inflated Recurring Expenses
            const recurring = (baseBills + baseHome + baseLiving + baseImpounds) * inflationMult;

            // B. Loans
            let loanTotal = 0;
            const loanDetails = [];
            const yearLoans = loanAnnualTotals[String(year)];

            if (yearLoans) {
                Object.values(yearLoans).forEach(l => {
                    if (l.amount > 0) {
                        loanTotal += l.amount;
                        loanDetails.push(l);
                    }
                });
            }

            // C. One-Offs
            const oneOffs = activeScenario.data.expenses.oneOffs
                .filter(item => item.date.startsWith(String(year)))
                .map(item => ({ name: item.name, amount: item.amount }));
            const oneOffTotal = oneOffs.reduce((sum, item) => sum + item.amount, 0);

            // D. Fun Money Rules
            let funMoneyTotal = 0;
            let bracketLabel = "";
            const brackets = activeScenario.data.expenses.retirementBrackets || {};

            const activeBracket = [90, 85, 80, 75, 70, 65].find(b => brianAge >= b && brianAge < b + 5);
            if (activeBracket) {
                 funMoneyTotal = brackets[activeBracket] || 0;
                 bracketLabel = `Age ${activeBracket}-${activeBracket+4} Rule`;
            }

            const total = recurring + loanTotal + oneOffTotal + funMoneyTotal;

            data.push({
                year,
                brianAge,
                total,
                breakdown: {
                    recurring,
                    loans: loanTotal,
                    loanDetails,
                    planned: oneOffTotal,
                    plannedDetails: oneOffs,
                    funMoney: funMoneyTotal,
                    funMoneyLabel: bracketLabel
                }
            });
        }
        return data;
    }, [activeScenario, simulationDate]);

    const FIXED_MAX = 300000;

    return (
        <div className="bg-white p-4">

            {/* BAR CHART */}
            <div className="h-40 flex items-end gap-1 mb-6 border-b border-slate-100 pb-2 overflow-x-auto relative">
                <div className="absolute top-0 left-0 right-0 border-t border-slate-200 border-dashed pointer-events-none">
                     <span className="text-[9px] text-slate-400 absolute right-0 -top-4">Max: $300k</span>
                </div>

                {summaryData.map((d, i) => {
                    const rawPct = (d.total / FIXED_MAX) * 100;
                    const height = Math.min(rawPct, 100);
                    const isOverflow = rawPct > 100;

                    return (
                        <div key={d.year} className="flex-1 min-w-[20px] flex flex-col justify-end group relative h-full">
                             <div
                                className={`rounded-t w-full transition-colors relative ${isOverflow ? 'bg-red-500' : 'bg-emerald-500 hover:bg-emerald-600'}`}
                                style={{ height: `${height}%`, minHeight: '4px' }}
                             >
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-20 pointer-events-none">
                                    <div className="font-bold">{d.year} (Age {d.brianAge})</div>
                                    <div>${Math.round(d.total/1000)}k</div>
                                    {isOverflow && <div className="text-red-300 text-[9px] font-bold">Exceeds Scale</div>}
                                </div>
                             </div>
                        </div>
                    );
                })}
            </div>

            {/* DATA TABLE */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="grid grid-cols-12 bg-slate-50 text-xs font-bold text-slate-500 uppercase py-2 px-4 border-b border-slate-200">
                    <div className="col-span-2">Year</div>
                    <div className="col-span-2">Age</div>
                    <div className="col-span-6 text-right">Total Projected</div>
                    <div className="col-span-2 text-center">Expand</div>
                </div>
                <div className="divide-y divide-slate-100">
                    {summaryData.map(row => (
                        <div key={row.year} className="bg-white">
                            <div className="grid grid-cols-12 py-2 px-4 text-sm items-center hover:bg-slate-50 transition-colors">
                                <div className="col-span-2 font-bold text-slate-700">{row.year}</div>
                                <div className="col-span-2 text-slate-500">{row.brianAge}</div>
                                <div className="col-span-6 text-right font-mono font-bold text-emerald-600">${row.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                <div className="col-span-2 text-center">
                                    <button
                                        onClick={() => setExpandedYear(expandedYear === row.year ? null : row.year)}
                                        className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-blue-600 transition-colors"
                                    >
                                        {expandedYear === row.year ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                                    </button>
                                </div>
                            </div>

                            {/* EXPANDED DETAILS */}
                            {expandedYear === row.year && (
                                <div className="bg-slate-50 px-8 py-3 text-xs border-t border-slate-100 space-y-2 animate-in slide-in-from-top-1 duration-200">
                                    <div className="flex justify-between border-b border-slate-200 pb-1">
                                        <span className="text-slate-500">Recurring (Inflation Adjusted)</span>
                                        <span className="font-mono">${Math.round(row.breakdown.recurring).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-slate-200 pb-1">
                                        <span className="text-slate-500">Loan Payments</span>
                                        <span className="font-mono">${Math.round(row.breakdown.loans).toLocaleString()}</span>
                                    </div>
                                    {row.breakdown.loanDetails.map((l, idx) => (
                                        <div key={idx} className="flex justify-between pl-4 text-slate-400 italic">
                                            <span>{l.name}</span>
                                            <span>${Math.round(l.amount).toLocaleString()}</span>
                                        </div>
                                    ))}

                                    {(row.breakdown.planned > 0 || row.breakdown.funMoney > 0) && (
                                        <div className="mt-2 pt-1">
                                            <div className="font-bold text-blue-600 mb-1">Extra Planning</div>
                                            {row.breakdown.funMoney > 0 && (
                                                <div className="flex justify-between pl-2 text-blue-500 font-medium">
                                                    <span>{row.breakdown.funMoneyLabel}</span>
                                                    <span>${row.breakdown.funMoney.toLocaleString()}</span>
                                                </div>
                                            )}
                                            {row.breakdown.plannedDetails.map((p, idx) => (
                                                <div key={idx} className="flex justify-between pl-2 text-slate-600">
                                                    <span>{p.name}</span>
                                                    <span>${p.amount.toLocaleString()}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};


// --- FUTURE EXPENSES SUBMODULE ---
const FutureExpensesModule = ({ oneOffs, onChange, onAdd, onDelete, activeScenario, simulationDate, actions }) => {
    const [viewMode, setViewMode] = useState('table');
    const [sortAsc, setSortAsc] = useState(true);
    const [showLongTerm, setShowLongTerm] = useState(false);

    // Get "Fun Money" Brackets
    const retirementBrackets = activeScenario.data.expenses.retirementBrackets || {};
    const brianBirthYear = activeScenario.data.income.brian.birthYear || 1966;

    const brackets = [65, 70, 75, 80, 85, 90];

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
                        notes: 'Auto-pulled from Loans',
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
        return sortAsc ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
    });

    const rollupData = useMemo(() => {
        const groups = {};
        mergedData.forEach(item => {
            if (!item.date) return;
            const [y, m] = item.date.split('-');
            if (!groups[y]) groups[y] = { total: 0, months: {} };
            groups[y].total += item.amount;
            if (!groups[y].months[m]) groups[y].months[m] = { total: 0, items: [] };
            groups[y].months[m].total += item.amount;
            groups[y].months[m].items.push(item);
        });
        return groups;
    }, [mergedData, viewMode]);

    const chartData = useMemo(() => {
        const start = startOfMonth(simulationDate);
        const data = [];
        let maxVal = 0;
        for(let i=0; i<24; i++) {
            const d = addMonths(start, i);
            const key = format(d, 'yyyy-MM');
            const items = mergedData.filter(x => x.date === key);
            const total = items.reduce((sum, x) => sum + x.amount, 0);
            if(total > maxVal) maxVal = total;
            data.push({ date: key, label: format(d, 'MMM yy'), total, items });
        }
        return { data, maxVal };
    }, [mergedData, simulationDate]);


    return (
        <div className="mt-2">
            <div className="flex justify-between items-center mb-4">
                 {/* View Toggles */}
                 <div className="flex bg-slate-100 rounded p-1 border border-slate-200">
                    <button onClick={() => setViewMode('table')} className={`p-1.5 rounded ${viewMode === 'table' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`} title="Data Table"><Table size={16}/></button>
                    <button onClick={() => setViewMode('group')} className={`p-1.5 rounded ${viewMode === 'group' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`} title="Grouped View"><List size={16}/></button>
                    <button onClick={() => setViewMode('chart')} className={`p-1.5 rounded ${viewMode === 'chart' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`} title="Visualize"><BarChart3 size={16}/></button>
                </div>

                {/* Sub-Navigation */}
                <div className="flex gap-4">
                    <button onClick={() => setShowLongTerm(false)} className={`text-xs font-bold px-3 py-1 rounded-full transition-colors ${!showLongTerm ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-100'}`}>Planned Items</button>
                    <button onClick={() => setShowLongTerm(true)} className={`text-xs font-bold px-3 py-1 rounded-full transition-colors ${showLongTerm ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-100'}`}>Long-Term Rules</button>
                </div>
            </div>

            <div className="min-h-[300px]">

                {!showLongTerm && viewMode === 'table' && (
                    <div>
                         <div className="flex justify-between mb-2">
                             <button onClick={() => setSortAsc(!sortAsc)} className="text-xs font-bold text-slate-500 hover:text-blue-600 flex items-center gap-1">Sort by Date {sortAsc ? '▲' : '▼'} </button>
                             <button onClick={onAdd} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 flex items-center gap-1 font-bold shadow-sm"><Plus size={12}/> Add Future Expense</button>
                         </div>
                         <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                             <table className="w-full text-sm text-left">
                                 <thead className="bg-slate-50 text-xs text-slate-500 uppercase font-semibold border-b border-slate-200">
                                     <tr>
                                         <th className="px-4 py-3 w-32">Month/Year</th><th className="px-4 py-3">Expense Name</th><th className="px-4 py-3">Notes</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 w-10"></th>
                                     </tr>
                                 </thead>
                                 <tbody className="divide-y divide-slate-100">
                                     {mergedData.map((item, idx) => (
                                         <tr key={item.id || idx} className={`group ${item.isLocked ? 'bg-slate-50/80' : 'hover:bg-blue-50/30'}`}>
                                             <td className="p-2">{item.isLocked ? <span className="font-mono text-slate-500 px-2">{item.date}</span> : <input type="month" className="w-full border-slate-200 rounded text-slate-600 font-mono text-xs py-1" value={item.date || ''} onChange={(e) => onChange(item.id, 'date', e.target.value)} />}</td>
                                             <td className="p-2">{item.isLocked ? <div className="flex items-center gap-2 px-2"><CreditCard size={12} className="text-blue-400"/><span className="text-slate-500 font-medium">{item.name}</span></div> : <input type="text" className="w-full border-b border-transparent hover:border-slate-200 focus:border-blue-400 outline-none bg-transparent px-2 py-1" value={item.name} onChange={(e) => onChange(item.id, 'name', e.target.value)} placeholder="Description"/>}</td>
                                             <td className="p-2">{item.isLocked ? <span className="text-xs text-slate-400 italic px-2">{item.notes}</span> : <input type="text" className="w-full border-b border-transparent hover:border-slate-200 focus:border-blue-400 outline-none bg-transparent px-2 py-1 text-slate-500" value={item.notes || ''} onChange={(e) => onChange(item.id, 'notes', e.target.value)} placeholder="Optional notes"/>}</td>
                                             <td className="p-2 text-right">{item.isLocked ? <span className="font-mono font-bold text-slate-600 px-2">${item.amount.toLocaleString()}</span> : <input type="number" className="w-full text-right border-b border-transparent hover:border-slate-200 focus:border-blue-400 outline-none bg-transparent px-2 py-1 font-mono font-bold text-slate-700" value={item.amount} onChange={(e) => onChange(item.id, 'amount', parseFloat(e.target.value))} />}</td>
                                             <td className="p-2 text-center">{!item.isLocked && (<button onClick={() => onDelete(item.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14}/></button>)}</td>
                                         </tr>
                                     ))}
                                     {mergedData.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-slate-400 italic">No future expenses planned. Click "Add" to start.</td></tr>}
                                 </tbody>
                             </table>
                         </div>
                    </div>
                )}
                {!showLongTerm && viewMode === 'group' && (
                    <div className="space-y-4">
                        {Object.keys(rollupData).sort().map(year => (
                            <div key={year} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                                <div className="bg-slate-100 px-4 py-2 font-bold text-slate-700 flex justify-between"><span>{year}</span><span>Total: ${rollupData[year].total.toLocaleString()}</span></div>
                                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {Object.keys(rollupData[year].months).sort().map(month => {
                                        const mData = rollupData[year].months[month];
                                        return (
                                            <div key={month} className="border border-slate-100 rounded p-3 shadow-sm">
                                                <div className="flex justify-between border-b border-slate-100 pb-2 mb-2"><span className="font-bold text-blue-600 uppercase text-xs">{new Date(year, month-1).toLocaleString('default', {month:'long'})}</span><span className="font-mono font-bold text-xs">${mData.total.toLocaleString()}</span></div>
                                                <ul className="space-y-1">{mData.items.map((item, i) => (<li key={i} className="flex justify-between text-xs text-slate-600"><span className="truncate pr-2">{item.name}</span><span className="text-slate-400">${item.amount.toLocaleString()}</span></li>))}</ul>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                        {Object.keys(rollupData).length === 0 && <div className="text-center text-slate-400 py-10">No data to display</div>}
                    </div>
                )}
                {!showLongTerm && viewMode === 'chart' && (
                    <div className="bg-white p-6 rounded-lg border border-slate-200 h-[400px] flex items-end justify-between gap-2 overflow-x-auto">
                         {chartData.data.map((col, idx) => {
                             const heightPct = chartData.maxVal > 0 ? (col.total / chartData.maxVal) * 100 : 0;
                             return (<div key={idx} className="flex flex-col items-center gap-2 flex-1 min-w-[30px] h-full justify-end group relative">{col.total > 0 && (<div className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors relative" style={{ height: `${heightPct}%`, minHeight: '4px' }}><div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10 pointer-events-none transition-opacity"><div className="font-bold">${col.total.toLocaleString()}</div><div className="text-[9px] text-slate-300">{col.items.length} items</div></div></div>)}<div className="text-[9px] font-bold text-slate-500 uppercase -rotate-45 origin-top-left translate-y-4 whitespace-nowrap">{col.label}</div></div>);
                         })}
                    </div>
                )}

                {/* --- NEW: LONG TERM RULES --- */}
                {showLongTerm && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="col-span-full bg-blue-50 p-4 rounded text-sm text-slate-600 border border-blue-100 flex items-start gap-3">
                            <Palmtree className="text-blue-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold text-blue-700">Annual "Fun Money" Rules (Retirement)</p>
                                <p>Specify the <strong>annual</strong> budget for travel, vacations, and holidays for each 5-year age bracket starting at Brian's age 65. (Brian born: {brianBirthYear})</p>
                            </div>
                        </div>

                        {brackets.map(age => {
                             const yearStart = brianBirthYear + age;
                             const yearEnd = yearStart + 4;
                             const val = retirementBrackets[age] || 0;

                             return (
                                <div key={age} className="bg-white p-4 rounded border border-slate-200 shadow-sm">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="font-bold text-slate-700">Age {age} - {age + 4}</span>
                                        <span className="text-xs text-slate-400 font-mono bg-slate-100 px-2 py-0.5 rounded">Years: {yearStart}-{yearEnd}</span>
                                    </div>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2 text-slate-400 text-sm">$</span>
                                        <input
                                            type="number"
                                            step="1000"
                                            className="w-full pl-6 border rounded px-3 py-2 font-mono text-slate-700 font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="0"
                                            value={val === 0 ? '' : val}
                                            onChange={(e) => actions.updateScenarioData(`expenses.retirementBrackets.${age}`, parseFloat(e.target.value) || 0)}
                                        />
                                        <span className="absolute right-3 top-2.5 text-xs text-slate-400 uppercase">/ year</span>
                                    </div>
                                </div>
                             )
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---

export default function Expenses() {
  const { store, activeScenario, actions, simulationDate } = useData();
  const [showProfileMgr, setShowProfileMgr] = useState(false);
  const [showFutureMgr, setShowFutureMgr] = useState(false);

  // We edit the "Scenario Data" directly (Scratchpad concept)
  const editData = activeScenario.data.expenses;
  if (!editData.oneOffs) editData.oneOffs = [];
  if (!editData.impounds) editData.impounds = [];

  const profileSequence = editData.profileSequence || [];

  // FIXED: Updated path to assumptions
  const assumptions = activeScenario.data.assumptions || activeScenario.data.globals || {};
  const globalStart = assumptions.timing || { startYear: 2026, startMonth: 1 };
  const globalStartDateStr = `${globalStart.startYear}-${String(globalStart.startMonth).padStart(2, '0')}-01`;

  // --- DERIVE EFFECTIVE PROFILE ---
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

  // --- CALCULATIONS ---
  const calculateTotal = (arr) => arr.reduce((sum, item) => sum + (item.amount || 0), 0);
  const totalBills = calculateTotal(editData.bills);
  const totalHome = calculateTotal(editData.home);
  const totalLiving = calculateTotal(editData.living);
  const totalImpounds = calculateTotal(editData.impounds);

  // One Off Total for Current Month (for Accordion Header)
  const currentMonthKey = format(simulationDate, 'yyyy-MM');
  const totalOneOffsThisMonth = editData.oneOffs
    .filter(item => item.date === currentMonthKey)
    .reduce((sum, item) => sum + item.amount, 0);

  // --- ACTIVE LOANS LOGIC (CORRECTED WITH ENGINE) ---
  const loanCalculations = useMemo(() => {
      const results = {};
      Object.values(activeScenario.data.loans).forEach(loan => {
          if (!loan.active) return;
          const stratId = loan.activeStrategyId || 'base';
          const strategy = loan.strategies?.[stratId] || { extraPayments: {} };

          if (loan.type === 'revolving') {
              results[loan.id] = calculateRevolvingLoan(loan.inputs, strategy.extraPayments);
          } else {
              results[loan.id] = calculateFixedLoan(loan.inputs, strategy.extraPayments);
          }
      });
      return results;
  }, [activeScenario]);

  const activeLoanObjects = Object.values(activeScenario.data.loans).map(loan => {
    if (loan.active === false) return null;
    const calc = loanCalculations[loan.id];
    if (!calc) return null;

    // Find the row for the current simulation month
    const row = calc.schedule.find(r => r.date === currentMonthKey);

    if (!row) return null;

    return {
        id: loan.id,
        name: loan.name,
        type: loan.type,
        minPayment: row.payment - (row.extraApplied || 0),
        extraPayment: row.extraApplied || 0,
        total: row.payment,
        balance: row.endingBalance
    };
  }).filter(Boolean);

  const mortgageLoans = activeLoanObjects.filter(l => l.type === 'mortgage');
  const otherLoans = activeLoanObjects.filter(l => l.type !== 'mortgage');

  const totalMortgageService = mortgageLoans.reduce((sum, item) => sum + item.total, 0);
  const totalDebtService = otherLoans.reduce((sum, item) => sum + item.total, 0);

  const monthlyBurn = totalBills + totalHome + totalLiving + totalImpounds + totalMortgageService + totalDebtService;

  // --- ACTIONS ---
  const updateBill = (category, index, field, value) => {
    const list = [...editData[category]];
    list[index] = { ...list[index], [field]: value };
    actions.updateScenarioData(`expenses.${category}`, list);
  };
  const addBill = (category) => {
    const list = [...editData[category]];
    list.push({ id: Date.now(), name: "New Item", amount: 0 });
    actions.updateScenarioData(`expenses.${category}`, list);
  };
  const removeBill = (category, index) => {
    const list = [...editData[category]];
    list.splice(index, 1);
    actions.updateScenarioData(`expenses.${category}`, list);
  };

  const addFutureExpense = () => { const list = [...editData.oneOffs]; list.push({ id: Date.now(), date: format(simulationDate, 'yyyy-MM'), name: 'New Planned Expense', amount: 0, notes: '' }); actions.updateScenarioData('expenses.oneOffs', list); };
  const updateFutureExpense = (id, field, value) => { const list = editData.oneOffs.map(item => item.id === id ? { ...item, [field]: value } : item); actions.updateScenarioData('expenses.oneOffs', list); };
  const removeFutureExpense = (id) => { const list = editData.oneOffs.filter(item => item.id !== id); actions.updateScenarioData('expenses.oneOffs', list); };

  const handleSaveAsNew = () => { const name = prompt(`Name this New Expense profile:`); if(name) actions.saveProfile('expenses', name, editData); };
  const handleSaveChanges = () => { if (activeProfile && confirm(`Overwrite profile "${activeProfile.name}" with current changes?`)) { actions.updateProfile(activeProfile.profileId, editData); } };
  const handleDeleteProfile = (pId, name) => { if(confirm(`Delete profile "${name}"?`)) { actions.deleteProfile(pId); } };
  const handleRenameProfile = (pId, currentName) => { const newName = prompt("Enter new profile name:", currentName); if (newName && newName !== currentName) { actions.renameProfile(pId, newName); } };

  const handleToggle = (pId, active, date) => {
      if (active) {
          const conflict = profileSequence.find(p => p.isActive && p.startDate === date && p.profileId !== pId);
          if (conflict) {
              if(!confirm(`Warning: Another profile is already active on ${date}. \n\nReplace it?`)) return;
              actions.toggleProfileInScenario('expenses', conflict.profileId, false, conflict.startDate);
          }
      }
      if (!active) {
          const proposedActive = profileSequence.filter(p => p.profileId !== pId && p.isActive && !isAfter(parseISO(p.startDate), simulationDate));
          const itemBeingDisabled = profileSequence.find(p => p.profileId === pId);
          const isRelevantToCurrentDate = !isAfter(parseISO(itemBeingDisabled?.startDate || date), simulationDate);
          if (isRelevantToCurrentDate && proposedActive.length === 0) { alert("Cannot disable: At least one profile must be active."); return; }
      }
      actions.toggleProfileInScenario('expenses', pId, active, date);
  };

  const availableProfiles = Object.values(store.profiles || {}).filter(p => p.type === 'expenses');

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      <div className="bg-white border-b border-slate-200 px-8 py-6 shadow-sm z-10">
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="flex items-center gap-3">
                 <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Receipt /> Expense Manager</h2>
                 <div className="flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-full border border-blue-100"><span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Active:</span><span className="text-xs font-bold text-blue-700">{activeProfileName}</span></div>
            </div>
            <div className="flex items-center gap-2 mt-2"><span className="text-sm text-slate-500">Total Monthly Burn:</span><span className="text-xl font-bold text-red-500">${Math.round(monthlyBurn).toLocaleString()}</span></div>
          </div>

          <div className="flex flex-col items-end gap-2">
             <ProfileMenu
                activeProfileName={activeProfileName}
                onSave={handleSaveChanges}
                onSaveAs={handleSaveAsNew}
                onToggleMgr={() => setShowProfileMgr(!showProfileMgr)}
                showMgr={showProfileMgr}
             />
          </div>
        </div>

        {showProfileMgr && (
            <div className="mb-6 bg-slate-50 rounded-lg border border-slate-200 p-4">
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
                                    <button onClick={() => handleRenameProfile(p.id, p.name)} className="p-1 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors" title="Rename Profile"><Pencil size={14} /></button>
                                </div>
                                <div className="flex items-center gap-2"><span className="text-xs text-slate-400 uppercase">Starts:</span><input type="date" className="text-sm border rounded px-2 py-1" value={startDate} disabled={!isActive} onChange={(e) => handleToggle(p.id, true, e.target.value)} /></div>
                                {!isActive && (<button onClick={() => handleDeleteProfile(p.id, p.name)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors" title="Delete Profile"><Trash2 size={16} /></button>)}
                            </div>
                        );
                    })}
                </div>
            </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-8 max-w-4xl mx-auto w-full">

          {/* 0. EXPENSE SUMMARY (PROJECTION) */}
          <Accordion title="Expense Summary (Projection)" total={0} defaultOpen={false}>
              <ExpenseSummary activeScenario={activeScenario} simulationDate={simulationDate} />
          </Accordion>

          {/* 1. BILLS */}
          <Accordion title="Recurring Bills" total={totalBills} defaultOpen={true} onAdd={() => addBill('bills')}>
             <div className="space-y-1">{editData.bills.map((item, idx) => (<BillRow key={idx} item={item} onChange={(f, v) => updateBill('bills', idx, f, v)} onDelete={() => removeBill('bills', idx)} />))}</div>
          </Accordion>

          {/* 2. MORTGAGE & IMPOUNDS */}
          <Accordion title="Mortgage & Impounds" total={totalMortgageService + totalImpounds} defaultOpen={true} onAdd={() => addBill('impounds')}>
             <div className="space-y-1">
                 {/* Active Mortgage Loans (Read Only Injection) */}
                 {mortgageLoans.map(loan => (
                     <div key={loan.id} className="flex items-center justify-between p-2 border-b border-slate-50 bg-blue-50/30 rounded mb-1">
                         <div className="flex items-center gap-2">
                             <CreditCard size={14} className="text-blue-500"/>
                             <span className="text-sm font-bold text-blue-700">{loan.name}</span>
                         </div>
                         <span className="font-mono text-sm font-bold text-blue-700">${loan.total.toLocaleString()}</span>
                     </div>
                 ))}
                 {/* Editable Impound Items (Tax, Insurance) */}
                 {editData.impounds.map((item, idx) => (<BillRow key={idx} item={item} onChange={(f, v) => updateBill('impounds', idx, f, v)} onDelete={() => removeBill('impounds', idx)} />))}
             </div>
          </Accordion>

          {/* 3. HOME EXPENSES */}
          <Accordion title="Home Expenses" total={totalHome} defaultOpen={false} onAdd={() => addBill('home')}>
             <div className="space-y-1">{editData.home.map((item, idx) => (<BillRow key={idx} item={item} onChange={(f, v) => updateBill('home', idx, f, v)} onDelete={() => removeBill('home', idx)} />))}</div>
          </Accordion>

          {/* 4. LIVING EXPENSES */}
          <Accordion title="Living Expenses" total={totalLiving} defaultOpen={false} onAdd={() => addBill('living')}>
             <div className="space-y-1">{editData.living.map((item, idx) => (<BillRow key={idx} item={item} onChange={(f, v) => updateBill('living', idx, f, v)} onDelete={() => removeBill('living', idx)} />))}</div>
          </Accordion>

          {/* 5. OTHER LOANS (MOVED & STYLED) */}
          <Accordion title="Other Loans" total={totalDebtService} defaultOpen={false}>
             <div className="space-y-0.5">
                {otherLoans.length === 0 && <div className="text-sm text-slate-400 italic p-2">No other active loans found.</div>}
                {otherLoans.map(loan => (
                    <div key={loan.id} className="py-2 px-2 border-b border-slate-50 last:border-0 hover:bg-slate-50 rounded">
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-bold text-slate-700">{loan.name}</span>
                            <span className="font-mono text-sm font-bold text-slate-700">${loan.total.toLocaleString()}</span>
                        </div>
                        {loan.extraPayment > 0 && (
                           <div className="mt-1 pl-4 border-l-2 border-slate-100 ml-1">
                              <div className="flex justify-between text-xs text-slate-500">
                                 <span>Minimum Pmt</span>
                                 <span>${loan.minPayment.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between text-xs text-blue-600 font-medium">
                                 <span>Extra Principal</span>
                                 <span>${loan.extraPayment.toLocaleString()}</span>
                              </div>
                           </div>
                        )}
                    </div>
                ))}
             </div>
          </Accordion>

          {/* 6. EXTRA EXPENSE PLANNING */}
          <Accordion title="Extra Expense Planning" total={totalOneOffsThisMonth} defaultOpen={false}>
              <FutureExpensesModule
                 oneOffs={editData.oneOffs}
                 activeScenario={activeScenario}
                 onAdd={addFutureExpense}
                 onChange={updateFutureExpense}
                 onDelete={removeFutureExpense}
                 simulationDate={simulationDate}
                 actions={actions}
              />
          </Accordion>

      </div>
    </div>
  );
}