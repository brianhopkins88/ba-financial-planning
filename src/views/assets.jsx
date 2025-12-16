import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { calculateAssetGrowth } from '../utils/asset_math';
import { runFinancialSimulation } from '../utils/financial_engine';
import { Plus, Trash2, TrendingUp, Home, DollarSign, PiggyBank, Briefcase, Calendar, PenTool, Link, ChevronDown, ChevronRight, X, ArrowRight, Info, Settings, Lock, FileText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { NewConstructionPlanner, HomePurchasePlanner } from '../components/PropertyPlanner';
import { isAfter, parseISO, addYears, format, getYear, isValid } from 'date-fns';
import { TooltipHelp } from '../components/TooltipHelp';

// ... (Sub-components AssetCard, SectionHeader, etc. remain unchanged)
// --- SUB-COMPONENTS ---
const AssetCard = ({ asset, isSelected, onClick, hasOverrides }) => (
  <div onClick={onClick} className={`p-3 rounded-lg cursor-pointer border transition-all mb-2 ${isSelected ? 'bg-blue-50 border-blue-400 shadow-sm' : 'bg-white border-slate-200 hover:border-blue-200'}`}>
    <div className="flex justify-between items-start">
      <div>
        <div className="font-bold text-slate-700 text-sm flex items-center gap-2">
          {asset.name}
          {hasOverrides && <span className="h-2 w-2 rounded-full bg-amber-400" title="Overrides active"></span>}
        </div>
        <div className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">{asset.owner}</div>
      </div>
      <div className="text-right"><div className="font-mono font-bold text-blue-600 text-sm">${(asset.balance || 0).toLocaleString()}</div></div>
    </div>
  </div>
);

const SectionHeader = ({ title, icon: Icon, onAdd }) => (
  <div className="flex justify-between items-center mb-2 mt-6 pb-1 border-b border-slate-100">
    <div className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase tracking-wider"><Icon size={14} /> {title}</div>
    <button onClick={onAdd} className="text-slate-400 hover:text-blue-600 transition-colors"><Plus size={16} /></button>
  </div>
);

const InputGroup = ({ label, value, onChange, type = "text", step }) => (
    <div className="flex flex-col space-y-1">
        <label className="text-[10px] font-bold text-slate-400 uppercase">{label}</label>
        <input type={type} step={step} className="w-full border border-slate-200 rounded px-3 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none" value={value} onChange={(e) => onChange(type === 'number' ? parseFloat(e.target.value) : e.target.value)} />
    </div>
);

const GlobalRuleInput = ({ label, value, onChange, description, icon: Icon = Settings }) => (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-col gap-2">
        <div className="flex justify-between items-center"><label className="text-[10px] font-bold text-blue-600 uppercase flex items-center gap-1"><Icon size={10} /> {label} (Global Rule)</label></div>
        <div className="relative"><span className="absolute left-2 top-1.5 text-slate-400 text-xs">$</span><input type="number" step="1000" className="w-full pl-6 pr-2 py-1.5 border border-slate-200 rounded text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none bg-white" value={value || 0} onChange={(e) => onChange(parseFloat(e.target.value))} /></div>
        <div className="text-[10px] text-slate-500 leading-tight bg-white p-2 rounded border border-slate-100 italic">{description}</div>
    </div>
);

const CarryingList = ({ title, items, onAdd, onUpdate, onRemove, helper }) => (
    <div className="bg-slate-50 p-3 rounded border border-slate-200">
        <div className="flex justify-between items-center mb-2">
            <div className="text-[10px] font-bold uppercase text-slate-500">{title}</div>
            <button onClick={onAdd} className="text-[11px] text-blue-600 font-bold flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-50"><Plus size={12}/> Add</button>
        </div>
        {helper && <div className="text-[11px] text-slate-400 mb-2">{helper}</div>}
        <div className="space-y-1">
            {items.length === 0 && <div className="text-xs text-slate-400 italic">No items defined.</div>}
            {items.map((item, idx) => (
                <div key={item.id || idx} className="flex items-center gap-2 bg-white border border-slate-200 rounded px-2 py-1">
                    <input
                        className="flex-1 text-sm text-slate-700 bg-transparent outline-none"
                        value={item.name}
                        onChange={(e) => onUpdate(idx, 'name', e.target.value)}
                        placeholder="Name"
                    />
                    <div className="relative w-28">
                        <span className="absolute left-2 top-1.5 text-[11px] text-slate-400">$</span>
                        <input
                            type="number"
                            className="w-full pl-5 pr-1 py-1 text-right text-sm font-mono font-bold border border-slate-200 rounded focus:border-blue-500 outline-none"
                            value={item.amount || 0}
                            onChange={(e) => onUpdate(idx, 'amount', parseFloat(e.target.value) || 0)}
                        />
                    </div>
                    <button onClick={() => onRemove(idx)} className="text-slate-300 hover:text-red-500 p-1"><Trash2 size={14}/></button>
                </div>
            ))}
        </div>
    </div>
);

const CustomChartTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        const total = (data.openingBalance || 0) + (data.annualDeposits || 0) + (data.annualGrowth || 0) + (data.equity || 0) + (data.annualWithdrawals || 0);
        return (
            <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-xl text-xs z-50">
                <div className="font-bold text-slate-700 mb-2 border-b border-slate-100 pb-1">Year {data.year}</div>
                <div className="space-y-1">
                     {data.type === 'property' && (<>{data.debt > 0 && (<div className="flex justify-between gap-4"><span className="text-red-500">Linked Debt:</span><span className="font-mono font-bold text-red-500">-${Math.round(data.debt).toLocaleString()}</span></div>)}<div className="flex justify-between gap-4"><span className="text-emerald-600 font-bold">Net Equity:</span><span className="font-mono font-bold text-emerald-600">${Math.round(data.equity).toLocaleString()}</span></div></>)}
                     {data.type === 'liquid' && (<><div className="flex justify-between gap-4"><span className="text-slate-500">Previous Balance:</span><span className="font-mono font-bold text-slate-600">${Math.round(data.openingBalance).toLocaleString()}</span></div>{data.annualDeposits > 0 && (<div className="flex justify-between gap-4"><span className="text-blue-600">+ Deposits:</span><span className="font-mono font-bold text-blue-600">${Math.round(data.annualDeposits).toLocaleString()}</span></div>)}{data.annualGrowth > 0 && (<div className="flex justify-between gap-4"><span className="text-emerald-500">+ Growth:</span><span className="font-mono font-bold text-emerald-500">${Math.round(data.annualGrowth).toLocaleString()}</span></div>)}{data.annualWithdrawals < 0 && (<div className="flex justify-between gap-4 border-t border-red-50 pt-1 mt-1 text-red-600"><span>- Withdrawals:</span><span className="font-mono font-bold">${Math.round(data.annualWithdrawals).toLocaleString()}</span></div>)}</>)}
                     <div className="pt-2 mt-1 border-t border-slate-100 flex justify-between gap-4"><span className="font-bold text-slate-700">Ending Balance:</span><span className="font-mono font-bold text-slate-800">${Math.round(Math.max(0, total)).toLocaleString()}</span></div>
                </div>
            </div>
        );
    }
    return null;
};

