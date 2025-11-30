import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { Save, ChevronDown, ChevronRight, Copy, ArrowRight } from 'lucide-react';

// ... (NumberInput component remains same) ...
const NumberInput = ({ label, value, path, updateData, step = "0.01", suffix }) => {
  const [localValue, setLocalValue] = useState(value);
  useEffect(() => { setLocalValue(value); }, [value]);
  const handleBlur = () => {
    const numericVal = parseFloat(localValue);
    if (!isNaN(numericVal)) { updateData(path, numericVal); } else { setLocalValue(value); }
  };
  return (
    <div className="flex flex-col space-y-1">
      <label className="text-xs font-semibold text-slate-500 uppercase">{label}</label>
      <div className="relative">
        <input type="number" step={step} className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 font-mono transition-shadow" value={localValue} onChange={(e) => setLocalValue(e.target.value)} onBlur={handleBlur} onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }} />
        {suffix && <span className="absolute right-3 top-2 text-xs text-slate-400">{suffix}</span>}
      </div>
    </div>
  );
};

const Section = ({ title, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden mb-4 shadow-sm">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors">
        <span className="font-bold text-slate-700">{title}</span>{isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
      </button>
      {isOpen && <div className="p-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{children}</div>}
    </div>
  );
};

export default function Assumptions() {
  const { activeScenario, actions } = useData();
  const data = activeScenario.data;
  const updateData = actions.updateScenarioData;

  const handleClone = () => { const name = prompt("Name for Snapshot:", `${activeScenario.name} (Copy)`); if(name) { actions.createScenario(name); alert(`Created: ${name}`); } };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Model Assumptions</h2>
          <p className="text-slate-500 text-sm mt-1">Editing Scenario: <span className="font-semibold text-blue-600">{activeScenario.name}</span></p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleClone} className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 rounded hover:bg-slate-50 text-sm font-medium border border-slate-300 shadow-sm transition-colors"><Copy size={16} /> Clone Scenario</button>
        </div>
      </header>

      {/* 1. GLOBAL SETTINGS */}
      <Section title="1. Global Economic Assumptions" defaultOpen={true}>
        <NumberInput label="General Inflation (CPI)" value={data.globals.inflation.general} path="globals.inflation.general" step="0.001" suffix="dec" updateData={updateData} />
        <NumberInput label="Medical Inflation" value={data.globals.inflation.medical} path="globals.inflation.medical" step="0.001" suffix="dec" updateData={updateData} />
        <NumberInput label="Property Tax Cap" value={data.globals.inflation.propertyTax} path="globals.inflation.propertyTax" step="0.001" suffix="dec" updateData={updateData} />
        <div className="col-span-full h-px bg-slate-100 my-2"></div>
        <NumberInput label="Market Return (Initial)" value={data.globals.market.initial} path="globals.market.initial" step="0.001" suffix="dec" updateData={updateData} />
        <NumberInput label="Market Return (Terminal)" value={data.globals.market.terminal} path="globals.market.terminal" step="0.001" suffix="dec" updateData={updateData} />
        <NumberInput label="Return Taper End Age" value={data.globals.market.taperEndAge} path="globals.market.taperEndAge" step="1" suffix="yrs" updateData={updateData} />
      </Section>

      {/* 2. INCOME & WORK */}
      <Section title="2. Income & Contributions">
        <NumberInput label="Brian: Net Annual Salary" value={data.income.brian.netSalary} path="income.brian.netSalary" step="1000" updateData={updateData} />
        <NumberInput label="Brian: Gross (for 401k calc)" value={data.income.brian.grossForContrib} path="income.brian.grossForContrib" step="1000" updateData={updateData} />
        <NumberInput label="Brian: 401k Contrib Rate" value={data.income.brian.contribPercent} path="income.brian.contribPercent" step="0.01" suffix="dec" updateData={updateData} />
        <div className="col-span-full h-px bg-slate-100 my-2"></div>
        <NumberInput label="Andrea: Net Annual Salary" value={data.income.andrea.netSalary} path="income.andrea.netSalary" step="1000" updateData={updateData} />
        <NumberInput label="Andrea: Gross (for 401k calc)" value={data.income.andrea.grossForContrib} path="income.andrea.grossForContrib" step="1000" updateData={updateData} />
        <NumberInput label="Andrea: 401k Contrib Rate" value={data.income.andrea.contribPercent} path="income.andrea.contribPercent" step="0.01" suffix="dec" updateData={updateData} />
      </Section>

      {/* 3. ASSETS (Redirect) */}
      <Section title="3. Asset & Debt Management">
        <div className="col-span-full bg-blue-50 p-4 rounded text-slate-600 flex items-center gap-3">
             <div className="flex-1 text-sm">
                <strong>Assets have moved!</strong><br/>
                Starting balances for 401k, IRAs, and Property are now managed in the comprehensive <strong>Assets Module</strong>.
             </div>
             <a href="#" className="font-bold text-blue-600 flex items-center gap-1 hover:underline">Go to Assets <ArrowRight size={16}/></a>
        </div>
        <div className="col-span-full h-px bg-slate-100 my-2"></div>
        <NumberInput label="Mortgage Principal" value={data.loans.mortgage.inputs.principal} path="loans.mortgage.inputs.principal" step="1000" updateData={updateData} />
        <NumberInput label="Mortgage Rate" value={data.loans.mortgage.inputs.rate} path="loans.mortgage.inputs.rate" step="0.001" suffix="dec" updateData={updateData} />
      </Section>
    </div>
  );
}