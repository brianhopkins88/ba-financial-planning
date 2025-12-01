import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { Save, ChevronDown, ChevronRight, Copy, ArrowRight, Info } from 'lucide-react';

const NumberInput = ({ label, value, path, updateData, step = "0.01", suffix, helpText }) => {
  const [localValue, setLocalValue] = useState(value);
  useEffect(() => { setLocalValue(value); }, [value]);
  const handleBlur = () => {
    const numericVal = parseFloat(localValue);
    if (!isNaN(numericVal)) { updateData(path, numericVal); }
    else { setLocalValue(value); }
  };
  return (
    <div className="flex flex-col space-y-1">
      <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">
        {label}
      </label>
      <div className="relative">
        <input
            type="number" step={step}
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 font-mono transition-shadow"
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
        />
        {suffix && <span className="absolute right-3 top-2 text-xs text-slate-400">{suffix}</span>}
      </div>
      {helpText && <p className="text-[10px] text-slate-400 leading-tight pt-0.5">{helpText}</p>}
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
      {isOpen && <div className="p-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 align-start">{children}</div>}
    </div>
  );
};

export default function Assumptions() {
  const { activeScenario, actions } = useData();
  const data = activeScenario.data;

  // Ensure we have the structure (polyfill for older files)
  const assumptions = data.assumptions || data.globals || {};
  if(!assumptions.inflation) assumptions.inflation = {};
  if(!assumptions.market) assumptions.market = {};
  if(!assumptions.rates) assumptions.rates = {};
  if(!assumptions.property) assumptions.property = { baselineGrowth: 0.02, newHomeAddon: 0.015, midHomeAddon: 0.007 };

  const updateData = actions.updateScenarioData;

  const handleClone = () => {
      const name = prompt("Name for Snapshot:", `${activeScenario.name} (Copy)`);
      if(name) { actions.createScenario(name); alert(`Created: ${name}`); }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Model Assumptions</h2>
          <p className="text-slate-500 text-sm mt-1">Editing Scenario: <span className="font-semibold text-blue-600">{activeScenario.name}</span></p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleClone} className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 rounded hover:bg-slate-50 text-sm font-medium border border-slate-300 shadow-sm transition-colors">
            <Copy size={16} /> Clone Scenario
          </button>
        </div>
      </header>

      {/* 1. GLOBAL SETTINGS */}
      <Section title="1. Global Economic Assumptions" defaultOpen={true}>
        <NumberInput label="General Inflation (CPI)" value={assumptions.inflation.general} path="assumptions.inflation.general" step="0.001" suffix="dec"
            helpText="Annual increase for living expenses and non-specified bills." />
        <NumberInput label="Medical Inflation" value={assumptions.inflation.medical} path="assumptions.inflation.medical" step="0.001" suffix="dec"
            helpText="Specific inflation rate for healthcare costs in retirement." />
        <NumberInput label="Property Tax Cap" value={assumptions.inflation.propertyTax} path="assumptions.inflation.propertyTax" step="0.001" suffix="dec"
            helpText="Max annual increase for property taxes (e.g. Prop 13 limit)." />
        <NumberInput label="Property Insurance Inf." value={assumptions.inflation.propertyInsurance} path="assumptions.inflation.propertyInsurance" step="0.001" suffix="dec"
            helpText="Annual inflation rate for home insurance premiums." />

        <div className="col-span-full h-px bg-slate-100 my-2"></div>

        <NumberInput label="Market Return (Initial)" value={assumptions.market.initial} path="assumptions.market.initial" step="0.001" suffix="dec"
            helpText="Inv. growth rate during working years (Accumulation Phase)." />
        <NumberInput label="Market Return (Terminal)" value={assumptions.market.terminal} path="assumptions.market.terminal" step="0.001" suffix="dec"
            helpText="Safe growth rate for late retirement (Preservation Phase)." />
        <NumberInput label="Return Taper End Age" value={assumptions.market.taperEndAge} path="assumptions.market.taperEndAge" step="1" suffix="yrs"
            helpText="Age when portfolio fully shifts to Terminal return rate." />

        <div className="col-span-full h-px bg-slate-100 my-2"></div>

        <NumberInput label="Reverse Mortgage Rate" value={assumptions.rates?.reverseMortgage || 0.065} path="assumptions.rates.reverseMortgage" step="0.001" suffix="dec"
            helpText="Interest rate charged on the R-HELOC balance." />
        <NumberInput label="Reverse Mort. Trigger" value={assumptions.thresholds?.retirementMin || 300000} path="assumptions.thresholds.retirementMin" step="1000"
            helpText="If 401k falls below this, R-HELOC activates to fund deficits." />
      </Section>

      {/* 2. REAL ESTATE MODELING */}
      <Section title="2. Real Estate Growth Model" defaultOpen={false}>
         <div className="col-span-full bg-blue-50 p-3 rounded text-xs text-blue-800 mb-2 border border-blue-100 flex gap-2">
            <Info size={16} className="flex-shrink-0 mt-0.5"/>
            <span>
                <strong>How it works:</strong> Home values grow annually by the <strong>Baseline Growth</strong> plus an Age-Based Add-on.
                Set Baseline > 0 to see any appreciation.
            </span>
         </div>
         <NumberInput label="Macro Baseline Growth" value={assumptions.property.baselineGrowth} path="assumptions.property.baselineGrowth" step="0.001" suffix="dec"
            helpText="Fundamental appreciation rate applied to ALL properties." />
         <NumberInput label="Max Growth Cap" value={assumptions.property.maxGrowth} path="assumptions.property.maxGrowth" step="0.001" suffix="dec"
            helpText="Hard ceiling on annual appreciation (prevents runaway values)." />
         <div className="hidden lg:block"></div>

         <div className="col-span-full h-px bg-slate-100 my-2"></div>

         <NumberInput label="New Home Add-on" value={assumptions.property.newHomeAddon} path="assumptions.property.newHomeAddon" step="0.001" suffix="+"
            helpText="Extra growth for new construction (high demand phase)." />
         <NumberInput label="Mid-Age Add-on" value={assumptions.property.midHomeAddon} path="assumptions.property.midHomeAddon" step="0.001" suffix="+"
            helpText="Extra growth for established modern homes." />
         <NumberInput label="Mature Add-on" value={assumptions.property.matureHomeAddon} path="assumptions.property.matureHomeAddon" step="0.001" suffix="+"
            helpText="Extra growth for older homes (usually 0)." />

         <NumberInput label="New Home Duration" value={assumptions.property.newHomeYears} path="assumptions.property.newHomeYears" step="1" suffix="yrs"
            helpText="Years a home stays in the 'New' pricing tier." />
         <NumberInput label="Mid-Age Duration" value={assumptions.property.midHomeYears} path="assumptions.property.midHomeYears" step="1" suffix="yrs"
            helpText="Years a home stays in the 'Mid' pricing tier." />
      </Section>

      {/* 3. INCOME & WORK */}
      <Section title="3. Income & Contributions">
        <NumberInput label="Brian: Net Annual Salary" value={data.income.brian.netSalary} path="income.brian.netSalary" step="1000"
            helpText="Take-home pay used for monthly cash flow." />
        <NumberInput label="Brian: Gross (401k Calc)" value={data.income.brian.grossForContrib} path="income.brian.grossForContrib" step="1000"
            helpText="Pre-tax amount used ONLY to calc 401k contributions." />
        <NumberInput label="Brian: 401k Contrib Rate" value={data.income.brian.contribPercent} path="income.brian.contribPercent" step="0.01" suffix="dec"
            helpText="% of Gross saved to retirement." />

        <div className="col-span-full h-px bg-slate-100 my-2"></div>

        <NumberInput label="Andrea: Net Annual Salary" value={data.income.andrea.netSalary} path="income.andrea.netSalary" step="1000"
            helpText="Take-home pay used for monthly cash flow." />
        <NumberInput label="Andrea: Gross (401k Calc)" value={data.income.andrea.grossForContrib} path="income.andrea.grossForContrib" step="1000"
            helpText="Pre-tax amount used ONLY to calc 401k contributions." />
        <NumberInput label="Andrea: 401k Contrib Rate" value={data.income.andrea.contribPercent} path="income.andrea.contribPercent" step="0.01" suffix="dec"
            helpText="% of Gross saved to retirement." />
      </Section>

      {/* 4. ASSETS */}
      <Section title="4. Asset & Debt Management">
        <div className="col-span-full bg-slate-50 p-4 rounded text-slate-600 flex items-center gap-3 border border-slate-200">
             <div className="flex-1 text-sm">
                <strong>Assets have moved!</strong><br/>
                Starting balances for 401k, IRAs, and Property are now managed in the comprehensive <strong>Assets Module</strong>.
             </div>
             <a href="#" className="font-bold text-blue-600 flex items-center gap-1 hover:underline">Go to Assets <ArrowRight size={16}/></a>
        </div>
      </Section>
    </div>
  );
}