export default function Assets() {
  const { activeScenario, store, actions, simulationDate } = useData();
  const accounts = activeScenario.data.assets.accounts || {};
  const loans = activeScenario.data.loans || {};
  const assumptions = activeScenario.data.assumptions || activeScenario.data.globals || {};
  const horizonYears = assumptions.horizonYears || assumptions.horizon || 35;
  const thresholds = assumptions.thresholds || { cashMin: 15000, cashMax: 30000, jointMin: 0, retirementMin: 300000 };
  const registryAssets = store.registry?.assets || {};

  const [selectedId, setSelectedId] = useState(null);
  const [showPlanning, setShowPlanning] = useState(false);
  const [inspectorExpandedYear, setInspectorExpandedYear] = useState(null);

  const grouped = useMemo(() => {
    const g = { retirement: [], inherited: [], joint: [], cash: [], property: [] };
    Object.values(accounts).forEach(a => { if (g[a.type]) g[a.type].push(a); });
    return g;
  }, [accounts]);

  const overrideMap = activeScenario.overrides?.assets || {};
  const activeAsset = accounts[selectedId] || Object.values(accounts)[0];
  const activeId = activeAsset?.id;
  const linkedIds = activeScenario.links?.assets || Object.keys(accounts);

  useEffect(() => {
      setInspectorExpandedYear(null);
  }, [activeId]);

  useEffect(() => {
      if (activeAsset?.type === 'property') {
          const hasPlan = !!activeAsset.inputs?.sellDate || (activeAsset.inputs?.linkedLoanIds && activeAsset.inputs.linkedLoanIds.length > 0);
          setShowPlanning(hasPlan);
      }
  }, [activeId]);

  const handleUpdate = (field, val) => actions.updateScenarioData(`assets.accounts.${activeId}.${field}`, val);
  const handleInputUpdate = (field, val) => actions.updateScenarioData(`assets.accounts.${activeId}.inputs.${field}`, val);
  const handleFullUpdate = (path, val) => actions.updateScenarioData(`assets.accounts.${activeId}.${path}`, val);
  const handleThresholdUpdate = (field, val) => actions.updateScenarioData(`assumptions.thresholds.${field}`, val);

  const updateIraSchedule = (year, value) => {
      const currentSchedule = activeAsset.inputs?.withdrawalSchedule || {};
      const newSchedule = { ...currentSchedule, [year]: value };
      handleInputUpdate('withdrawalSchedule', newSchedule);
  };

  const toggleLinkedLoan = (loanId) => {
      const currentIds = activeAsset.inputs?.linkedLoanIds || (activeAsset.inputs?.linkedLoanId ? [activeAsset.inputs.linkedLoanId] : []);
      let newIds = currentIds.includes(loanId) ? currentIds.filter(id => id !== loanId) : [...currentIds, loanId];
      actions.updateScenarioData(`assets.accounts.${activeId}.inputs.linkedLoanIds`, newIds);
      if (activeAsset.inputs?.linkedLoanId) actions.updateScenarioData(`assets.accounts.${activeId}.inputs.linkedLoanId`, null);
  };

  const carryingCosts = activeAsset?.inputs?.carryingCosts || { impounds: [], other: [] };
  const updateCarryingCost = (bucket, idx, field, val) => {
      const list = carryingCosts[bucket] ? [...carryingCosts[bucket]] : [];
      list[idx] = { ...list[idx], [field]: val };
      actions.updateScenarioData(`assets.accounts.${activeId}.inputs.carryingCosts.${bucket}`, list);
  };
  const addCarryingCost = (bucket) => {
      const list = carryingCosts[bucket] ? [...carryingCosts[bucket]] : [];
      list.push({ id: Date.now(), name: bucket === 'impounds' ? 'New Impound' : 'New Cost', amount: 0 });
      actions.updateScenarioData(`assets.accounts.${activeId}.inputs.carryingCosts.${bucket}`, list);
  };
  const removeCarryingCost = (bucket, idx) => {
      const list = carryingCosts[bucket] ? [...carryingCosts[bucket]] : [];
      list.splice(idx, 1);
      actions.updateScenarioData(`assets.accounts.${activeId}.inputs.carryingCosts.${bucket}`, list);
  };

  // --- PROJECTION ENGINE ---
  const simulation = useMemo(() => runFinancialSimulation(activeScenario, store.profiles), [activeScenario, store.profiles]);

  const balanceInspectorData = useMemo(() => {
     if (!simulation?.timeline || !activeAsset) return { annual: [] };
     const key = activeAsset.type === 'property' ? 'property' : activeAsset.type;
     const annualMap = {};
     const monthName = (m) => new Date(2000, m - 1, 1).toLocaleString('default', { month: 'short' });

     let prevBalance = null;
     let prevFlow = null;
     let prevYear = null;

     simulation.timeline.forEach(row => {
         const year = row.year;
         const balance = row.balances?.[key] ?? 0;
         const flow = row.flows?.[key] || { deposits: 0, withdrawals: 0, growth: 0 };
         const month = row.month || 0;

         if (!annualMap[year]) {
             annualMap[year] = {
                 year,
                 startBalance: balance,
                 endBalance: balance,
                 deposits: 0,
                 withdrawals: 0,
                 growth: 0,
                 months: []
             };
             prevBalance = balance;
             prevFlow = flow;
             prevYear = year;
             return;
         }

         // compute month deltas using cumulative annual flows
         const flowDelta = {
             deposits: flow.deposits - (prevFlow?.deposits || 0),
             withdrawals: flow.withdrawals - (prevFlow?.withdrawals || 0),
             growth: flow.growth - (prevFlow?.growth || 0),
         };
         const monthEntry = {
             month,
             monthLabel: month === 0 ? 'Start' : monthName(month),
             startBalance: prevBalance,
             deposits: flowDelta.deposits,
             withdrawals: flowDelta.withdrawals,
             growth: flowDelta.growth,
             endBalance: balance
         };
         annualMap[year].months.push(monthEntry);
         annualMap[year].deposits += flowDelta.deposits;
         annualMap[year].withdrawals += flowDelta.withdrawals;
         annualMap[year].growth += flowDelta.growth;
         annualMap[year].endBalance = balance;

         prevBalance = balance;
         prevFlow = flow;
         prevYear = year;
     });

     const annual = Object.values(annualMap).sort((a,b) => a.year - b.year);
     return { annual };
  }, [simulation, activeAsset]);

  const projectionData = useMemo(() => {
     if (!activeAsset) return [];
     const events = simulation.events || [];
     let endYear = 9999;
     const soldEvent = events.find(e => e.text.includes(`Sold ${activeAsset.name}`));
     if (soldEvent) endYear = parseInt(soldEvent.date.substring(0, 4));

     if (activeAsset.type === 'property') {
         const rawData = calculateAssetGrowth(activeAsset, assumptions, loans, horizonYears);
         return rawData.map(row => {
             const isStart = row.year === assumptions.timing.startYear;
             const targetMonth = isStart ? 0 : 12;
             const simRow = simulation.timeline.find(t => t.year === row.year && t.month === targetMonth);
             const rmBalance = simRow ? (simRow.balances.reverseMortgage || 0) : 0;
             const totalDebt = row.debt + rmBalance;
             const netEquity = Math.max(0, row.value - totalDebt);
             if (row.year > endYear) return { ...row, value: 0, equity: 0, debt: 0 };
             return { ...row, debt: totalDebt, equity: netEquity, type: 'property' };
         });
     } else {
         const timeline = simulation.timeline;
         const filtered = timeline.filter(t => t.month === 12 || t.month === 0);
         return filtered.map((row, idx) => {
             const typeKey = activeAsset.type;
             const flow = row.flows[typeKey] || { deposits: 0, withdrawals: 0, growth: 0 };
             const label = row.month === 0 ? 'Start' : row.year;
             const endingBalance = row.balances[typeKey];
             let openingBalance = 0;
             if (idx > 0) openingBalance = filtered[idx - 1].balances[typeKey];
             else openingBalance = endingBalance - flow.deposits - flow.growth + flow.withdrawals;

             const isStart = row.month === 0;
             return {
                 year: label, openingBalance,
                 annualDeposits: isStart ? 0 : flow.deposits,
                 annualGrowth: isStart ? 0 : flow.growth,
                 annualWithdrawals: isStart ? 0 : -flow.withdrawals,
                 type: 'liquid'
             };
         });
     }
  }, [activeAsset, activeScenario, loans, store.profiles, simulation]);

  const iraTableData = useMemo(() => {
      if(activeAsset?.type !== 'inherited') return [];
      return calculateAssetGrowth(activeAsset, activeScenario.data.assumptions || {}, loans, horizonYears);
  }, [activeAsset, activeScenario, loans, horizonYears]);

  const isFutureProperty = useMemo(() => {
      if(activeAsset?.type !== 'property') return false;
      const start = activeAsset.inputs?.startDate;
      if(!start) return false;
      return isAfter(parseISO(start), simulationDate);
  }, [activeAsset, simulationDate]);

  const availableRegistryAssets = useMemo(() => Object.values(registryAssets), [registryAssets]);

  return (
    <div className="flex h-full bg-slate-50">
      <div className="w-80 bg-slate-100 border-r border-slate-200 flex flex-col h-full overflow-y-auto p-4 flex-shrink-0">
         <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2"><PiggyBank className="text-blue-600"/> Assets</h2>
         <div className="mb-4">
             <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] font-bold uppercase text-slate-500">Registry Assets</div>
                <div className="text-[10px] text-slate-400">Toggle to include in this scenario</div>
             </div>
             <div className="space-y-1 max-h-32 overflow-y-auto">
                 {availableRegistryAssets.map(a => {
                     const isLinked = linkedIds.includes(a.id);
                     return (
                         <label key={a.id} className="flex items-center gap-2 text-xs text-slate-600 bg-white border border-slate-200 rounded px-2 py-1 hover:border-blue-300">
                             <input type="checkbox" checked={isLinked} onChange={() => isLinked ? actions.unlinkAssetFromScenario(a.id) : actions.linkAssetToScenario(a.id)} />
                             <span className="truncate">{a.name} <span className="uppercase text-[9px] text-slate-400">({a.type})</span></span>
                         </label>
                     );
                 })}
             </div>
         </div>
         <SectionHeader title="Retirement (401k/403b)" icon={Briefcase} onAdd={() => actions.addAsset('retirement')} />
         {grouped.retirement.map(a => <AssetCard key={a.id} asset={a} hasOverrides={!!overrideMap[a.id]} isSelected={activeId === a.id} onClick={() => setSelectedId(a.id)} />)}
         <SectionHeader title="Inherited IRA" icon={TrendingUp} onAdd={() => actions.addAsset('inherited')} />
         {grouped.inherited.map(a => <AssetCard key={a.id} asset={a} hasOverrides={!!overrideMap[a.id]} isSelected={activeId === a.id} onClick={() => setSelectedId(a.id)} />)}
         <SectionHeader title="Joint Investment" icon={TrendingUp} onAdd={() => actions.addAsset('joint')} />
         {grouped.joint.map(a => <AssetCard key={a.id} asset={a} hasOverrides={!!overrideMap[a.id]} isSelected={activeId === a.id} onClick={() => setSelectedId(a.id)} />)}
         <SectionHeader title="Cash Savings" icon={DollarSign} onAdd={() => actions.addAsset('cash')} />
         {grouped.cash.map(a => <AssetCard key={a.id} asset={a} hasOverrides={!!overrideMap[a.id]} isSelected={activeId === a.id} onClick={() => setSelectedId(a.id)} />)}
         <SectionHeader title="Property" icon={Home} onAdd={() => actions.addAsset('property')} />
         {grouped.property.map(a => <AssetCard key={a.id} asset={a} hasOverrides={!!overrideMap[a.id]} isSelected={activeId === a.id} onClick={() => setSelectedId(a.id)} />)}
      </div>

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {activeAsset ? (
           <div className="p-8 overflow-y-auto">
              <div className="flex justify-between items-start mb-8">
                 <div>
                    <input className="text-2xl font-bold bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none w-full text-slate-800 transition-all" value={activeAsset.name} onChange={(e) => handleUpdate('name', e.target.value)} />
                    <div className="flex gap-4 mt-2">
                        <select className="text-xs font-bold uppercase bg-slate-200 rounded px-2 py-1 text-slate-600 outline-none" value={activeAsset.owner} onChange={(e) => handleUpdate('owner', e.target.value)}>
                            <option value="joint">Owner: Joint</option>
                            <option value="primary">Owner: Primary</option>
                            <option value="spouse">Owner: Spouse</option>
                        </select>
                        <span className="text-xs font-bold uppercase bg-blue-100 text-blue-600 rounded px-2 py-1">{activeAsset.type}</span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <TooltipHelp text="Edits update shared registry; sell date/loan links act as scenario overrides." />
                        </span>
                    </div>
                    {overrideMap[activeId] && <div className="mt-2 text-[11px] text-amber-600 font-semibold flex items-center gap-1"><Info size={12}/> Scenario override active</div>}
                 </div>
                 <button onClick={() => { if(confirm("Delete this asset?")) actions.deleteAsset(activeId); }} className="text-slate-400 hover:text-red-600 p-2 rounded hover:bg-red-50"><Trash2 size={20}/></button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                  {/* DYNAMIC LABEL FOR ASSET VALUE */}
                  <InputGroup
                      label={isFutureProperty ? "Total Purchase Price" : "Current Balance / Value"}
                      type="number" step="1000"
                      value={activeAsset.balance}
                      onChange={(v) => handleUpdate('balance', v)}
                  />

                  {(['cash', 'joint', 'retirement'].includes(activeAsset.type)) && (
                      <InputGroup label="Balance Date (Start)" type="date" value={activeAsset.inputs?.startDate || ''} onChange={(v) => handleInputUpdate('startDate', v)} />
                  )}

                  {activeAsset.type === 'property' && (
                      <>
                        <InputGroup label="Active/Start Date" type="date" value={activeAsset.inputs?.startDate || ''} onChange={(v) => handleInputUpdate('startDate', v)} />
                        <InputGroup label="Build Year" type="number" value={activeAsset.inputs?.buildYear || ''} onChange={(v) => handleInputUpdate('buildYear', v)} />
                        <InputGroup label="Zip Code" value={activeAsset.inputs?.zipCode || ''} onChange={(v) => handleInputUpdate('zipCode', v)} />
                        <InputGroup label="Location Factor" type="number" step="0.001" value={activeAsset.inputs?.locationFactor || 0} onChange={(v) => handleInputUpdate('locationFactor', v)} />
                      </>
                  )}

                  {/* UPDATED INHERITED IRA UI */}
                  {activeAsset.type === 'inherited' && (
                      <>
                        <InputGroup label="Inheritance Date (Starts Clock)" type="date" value={activeAsset.inputs?.startDate || ''} onChange={(v) => handleInputUpdate('startDate', v)} />

                        <div className="col-span-4 mt-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Remaining Annual Withdrawal Schedule (Jan 1st)</label>
                            <div className="flex flex-wrap gap-2">
                                {(() => {
                                    // 1. Calculate the 10-year deadline based on Inheritance Date
                                    const inheritanceStr = activeAsset.inputs?.startDate;
                                    if (!inheritanceStr) return <div className="text-xs text-red-400">Please set Inheritance Date first.</div>;
                                    const inheritanceYear = getYear(parseISO(inheritanceStr));
                                    const finalYear = inheritanceYear + 10;

                                    // 2. Calculate the Schedule Start based on Scenario
                                    const scenarioStartYear = assumptions.timing?.startYear || 2026;
                                    // If inheritance was in past, we start scheduling from scenario start.
                                    const startSchedulingYear = Math.max(scenarioStartYear, inheritanceYear);

                                    // 3. Generate Years
                                    const years = [];
                                    for (let y = startSchedulingYear; y <= finalYear; y++) {
                                        years.push(y);
                                    }

                                    if (years.length === 0) return <div className="text-xs text-slate-400">Account Depleted (Deadline Passed).</div>;

                                    return years.map((year) => {
                                        const schedule = activeAsset.inputs?.withdrawalSchedule || {};
                                        const isFinal = year === finalYear;
                                        // FIXED: Default to 0.20 (20%) for empty years
                                        const val = isFinal ? 1.0 : (schedule[year] !== undefined ? schedule[year] : 0.20);

                                        return (
                                            <div key={year} className="flex flex-col bg-slate-50 p-2 rounded border border-slate-100 w-24">
                                                <span className="text-[10px] text-slate-500 font-bold mb-1 text-center">{year}</span>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        step="0.05"
                                                        max="1.0"
                                                        disabled={isFinal}
                                                        className={`w-full text-sm font-mono border rounded px-1 py-0.5 text-center outline-none focus:border-blue-500 ${isFinal ? 'bg-slate-200 text-slate-500 font-bold cursor-not-allowed' : 'bg-white text-blue-700'}`}
                                                        value={val}
                                                        onChange={(e) => updateIraSchedule(year, parseFloat(e.target.value))}
                                                    />
                                                    {!isFinal && <span className="absolute right-1 top-0.5 text-[9px] text-slate-400">%</span>}
                                                    {isFinal && <span className="absolute right-1 top-0.5 text-[8px] text-slate-500 font-bold">ALL</span>}
                                                </div>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-2 italic">
                                * Schedule runs from Scenario Start ({assumptions.timing?.startYear}) to 10th Year Deadline.
                                <br/>* Final year is automatically set to 100% to satisfy IRS rules.
                            </div>
                        </div>
                      </>
                  )}
              </div>

              {activeAsset.type === 'property' && (
                  <div className="mb-8 bg-white rounded-lg shadow-sm border border-orange-200 overflow-hidden">
                      <button onClick={() => setShowPlanning(!showPlanning)} className="w-full flex justify-between items-center p-4 bg-orange-50 hover:bg-orange-100 transition-colors text-orange-800 font-bold">
                          <div className="flex items-center gap-2"><Home size={18}/> Sale & Mortgage Planning</div>
                          {showPlanning ? <ChevronDown size={18}/> : <ChevronRight size={18}/>}
                      </button>
                      {showPlanning && (
                          <div className="p-6 bg-orange-50/30 border-t border-orange-100">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="flex flex-col space-y-1">
                                        <label className="text-[10px] font-bold text-orange-700 uppercase">Planned Sell Date (Optional)</label>
                                        <div className="relative">
                                            <input type="date" className="w-full border border-orange-200 rounded px-3 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-orange-500 outline-none pr-8" value={activeAsset.inputs?.sellDate || ''} onChange={(e) => handleInputUpdate('sellDate', e.target.value)} />
                                            {activeAsset.inputs?.sellDate && (<button onClick={() => handleInputUpdate('sellDate', '')} className="absolute right-2 top-2 p-1 text-orange-400 hover:text-red-500 rounded-full hover:bg-orange-100 transition-colors" title="Clear Date"><X size={14} /></button>)}
                                        </div>
                                        <span className="text-[10px] text-orange-600/70">Property will be sold and net equity deposited to Joint/Cash.</span>
                                </div>
                            </div>
                          </div>
                      )}
                  </div>
              )}

              {activeAsset.type === 'property' && (
                  <div className="mb-8 bg-slate-50 border border-slate-200 rounded-lg p-4">
                      <h3 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2"><Link size={14}/> Linked Liabilities (Debts against this Asset)</h3>
                      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                          {Object.values(loans).length === 0 && <div className="p-3 text-sm text-slate-400 italic">No liabilities defined in the system.</div>}
                          {Object.values(loans).map(l => {
                              const currentIds = activeAsset.inputs?.linkedLoanIds || (activeAsset.inputs?.linkedLoanId ? [activeAsset.inputs.linkedLoanId] : []);
                              const isLinked = currentIds.includes(l.id);
                              return (
                                  <label key={l.id} className="flex items-center gap-3 p-3 border-b border-slate-50 hover:bg-blue-50 cursor-pointer transition-colors last:border-0">
                                      <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4" checked={isLinked} onChange={() => toggleLinkedLoan(l.id)} />
                                      <div className="flex-1"><div className={`text-sm font-bold ${isLinked ? 'text-blue-700' : 'text-slate-600'}`}>{l.name}</div><div className="text-[10px] text-slate-400 uppercase">{l.type} • Bal: ${Math.round(l.inputs.balance || l.inputs.principal).toLocaleString()}</div></div>
                                      {isLinked && <span className="text-[10px] font-bold bg-blue-100 text-blue-600 px-2 py-1 rounded">Linked</span>}
                                  </label>
                              );
                          })}
                      </div>
                  </div>
              )}

              {activeAsset.type === 'property' && (
                  <div className="mb-8 bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                      <div className="flex justify-between items-center mb-4">
                          <h3 className="font-bold text-slate-700 flex items-center gap-2"><DollarSign size={16}/> Property Carrying Costs</h3>
                          <span className="text-[11px] text-slate-400">Edit here; flows into Cash Flow as Home expenses.</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <CarryingList
                              title="Impounds (Tax/Insurance)"
                              helper="For impounded escrow items. Property tax & insurance inflation applied automatically."
                              items={carryingCosts.impounds || []}
                              onAdd={() => addCarryingCost('impounds')}
                              onUpdate={(idx, field, val) => updateCarryingCost('impounds', idx, field, val)}
                              onRemove={(idx) => removeCarryingCost('impounds', idx)}
                          />
                          <CarryingList
                              title="Other Home Costs (HOA/Maintenance)"
                              helper="Non-escrow property costs like HOA, landscaping, or maintenance reserves."
                              items={carryingCosts.other || []}
                              onAdd={() => addCarryingCost('other')}
                              onUpdate={(idx, field, val) => updateCarryingCost('other', idx, field, val)}
                              onRemove={(idx) => removeCarryingCost('other', idx)}
                          />
                      </div>
                  </div>
              )}

              {/* ... (Existing render logic for other asset types) ... */}
              {(activeAsset.type === 'cash' || activeAsset.type === 'joint' || activeAsset.type === 'retirement') && (
                  <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                      {activeAsset.type === 'cash' && (<><GlobalRuleInput label="Surplus Cap (Max)" value={thresholds.cashMax} onChange={(v) => handleThresholdUpdate('cashMax', v)} description="When Income > Expenses, surplus cash fills this bucket first." /><GlobalRuleInput label="Cash Floor (Min)" value={thresholds.cashMin} onChange={(v) => handleThresholdUpdate('cashMin', v)} description="Cash is drained down to this floor before tapping investments." /></>)}
                      {activeAsset.type === 'joint' && (<GlobalRuleInput label="Depletion Floor (Min)" value={thresholds.jointMin} onChange={(v) => handleThresholdUpdate('jointMin', v)} description="Drained to this minimum before tapping Retirement." />)}
                      {activeAsset.type === 'retirement' && (<GlobalRuleInput label="Safety Floor (RM Trigger)" value={thresholds.retirementMin} onChange={(v) => handleThresholdUpdate('retirementMin', v)} description="If 401k falls to this level, Reverse Mortgage activates." />)}
                  </div>
              )}

              {/* Balance Inspector */}
              <div className="mb-8 bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-slate-700 flex items-center gap-2"><FileText size={16}/> Balance Inspector</h3>
                      <div className="text-[11px] text-slate-500">Yearly summary with month-by-month drilldown. Waterfall view removed per request.</div>
                  </div>
                  <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                          <thead className="bg-slate-50 text-xs text-slate-500 uppercase font-bold">
                              <tr>
                                  <th className="px-3 py-2 text-left">Year</th>
                                  <th className="px-3 py-2 text-right">Start</th>
                                  <th className="px-3 py-2 text-right text-blue-700">Deposits</th>
                                  <th className="px-3 py-2 text-right text-red-600">Withdrawals</th>
                                  <th className="px-3 py-2 text-right text-emerald-600">Growth</th>
                                  <th className="px-3 py-2 text-right">End</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                              {balanceInspectorData.annual.map(row => {
                                  const isOpen = inspectorExpandedYear === row.year;
                                  return (
                                      <React.Fragment key={row.year}>
                                          <tr className="hover:bg-blue-50/40 cursor-pointer" onClick={() => setInspectorExpandedYear(isOpen ? null : row.year)}>
                                              <td className="px-3 py-2 font-bold text-slate-700 flex items-center gap-2">
                                                  {isOpen ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                                                  {row.year}
                                              </td>
                                              <td className="px-3 py-2 text-right font-mono text-slate-600">${Math.round(row.startBalance || 0).toLocaleString()}</td>
                                              <td className="px-3 py-2 text-right font-mono text-blue-700 font-semibold">${Math.round(row.deposits || 0).toLocaleString()}</td>
                                              <td className="px-3 py-2 text-right font-mono text-red-600 font-semibold">-${Math.round(row.withdrawals || 0).toLocaleString()}</td>
                                              <td className="px-3 py-2 text-right font-mono text-emerald-600 font-semibold">${Math.round(row.growth || 0).toLocaleString()}</td>
                                              <td className="px-3 py-2 text-right font-mono font-bold text-slate-800">${Math.round(row.endBalance || 0).toLocaleString()}</td>
                                          </tr>
                                          {isOpen && row.months.length > 0 && (
                                              <tr>
                                                  <td colSpan={6} className="px-3 pb-3">
                                                      <div className="overflow-x-auto">
                                                          <table className="w-full text-xs">
                                                              <thead className="bg-slate-100 text-[10px] text-slate-500 uppercase font-bold">
                                                                  <tr>
                                                                      <th className="px-2 py-1 text-left">Month</th>
                                                                      <th className="px-2 py-1 text-right">Start</th>
                                                                      <th className="px-2 py-1 text-right text-blue-700">Deposits</th>
                                                                      <th className="px-2 py-1 text-right text-red-600">Withdrawals</th>
                                                                      <th className="px-2 py-1 text-right text-emerald-600">Growth</th>
                                                                      <th className="px-2 py-1 text-right">End</th>
                                                                  </tr>
                                                              </thead>
                                                              <tbody className="divide-y divide-slate-100">
                                                                  {row.months.map(m => (
                                                                      <tr key={`${row.year}-${m.month}`} className="hover:bg-blue-50/50">
                                                                          <td className="px-2 py-1 text-left font-semibold text-slate-700">{m.monthLabel}</td>
                                                                          <td className="px-2 py-1 text-right font-mono text-slate-600">${Math.round(m.startBalance || 0).toLocaleString()}</td>
                                                                          <td className="px-2 py-1 text-right font-mono text-blue-700">${Math.round(m.deposits || 0).toLocaleString()}</td>
                                                                          <td className="px-2 py-1 text-right font-mono text-red-600">-${Math.round(m.withdrawals || 0).toLocaleString()}</td>
                                                                          <td className="px-2 py-1 text-right font-mono text-emerald-600">${Math.round(m.growth || 0).toLocaleString()}</td>
                                                                          <td className="px-2 py-1 text-right font-mono font-bold text-slate-800">${Math.round(m.endBalance || 0).toLocaleString()}</td>
                                                                      </tr>
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
                              {balanceInspectorData.annual.length === 0 && (
                                  <tr><td colSpan={6} className="px-3 py-3 text-center text-slate-400 text-xs">No timeline data available.</td></tr>
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>


              {activeAsset.type === 'inherited' && (
                  <div className="mb-8 bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                      <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-slate-700 flex items-center gap-2"><Calendar size={18}/> Projected Withdrawals</h3><div className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded">Net proceeds to <strong>Joint Investment</strong></div></div>
                      <div className="overflow-x-auto border border-slate-200 rounded-lg">
                          <table className="w-full text-sm text-right">
                              <thead className="bg-slate-50 text-xs text-slate-500 uppercase font-bold"><tr><th className="px-4 py-2 text-left">Year</th><th className="px-4 py-2">Jan Balance</th><th className="px-4 py-2">Gross Withdrawal</th><th className="px-4 py-2 text-blue-600">Net Deposit</th><th className="px-4 py-2 text-slate-400">Dec Balance</th></tr></thead>
                              <tbody className="divide-y divide-slate-100">
                                  {iraTableData.map((row, i) => { if (!row.isActive && row.value === 0 && i > 10) return null; return (
                                          <tr key={row.year} className="hover:bg-slate-50">
                                              <td className="px-4 py-2 text-left font-bold text-slate-700">{row.year}</td>
                                              <td className="px-4 py-2 text-slate-600">${Math.round(row.janValue).toLocaleString()}</td>
                                              <td className="px-4 py-2 font-mono">${Math.round(row.withdrawal).toLocaleString()}</td>
                                              <td className="px-4 py-2 font-mono font-bold text-blue-600">${Math.round(row.netProceeds).toLocaleString()}</td>
                                              <td className="px-4 py-2 text-slate-400">${Math.round(row.value).toLocaleString()}</td>
                                          </tr>
                                  );})}
                              </tbody>
                          </table>
                      </div>
                  </div>
              )}

              {isFutureProperty && (
                   <div className="mb-8 bg-white p-6 rounded-lg shadow-sm border border-slate-200 ring-2 ring-blue-100">
                       <div className="flex justify-between items-center mb-6">
                           <h3 className="font-bold text-blue-700 flex items-center gap-2"><PenTool size={18}/> Future Purchase Planner</h3>
                           <div className="flex bg-slate-100 rounded p-1">
                               <button onClick={() => handleInputUpdate('purchaseType', 'construction')} className={`px-3 py-1 text-xs font-bold rounded ${activeAsset.inputs.purchaseType === 'construction' ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}>New Construction</button>
                               <button onClick={() => handleInputUpdate('purchaseType', 'existing')} className={`px-3 py-1 text-xs font-bold rounded ${activeAsset.inputs.purchaseType === 'existing' ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}>Existing Home</button>
                           </div>
                       </div>
                       {activeAsset.inputs.purchaseType === 'construction' ? (<NewConstructionPlanner asset={activeAsset} updateAsset={handleFullUpdate} actions={actions} accounts={accounts} simulation={simulation} />) : (<HomePurchasePlanner asset={activeAsset} updateAsset={handleFullUpdate} actions={actions} accounts={accounts} simulation={simulation} />)}
                   </div>
              )}

              {!isFutureProperty && (
                <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 h-96 flex flex-col">
                    <h3 className="font-bold text-slate-600 mb-4 flex items-center gap-2"><TrendingUp size={16}/> Projected Value (Stacked Analysis)</h3>
                    <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={projectionData} stackOffset="sign">
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} tickFormatter={(v) => `${v/1000}k`} />
                                <Tooltip content={<CustomChartTooltip />} />
                                <Legend wrapperStyle={{fontSize:'12px', paddingTop:'10px'}} />
                                <ReferenceLine y={0} stroke="#94a3b8" />
                                {activeAsset.type === 'property' && (<><Bar dataKey="debt" stackId="p" fill="#ef4444" name="Linked Debt" radius={[0, 0, 0, 0]} /><Bar dataKey="equity" stackId="p" fill="#10b981" name="Net Equity" radius={[2, 2, 0, 0]} /></>)}
                                {activeAsset.type !== 'property' && (<><Bar dataKey="openingBalance" stackId="a" fill="#94a3b8" name="Opening Balance" radius={[0, 0, 0, 0]} /><Bar dataKey="annualDeposits" stackId="a" fill="#3b82f6" name="New Deposits" radius={[0, 0, 0, 0]} /><Bar dataKey="annualGrowth" stackId="a" fill="#10b981" name="Growth" radius={[2, 2, 0, 0]} /><Bar dataKey="annualWithdrawals" stackId="a" fill="#ef4444" name="Annual Withdrawals" radius={[0, 0, 2, 2]} /></>)}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
              )}
           </div>
        ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400"><PiggyBank size={48} className="mb-4 opacity-20"/><p>Select an asset to configure.</p></div>
        )}
      </div>
    </div>
  );
}
