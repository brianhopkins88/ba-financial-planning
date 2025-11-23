import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { Save, Download, ChevronDown, ChevronRight, History } from 'lucide-react';

// Helper Component for a single input field
const NumberInput = ({ label, value, path, updateData, step = "0.01", suffix }) => (
  <div className="flex flex-col space-y-1">
    <label className="text-xs font-semibold text-slate-500 uppercase">{label}</label>
    <div className="relative">
      <input
        type="number"
        step={step}
        className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 font-mono"
        value={value}
        onChange={(e) => updateData(path, parseFloat(e.target.value))}
      />
      {suffix && <span className="absolute right-3 top-2 text-xs text-slate-400">{suffix}</span>}
    </div>
  </div>
);

// Helper for collapsible sections
const Section = ({ title, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden mb-4 shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <span className="font-bold text-slate-700">{title}</span>
        {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
      </button>
      {isOpen && <div className="p-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {children}
      </div>}
    </div>
  );
};

export default function Assumptions() {
  const { data, updateData, saveSnapshot } = useData();
  const [snapName, setSnapName] = useState("");

  // Action: Download current state as JSON file
  const handleDownload = () => {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `HGV_Model_Assumptions_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Action: Save Snapshot to internal history
  const handleSnapshot = () => {
    const name = snapName || `Manual Save ${new Date().toLocaleTimeString()}`;
    saveSnapshot(name);
    setSnapName("");
    alert("Snapshot saved successfully!");
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">

      {/* --- HEADER & ACTIONS --- */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Model Assumptions</h2>
          <p className="text-slate-500 text-sm">Adjust the drivers of your financial plan.</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-2 rounded-lg shadow-sm border border-slate-200">
          <input
            type="text"
            placeholder="Snapshot Name (Optional)"
            className="border border-slate-300 rounded px-3 py-2 text-sm"
            value={snapName}
            onChange={(e) => setSnapName(e.target.value)}
          />
          <button onClick={handleSnapshot} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium">
            <History size={16} /> Save to History
          </button>
          <button onClick={handleDownload} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded hover:bg-slate-200 text-sm font-medium border border-slate-300">
            <Download size={16} /> Export File
          </button>
        </div>
      </header>

      {/* --- 1. GLOBAL SETTINGS --- */}
      <Section title="1. Global Economic Assumptions" defaultOpen={true}>
        <NumberInput label="General Inflation (CPI)" value={data.globals.inflation.general} path="globals.inflation.general" step="0.001" suffix="dec" />
        <NumberInput label="Medical Inflation" value={data.globals.inflation.medical} path="globals.inflation.medical" step="0.001" suffix="dec" />
        <NumberInput label="Property Tax Cap (Prop 13)" value={data.globals.inflation.propertyTax} path="globals.inflation.propertyTax" step="0.001" suffix="dec" />

        <div className="col-span-full h-px bg-slate-100 my-2"></div>

        <NumberInput label="Market Return (Initial)" value={data.globals.market.initial} path="globals.market.initial" step="0.001" suffix="dec" />
        <NumberInput label="Market Return (Terminal)" value={data.globals.market.terminal} path="globals.market.terminal" step="0.001" suffix="dec" />
        <NumberInput label="Return Taper End Age" value={data.globals.market.taperEndAge} path="globals.market.taperEndAge" step="1" suffix="yrs" />
      </Section>

      {/* --- 2. INCOME & WORK --- */}
      <Section title="2. Income & Contributions">
        <NumberInput label="Brian: Net Annual Salary" value={data.income.brian.netSalary} path="income.brian.netSalary" step="1000" />
        <NumberInput label="Brian: Gross (for 401k calc)" value={data.income.brian.grossForContrib} path="income.brian.grossForContrib" step="1000" />
        <NumberInput label="Brian: 401k Contrib Rate" value={data.income.brian.contribPercent} path="income.brian.contribPercent" step="0.01" suffix="dec" />

        <div className="col-span-full h-px bg-slate-100 my-2"></div>

        <NumberInput label="Andrea: Net Annual Salary" value={data.income.andrea.netSalary} path="income.andrea.netSalary" step="1000" />
        <NumberInput label="Andrea: Gross (for 401k calc)" value={data.income.andrea.grossForContrib} path="income.andrea.grossForContrib" step="1000" />
        <NumberInput label="Andrea: 401k Contrib Rate" value={data.income.andrea.contribPercent} path="income.andrea.contribPercent" step="0.01" suffix="dec" />
      </Section>

      {/* --- 3. ASSETS --- */}
      <Section title="3. Starting Assets (Nov 2025)">
        <NumberInput label="Joint Investment (Buffer)" value={data.assets.joint} path="assets.joint" step="1000" />
        <NumberInput label="Inherited IRA" value={data.assets.inheritedIRA} path="assets.inheritedIRA" step="1000" />
        <NumberInput label="Combined 401k/403b" value={data.assets.retirement401k} path="assets.retirement401k" step="1000" />
        <NumberInput label="HGV Home Value" value={data.assets.homeValue} path="assets.homeValue" step="1000" />
      </Section>

      {/* --- 4. DEBT --- */}
      <Section title="4. Liabilities (Mortgage & HELOC)">
        <NumberInput label="Mortgage Principal" value={data.loans.mortgage.principal} path="loans.mortgage.principal" step="1000" />
        <NumberInput label="Mortgage Rate" value={data.loans.mortgage.rate} path="loans.mortgage.rate" step="0.001" suffix="dec" />

        <div className="col-span-full h-px bg-slate-100 my-2"></div>

        <NumberInput label="HELOC Balance" value={data.loans.heloc.balance} path="loans.heloc.balance" step="1000" />
        <NumberInput label="HELOC Rate" value={data.loans.heloc.rate} path="loans.heloc.rate" step="0.001" suffix="dec" />
        <NumberInput label="HELOC Min Payment" value={data.loans.heloc.payment} path="loans.heloc.payment" step="10" />
      </Section>

      {/* --- 5. EXPENSES --- */}
      <Section title="5. Monthly Expense Baseline">
        <NumberInput label="Property Tax (Monthly)" value={data.expenses.monthly.propertyTax} path="expenses.monthly.propertyTax" step="10" />
        <NumberInput label="HOA" value={data.expenses.monthly.hoa} path="expenses.monthly.hoa" step="10" />
        <NumberInput label="Home Insurance" value={data.expenses.monthly.insurance} path="expenses.monthly.insurance" step="10" />
        <NumberInput label="Utilities" value={data.expenses.monthly.utilities} path="expenses.monthly.utilities" step="10" />
        <NumberInput label="General Living" value={data.expenses.monthly.living} path="expenses.monthly.living" step="100" />
        <NumberInput label="Medical (Out of Pocket)" value={data.expenses.monthly.medical} path="expenses.monthly.medical" step="10" />
      </Section>

    </div>
  );
}