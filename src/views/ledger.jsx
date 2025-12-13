// src/views/ledger.jsx
import React, { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { runFinancialSimulation } from '../utils/financial_engine';
import { ChevronDown, ChevronRight, Info } from 'lucide-react';

const MonthRow = ({ row }) => (
  <tr className="text-xs text-slate-600">
    <td className="px-3 py-1 font-mono text-slate-500">{row.month}</td>
    <td className="px-3 py-1 text-right">${Math.round(row.income).toLocaleString()}</td>
    <td className="px-3 py-1 text-right">${Math.round(row.expenses).toLocaleString()}</td>
    <td className={`px-3 py-1 text-right font-bold ${row.netCashFlow >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>${Math.round(row.netCashFlow).toLocaleString()}</td>
    <td className="px-3 py-1 text-right font-mono">${Math.round(row.balances.liquid + row.balances.retirement + row.balances.inherited).toLocaleString()}</td>
    <td className="px-3 py-1 text-right font-mono">${Math.round(row.balances.property || 0).toLocaleString()}</td>
    <td className="px-3 py-1 text-right font-mono text-red-500">-${Math.round(row.balances.totalDebt + row.balances.reverseMortgage).toLocaleString()}</td>
  </tr>
);

export default function Ledger() {
  const { activeScenario, store } = useData();
  const simulation = useMemo(() => runFinancialSimulation(activeScenario, store.profiles), [activeScenario, store.profiles]);
  const [expandedYear, setExpandedYear] = useState(null);

  const annual = useMemo(() => {
    return simulation.timeline
      .filter(t => t.month === 12)
      .map(t => ({
        year: t.year,
        age: t.age,
        spouseAge: t.spouseAge,
        income: t.annualData.income,
        expenses: t.annualData.expenses,
        netCashFlow: t.annualData.netCashFlow,
        balances: t.balances,
        monthly: simulation.timeline.filter(m => m.year === t.year)
      }));
  }, [simulation]);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <h2 className="text-2xl font-bold text-slate-800">Monthly Ledger</h2>
        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded flex items-center gap-1"><Info size={12}/> Expand a year to inspect monthly flows.</span>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Year</th>
              <th className="px-4 py-3 text-left">Age</th>
              <th className="px-4 py-3 text-right">Income</th>
              <th className="px-4 py-3 text-right">Expenses</th>
              <th className="px-4 py-3 text-right">Net</th>
              <th className="px-4 py-3 text-right">Liquid+Ret</th>
              <th className="px-4 py-3 text-right">Property</th>
              <th className="px-4 py-3 text-right">Debt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {annual.map(row => {
              const isOpen = expandedYear === row.year;
              return (
                <React.Fragment key={row.year}>
                  <tr className="hover:bg-slate-50 cursor-pointer" onClick={() => setExpandedYear(isOpen ? null : row.year)}>
                    <td className="px-4 py-3 font-bold text-slate-700 flex items-center gap-2">
                      {isOpen ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                      {row.year}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{row.age} / {row.spouseAge}</td>
                    <td className="px-4 py-3 text-right">${Math.round(row.income).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">${Math.round(row.expenses).toLocaleString()}</td>
                    <td className={`px-4 py-3 text-right font-bold ${row.netCashFlow >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>${Math.round(row.netCashFlow).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono">${Math.round(row.balances.liquid + row.balances.retirement + row.balances.inherited).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono">${Math.round(row.balances.property || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono text-red-500">-${Math.round(row.balances.totalDebt + row.balances.reverseMortgage).toLocaleString()}</td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-slate-50">
                      <td colSpan={8} className="px-4 py-2">
                        <div className="overflow-x-auto max-h-64">
                          <table className="w-full">
                            <thead className="text-[11px] uppercase text-slate-500 bg-white">
                              <tr>
                                <th className="px-3 py-2 text-left">Month</th>
                                <th className="px-3 py-2 text-right">Income</th>
                                <th className="px-3 py-2 text-right">Expenses</th>
                                <th className="px-3 py-2 text-right">Net</th>
                                <th className="px-3 py-2 text-right">Liquid+Ret</th>
                                <th className="px-3 py-2 text-right">Property</th>
                                <th className="px-3 py-2 text-right">Debt</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {row.monthly.map((m, idx) => (
                                <MonthRow key={`${row.year}-${idx}`} row={m} />
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
