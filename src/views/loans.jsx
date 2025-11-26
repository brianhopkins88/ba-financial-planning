import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { calculateFixedLoan, calculateRevolvingLoan } from '../utils/loan_math';
import { format, parseISO } from 'date-fns';
import { ChevronRight, Plus, Trash2, DollarSign, Settings, Power } from 'lucide-react';

const ConfigInput = ({ label, value, type = "text", onChange, step, suffix, readOnly = false }) => (
  <div className="flex flex-col space-y-1">
    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</label>
    <div className="relative">
      <input
        type={type}
        step={step}
        readOnly={readOnly}
        className={`w-full border rounded px-3 py-2 text-sm font-medium outline-none transition-all ${
          readOnly
            ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
            : 'bg-white border-slate-200 text-slate-700 focus:ring-2 focus:ring-blue-500'
        }`}
        value={value}
        onChange={(e) => onChange(type === 'number' ? parseFloat(e.target.value) : e.target.value)}
      />
      {suffix && <span className="absolute right-3 top-2 text-xs text-slate-400">{suffix}</span>}
    </div>
  </div>
);

const LoanList = ({ loans, select, selected, add }) => (
  <div className="w-64 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 h-full">
    <div className="p-4 border-b border-slate-100 font-bold text-slate-700 flex justify-between items-center">
      <span>Your Accounts</span>
      <button onClick={add} className="text-blue-600 hover:bg-blue-50 p-1 rounded transition-colors"><Plus size={18} /></button>
    </div>
    <div className="flex-1 overflow-y-auto p-2 space-y-1">
      {Object.values(loans).map((l) => (
        <button
          key={l.id}
          onClick={() => select(l.id)}
          className={`w-full text-left px-4 py-3 rounded-md flex items-center justify-between transition-colors ${
            selected === l.id ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <div className="flex flex-col overflow-hidden">
            <span className={`font-medium text-sm truncate ${!l.active ? 'text-slate-400 line-through' : ''}`}>{l.name}</span>
            <span className="text-[10px] uppercase tracking-wider text-slate-400">{l.type} {l.active ? '' : '(Inactive)'}</span>
          </div>
          {selected === l.id && <ChevronRight size={16} />}
        </button>
      ))}
    </div>
  </div>
);

export default function Loans() {
  const { activeScenario, actions } = useData();
  const loans = activeScenario.data.loans || {};
  const loanKeys = Object.keys(loans);
  const [selectedLoanId, setSelectedLoanId] = useState(loanKeys[0] || null);

  const [dragStartIdx, setDragStartIdx] = useState(null);
  const [dragEndIdx, setDragEndIdx] = useState(null);
  const isDragging = dragStartIdx !== null;

  const activeLoanId = loans[selectedLoanId] ? selectedLoanId : (loanKeys.length > 0 ? loanKeys[0] : null);
  const loan = activeLoanId ? loans[activeLoanId] : null;

  useEffect(() => {
    if (activeLoanId !== selectedLoanId) {
      setSelectedLoanId(activeLoanId);
    }
  }, [activeLoanId, selectedLoanId]);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) commitDrag();
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isDragging, dragStartIdx, dragEndIdx]);

  if (!loan) {
    return (
      <div className="flex h-full">
        <LoanList loans={loans} select={setSelectedLoanId} selected={selectedLoanId} add={actions.addLoan} />
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
          <div className="bg-slate-100 p-4 rounded-full mb-4"><DollarSign size={32} /></div>
          <p>No accounts found.</p>
          <button onClick={actions.addLoan} className="mt-4 text-blue-600 font-bold hover:underline">Create a new Loan</button>
        </div>
      </div>
    );
  }

  const strategies = loan.strategies;
  const activeStratId = loan.activeStrategyId || 'base';
  const activeStrategy = strategies[activeStratId] || strategies['base'];

  const calculation = useMemo(() => {
    const inputs = loan.inputs;
    const strategyPayments = activeStrategy.extraPayments || {};
    if (loan.type === 'fixed') return calculateFixedLoan(inputs, strategyPayments);
    return calculateRevolvingLoan(inputs, strategyPayments);
  }, [loan, activeStrategy]);

  const startDrag = (e, index) => { e.stopPropagation(); setDragStartIdx(index); setDragEndIdx(index); };
  const onEnterCell = (index) => { if (isDragging) setDragEndIdx(index); };
  const commitDrag = () => {
    if (dragStartIdx === null || dragEndIdx === null) return;
    const start = Math.min(dragStartIdx, dragEndIdx);
    const end = Math.max(dragStartIdx, dragEndIdx);
    const sourceValue = calculation.schedule[dragStartIdx].extraApplied || 0;
    const updates = {};
    for (let i = start; i <= end; i++) {
        updates[calculation.schedule[i].date] = sourceValue;
    }
    actions.batchUpdateLoanPayments(activeLoanId, activeStratId, updates);
    setDragStartIdx(null); setDragEndIdx(null);
  };

  const updateInput = (field, val) => actions.updateScenarioData(`loans.${activeLoanId}.inputs.${field}`, val);
  const updateMeta = (field, val) => actions.updateScenarioData(`loans.${activeLoanId}.${field}`, val);

  const handleToggleActive = () => {
    updateMeta('active', !loan.active);
  };

  const handleFixedInput = (field, newVal) => {
    updateInput(field, newVal);
    const currentInputs = { ...loan.inputs, [field]: newVal };
    const { principal, rate, termMonths } = currentInputs;
    if (principal > 0 && rate > 0 && termMonths > 0) {
      const monthlyRate = rate / 12;
      const numerator = principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths);
      const denominator = Math.pow(1 + monthlyRate, termMonths) - 1;
      const payment = numerator / denominator;
      updateInput('payment', Number(payment.toFixed(2)));
    }
  };

  const handleDeleteLoan = () => { if(confirm(`Delete "${loan.name}"?`)) actions.deleteLoan(activeLoanId); };
  const handleExtraPaymentChange = (monthKey, amount) => {
    const path = `loans.${activeLoanId}.strategies.${activeStratId}.extraPayments.${monthKey}`;
    actions.updateScenarioData(path, amount <= 0 ? 0 : amount);
  };
  const handleCreateStrategy = () => { const name = prompt("New Strategy Name:"); if(name) actions.addLoanStrategy(activeLoanId, name); };
  const handleDeleteStrategy = () => { if(activeStratId !== 'base' && confirm(`Delete strategy?`)) actions.deleteLoanStrategy(activeLoanId, activeStratId); };

  return (
    <div className="flex h-full select-none">
      <LoanList loans={loans} select={setSelectedLoanId} selected={activeLoanId} add={actions.addLoan} />
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">

        {/* CONFIG HEADER */}
        <div className="bg-white border-b border-slate-200 px-8 py-6 shadow-sm z-10">
          <div className="flex justify-between items-start mb-6">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                 <input
                    className={`text-2xl font-bold border-none focus:ring-0 p-0 w-full placeholder-slate-300 ${!loan.active ? 'text-slate-400 line-through' : 'text-slate-800'}`}
                    value={loan.name}
                    onChange={(e) => updateMeta('name', e.target.value)}
                    placeholder="Loan Name"
                  />
                  <button
                    onClick={handleToggleActive}
                    className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${loan.active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                  >
                    <Power size={12} /> {loan.active ? 'Active' : 'Inactive'}
                  </button>
              </div>
              <div className="flex items-center gap-4 mt-2">
                <label className="flex items-center gap-2 text-sm text-slate-500 cursor-pointer">
                  <input type="radio" checked={loan.type === 'fixed'} onChange={() => updateMeta('type', 'fixed')} /> Fixed
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-500 cursor-pointer">
                  <input type="radio" checked={loan.type === 'revolving'} onChange={() => updateMeta('type', 'revolving')} /> Revolving
                </label>
              </div>
            </div>
            <button onClick={handleDeleteLoan} className="text-slate-400 hover:text-red-600 transition-colors p-2 rounded hover:bg-red-50"><Trash2 size={18} /></button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-100">
             <ConfigInput label="Start Date" value={loan.inputs.startDate || ''} type="text" onChange={(v) => updateInput('startDate', v)} />
            {loan.type === 'fixed' ? (
              <>
                <ConfigInput label="Principal" value={loan.inputs.principal} type="number" step="1000" onChange={(v) => handleFixedInput('principal', v)} />
                <ConfigInput label="Rate (Dec)" value={loan.inputs.rate} type="number" step="0.001" onChange={(v) => handleFixedInput('rate', v)} />
                <ConfigInput label="Monthly PMT" value={loan.inputs.payment} type="number" step="10" onChange={(v) => updateInput('payment', v)} />
                <ConfigInput label="Term (Mos)" value={loan.inputs.termMonths} type="number" step="12" onChange={(v) => handleFixedInput('termMonths', v)} />
              </>
            ) : (
              <>
                <ConfigInput label="Current Balance" value={loan.inputs.balance} type="number" step="1000" onChange={(v) => updateInput('balance', v)} />
                <ConfigInput label="Rate (Dec)" value={loan.inputs.rate} type="number" step="0.001" onChange={(v) => updateInput('rate', v)} />
                <ConfigInput label="Planned PMT" value={loan.inputs.payment} type="number" step="10" onChange={(v) => updateInput('payment', v)} />
              </>
            )}
          </div>
        </div>

        {/* STRATEGY BAR */}
        <div className="bg-white border-b border-slate-200 px-8 py-3 flex items-center justify-between">
           <div className="flex items-center gap-3">
             <Settings size={16} className="text-slate-400" />
             <select
                className="bg-transparent text-sm font-semibold text-slate-700 border-none focus:ring-0 cursor-pointer"
                value={activeStratId}
                onChange={(e) => actions.updateScenarioData(`loans.${activeLoanId}.activeStrategyId`, e.target.value)}
              >
                {Object.keys(strategies).map(k => (
                  <option key={k} value={k}>Strategy: {strategies[k].name}</option>
                ))}
              </select>
              <button onClick={handleCreateStrategy} className="p-1 rounded hover:bg-slate-100 text-blue-600" title="Create New"><Plus size={16} /></button>
              {activeStratId !== 'base' && <button onClick={handleDeleteStrategy} className="p-1 rounded hover:bg-red-50 text-red-500"><Trash2 size={16} /></button>}
           </div>
           <div className="flex gap-6">
              <div className="flex items-center gap-2 text-sm"><span className="text-slate-400">Payoff:</span><span className="font-bold text-green-600">{calculation.summary.payoffDate ? format(parseISO(calculation.summary.payoffDate), 'MMM yyyy') : 'Never'}</span></div>
              <div className="flex items-center gap-2 text-sm"><span className="text-slate-400">Total Interest:</span><span className="font-bold text-blue-600">${Math.round(calculation.summary.totalInterest).toLocaleString()}</span></div>
           </div>
        </div>

        {/* TABLE */}
        <div className="flex-1 overflow-auto p-8">
          <table className="w-full text-sm text-left border-collapse bg-white shadow-sm rounded-lg overflow-hidden">
            <thead className="bg-slate-100 text-slate-500 font-semibold uppercase text-xs sticky top-0 shadow-sm z-10">
              <tr>
                <th className="px-4 py-3 border-b">Date</th>
                <th className="px-4 py-3 border-b text-right">Payment</th>
                <th className="px-4 py-3 border-b text-right text-red-600">Interest</th>
                <th className="px-4 py-3 border-b text-right text-blue-600">Principal</th>
                <th className="px-4 py-3 border-b text-right bg-blue-50 border-l border-blue-100 w-32">Extra Principal</th>
                <th className="px-4 py-3 border-b text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {calculation.schedule.map((row, index) => {
                 const inDragRange = isDragging && index >= Math.min(dragStartIdx, dragEndIdx) && index <= Math.max(dragStartIdx, dragEndIdx);
                 return (
                  <tr key={row.date} className="hover:bg-slate-50 group">
                    <td className="px-4 py-2 font-mono text-slate-600 whitespace-nowrap">{row.displayDate}</td>
                    <td className="px-4 py-2 text-right font-medium text-slate-700">${Math.round(row.payment).toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-red-500">${Math.round(row.interest).toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-blue-600">${Math.round(row.principal).toLocaleString()}</td>
                    <td className={`px-0 py-0 text-right border-l border-blue-100 relative ${inDragRange ? 'bg-blue-100' : 'bg-blue-50/30'}`} onMouseEnter={() => onEnterCell(index)}>
                       <input type="number" className="w-full h-full bg-transparent text-right px-4 py-2 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-blue-800 font-bold" placeholder="-" value={row.extraApplied || ''} onChange={(e) => handleExtraPaymentChange(row.date, parseFloat(e.target.value))} />
                       <div className="absolute bottom-0 right-0 w-3 h-3 bg-blue-500 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity z-20" onMouseDown={(e) => startDrag(e, index)} />
                    </td>
                    <td className="px-4 py-2 text-right font-bold text-slate-800">${Math.round(row.endingBalance).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}