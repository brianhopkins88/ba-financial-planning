import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { calculateAssetGrowth } from '../utils/asset_math';
import { runFinancialSimulation } from '../utils/financial_engine';
import { Plus, Trash2, TrendingUp, Home, DollarSign, PiggyBank, Briefcase, Calendar, PenTool, Link, ChevronDown, ChevronRight, X, ArrowRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { NewConstructionPlanner, HomePurchasePlanner } from '../components/PropertyPlanner';
import { isAfter, parseISO, addYears, format, getYear } from 'date-fns';

// --- SUB-COMPONENTS ---
const AssetCard = ({ asset, isSelected, onClick }) => (
  <div
    onClick={onClick}
    className={`p-3 rounded-lg cursor-pointer border transition-all mb-2 ${
      isSelected ? 'bg-blue-50 border-blue-400 shadow-sm' : 'bg-white border-slate-200 hover:border-blue-200'
    }`}
  >
    <div className="flex justify-between items-start">
      <div>
        <div className="font-bold text-slate-700 text-sm">{asset.name}</div>
        <div className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">{asset.owner}</div>
      </div>
      <div className="text-right">
        <div className="font-mono font-bold text-blue-600 text-sm">${asset.balance.toLocaleString()}</div>
      </div>
    </div>
  </div>
);

const SectionHeader = ({ title, icon: Icon, onAdd }) => (
  <div className="flex justify-between items-center mb-2 mt-6 pb-1 border-b border-slate-100">
    <div className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase tracking-wider">
      <Icon size={14} /> {title}
    </div>
    <button onClick={onAdd} className="text-slate-400 hover:text-blue-600 transition-colors"><Plus size={16} /></button>
  </div>
);

const InputGroup = ({ label, value, onChange, type = "text", step }) => (
    <div className="flex flex-col space-y-1">
        <label className="text-[10px] font-bold text-slate-400 uppercase">{label}</label>
        <input
            type={type} step={step}
            className="w-full border border-slate-200 rounded px-3 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
            value={value}
            onChange={(e) => onChange(type === 'number' ? parseFloat(e.target.value) : e.target.value)}
        />
    </div>
);

const CustomChartTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        // Total Positive (Ending Balance)
        const total = (data.basis || 0) + (data.growth || 0) + (data.equity || 0);
        return (
            <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-xl text-xs z-50">
                <div className="font-bold text-slate-700 mb-2 border-b border-slate-100 pb-1">
                    Year {data.year}
                </div>
                <div className="space-y-1">
                     {/* Property Debt */}
                     {data.debt > 0 && (
                        <div className="flex justify-between gap-4">
                            <span className="text-red-500">Linked Debt:</span>
                            <span className="font-mono font-bold text-red-500">-${Math.round(data.debt).toLocaleString()}</span>
                        </div>
                     )}

                     {/* Property Equity */}
                     {data.equity > 0 && (
                        <div className="flex justify-between gap-4">
                            <span className="text-emerald-600 font-bold">Net Equity:</span>
                            <span className="font-mono font-bold text-emerald-600">${Math.round(data.equity).toLocaleString()}</span>
                        </div>
                     )}

                     {/* Liquid Assets Components */}
                     {data.basis > 0 && (
                        <div className="flex justify-between gap-4">
                            <span className="text-blue-600">Net Principal:</span>
                            <span className="font-mono font-bold text-blue-600">${Math.round(data.basis).toLocaleString()}</span>
                        </div>
                     )}
                     {data.growth > 0 && (
                        <div className="flex justify-between gap-4">
                            <span className="text-emerald-500">Accumulated Growth:</span>
                            <span className="font-mono font-bold text-emerald-500">${Math.round(data.growth).toLocaleString()}</span>
                        </div>
                     )}

                     {/* Annual Withdrawals */}
                     {data.annualWithdrawals < 0 && (
                        <div className="flex justify-between gap-4 border-t border-red-50 pt-1 mt-1 text-red-600">
                            <span>Withdrawals (Year):</span>
                            <span className="font-mono font-bold">${Math.round(data.annualWithdrawals).toLocaleString()}</span>
                        </div>
                     )}

                     <div className="pt-2 mt-1 border-t border-slate-100 flex justify-between gap-4">
                        <span className="font-bold text-slate-700">Ending Balance:</span>
                        <span className="font-mono font-bold text-slate-800">${Math.round(total).toLocaleString()}</span>
                     </div>
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
  const [selectedId, setSelectedId] = useState(null);

  const [showPlanning, setShowPlanning] = useState(false);

  const grouped = useMemo(() => {
    const g = { retirement: [], inherited: [], joint: [], cash: [], property: [] };
    Object.values(accounts).forEach(a => {
        if (g[a.type]) g[a.type].push(a);
    });
    return g;
  }, [accounts]);

  const activeAsset = accounts[selectedId] || Object.values(accounts)[0];
  const activeId = activeAsset?.id;

  useEffect(() => {
      if (activeAsset?.type === 'property') {
          const hasPlan = !!activeAsset.inputs?.sellDate || (activeAsset.inputs?.linkedLoanIds && activeAsset.inputs.linkedLoanIds.length > 0);
          setShowPlanning(hasPlan);
      }
  }, [activeId]);

  const handleUpdate = (field, val) => actions.updateScenarioData(`assets.accounts.${activeId}.${field}`, val);
  const handleInputUpdate = (field, val) => actions.updateScenarioData(`assets.accounts.${activeId}.inputs.${field}`, val);
  const handleFullUpdate = (path, val) => actions.updateScenarioData(`assets.accounts.${activeId}.${path}`, val);

  const updateIraSchedule = (index, value) => {
      const defaultSchedule = [0.1, 0.1, 0.1, 0.1, 0.1, 0.25, 0.25, 0.25, 0.25, 1.0];
      const currentSchedule = activeAsset.inputs?.withdrawalSchedule || defaultSchedule;
      const newSchedule = [...currentSchedule];
      newSchedule[index] = value;
      handleInputUpdate('withdrawalSchedule', newSchedule);
  };

  const toggleLinkedLoan = (loanId) => {
      const currentIds = activeAsset.inputs?.linkedLoanIds || (activeAsset.inputs?.linkedLoanId ? [activeAsset.inputs.linkedLoanId] : []);
      let newIds;
      if (currentIds.includes(loanId)) {
          newIds = currentIds.filter(id => id !== loanId);
      } else {
          newIds = [...currentIds, loanId];
      }
      actions.updateScenarioData(`assets.accounts.${activeId}.inputs.linkedLoanIds`, newIds);
      if (activeAsset.inputs?.linkedLoanId) {
          actions.updateScenarioData(`assets.accounts.${activeId}.inputs.linkedLoanId`, null);
      }
  };

  // --- PROJECTION ENGINE SWITCH ---
  const projectionData = useMemo(() => {
     if (!activeAsset) return [];
     const assumptions = activeScenario.data.assumptions || activeScenario.data.globals || {};

     if (activeAsset.type === 'property' || activeAsset.type === 'inherited') {
         const horizon = activeAsset.type === 'inherited' ? 15 : 35;
         return calculateAssetGrowth(activeAsset, assumptions, loans, horizon);
     } else {
         const simulation = runFinancialSimulation(activeScenario, store.profiles);
         const timeline = simulation.timeline;

         return timeline.filter(t => t.month === 12).map(row => {
             const typeKey = activeAsset.type;
             const comp = row.components[typeKey] || { basis: 0, growth: 0 };
             const flow = row.flows[typeKey] || { withdrawals: 0 };
             return {
                 year: row.year,
                 // Map Engine Components to Chart Keys
                 basis: comp.basis,
                 growth: comp.growth,
                 annualWithdrawals: -flow.withdrawals, // Make negative for chart
                 debt: 0,
                 equity: 0 // Used for Property only
             };
         });
     }
  }, [activeAsset, activeScenario, loans, store.profiles]);

  const iraTableData = useMemo(() => {
      if(activeAsset?.type !== 'inherited') return [];
      return calculateAssetGrowth(activeAsset, activeScenario.data.assumptions || {}, loans, 15);
  }, [activeAsset, activeScenario, loans]);

  const isFutureProperty = useMemo(() => {
      if(activeAsset?.type !== 'property') return false;
      const start = activeAsset.inputs?.startDate;
      if(!start) return false;
      return isAfter(parseISO(start), simulationDate);
  }, [activeAsset, simulationDate]);

  return (
    <div className="flex h-full bg-slate-50">
      <div className="w-80 bg-slate-100 border-r border-slate-200 flex flex-col h-full overflow-y-auto p-4 flex-shrink-0">
         <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2"><PiggyBank className="text-blue-600"/> Assets</h2>
         <SectionHeader title="Retirement (401k/403b)" icon={Briefcase} onAdd={() => actions.addAsset('retirement')} />
         {grouped.retirement.map(a => <AssetCard key={a.id} asset={a} isSelected={activeId === a.id} onClick={() => setSelectedId(a.id)} />)}
         <SectionHeader title="Inherited IRA" icon={TrendingUp} onAdd={() => actions.addAsset('inherited')} />
         {grouped.inherited.map(a => <AssetCard key={a.id} asset={a} isSelected={activeId === a.id} onClick={() => setSelectedId(a.id)} />)}
         <SectionHeader title="Joint Investment" icon={TrendingUp} onAdd={() => actions.addAsset('joint')} />
         {grouped.joint.map(a => <AssetCard key={a.id} asset={a} isSelected={activeId === a.id} onClick={() => setSelectedId(a.id)} />)}
         <SectionHeader title="Cash Savings" icon={DollarSign} onAdd={() => actions.addAsset('cash')} />
         {grouped.cash.map(a => <AssetCard key={a.id} asset={a} isSelected={activeId === a.id} onClick={() => setSelectedId(a.id)} />)}
         <SectionHeader title="Property" icon={Home} onAdd={() => actions.addAsset('property')} />
         {grouped.property.map(a => <AssetCard key={a.id} asset={a} isSelected={activeId === a.id} onClick={() => setSelectedId(a.id)} />)}
      </div>

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {activeAsset ? (
           <div className="p-8 overflow-y-auto">
              <div className="flex justify-between items-start mb-8">
                 <div>
                    <input
                        className="text-2xl font-bold bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none w-full text-slate-800 transition-all"
                        value={activeAsset.name}
                        onChange={(e) => handleUpdate('name', e.target.value)}
                    />
                    <div className="flex gap-4 mt-2">
                        <select className="text-xs font-bold uppercase bg-slate-200 rounded px-2 py-1 text-slate-600 outline-none" value={activeAsset.owner} onChange={(e) => handleUpdate('owner', e.target.value)}>
                            <option value="joint">Owner: Joint</option>
                            <option value="brian">Owner: Brian</option>
                            <option value="andrea">Owner: Andrea</option>
                        </select>
                        <span className="text-xs font-bold uppercase bg-blue-100 text-blue-600 rounded px-2 py-1">{activeAsset.type}</span>
                    </div>
                 </div>
                 <button onClick={() => { if(confirm("Delete this asset?")) actions.deleteAsset(activeId); }} className="text-slate-400 hover:text-red-600 p-2 rounded hover:bg-red-50"><Trash2 size={20}/></button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                  <InputGroup label="Current Balance / Value" type="number" step="1000" value={activeAsset.balance} onChange={(v) => handleUpdate('balance', v)} />
                  {activeAsset.type === 'property' && (
                      <>
                        <InputGroup label="Active/Start Date" type="date" value={activeAsset.inputs?.startDate || ''} onChange={(v) => handleInputUpdate('startDate', v)} />
                        <InputGroup label="Build Year" type="number" value={activeAsset.inputs?.buildYear || ''} onChange={(v) => handleInputUpdate('buildYear', v)} />
                        <InputGroup label="Zip Code" value={activeAsset.inputs?.zipCode || ''} onChange={(v) => handleInputUpdate('zipCode', v)} />
                        <InputGroup label="Location Factor" type="number" step="0.001" value={activeAsset.inputs?.locationFactor || 0} onChange={(v) => handleInputUpdate('locationFactor', v)} />
                      </>
                  )}
                  {activeAsset.type === 'inherited' && (
                      <>
                        <InputGroup label="Date Received (Start)" type="date" value={activeAsset.inputs?.startDate || ''} onChange={(v) => handleInputUpdate('startDate', v)} />
                        <div className="col-span-3">
                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">10-Year Withdrawal Schedule</label>
                            <div className="grid grid-cols-5 gap-2">
                                {Array.from({length: 10}).map((_, i) => {
                                    const schedule = activeAsset.inputs?.withdrawalSchedule || Array(10).fill(0.10);
                                    const startDate = activeAsset.inputs?.startDate ? parseISO(activeAsset.inputs.startDate) : new Date();
                                    const yearLabel = format(addYears(startDate, i), 'yyyy');
                                    return (
                                        <div key={i} className="flex flex-col bg-slate-50 p-2 rounded border border-slate-100">
                                            <span className="text-[10px] text-slate-500 font-bold mb-1">Year {i+1} ({yearLabel})</span>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    step="0.05"
                                                    max="1.0"
                                                    className="w-full text-sm font-mono border rounded px-1 py-0.5 text-center"
                                                    value={schedule[i] !== undefined ? schedule[i] : 0.1}
                                                    onChange={(e) => updateIraSchedule(i, parseFloat(e.target.value))}
                                                />
                                                <span className="absolute right-4 top-0.5 text-[9px] text-slate-400">%</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                      </>
                  )}
              </div>

              {activeAsset.type === 'inherited' && (
                  <div className="mb-8 bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                      <div className="flex justify-between items-center mb-4">
                          <h3 className="font-bold text-slate-700 flex items-center gap-2"><Calendar size={18}/> Projected Withdrawals</h3>
                          <div className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded">
                              Net proceeds deposited to <strong>Joint Investment</strong>
                          </div>
                      </div>

                      <div className="overflow-x-auto border border-slate-200 rounded-lg">
                          <table className="w-full text-sm text-right">
                              <thead className="bg-slate-50 text-xs text-slate-500 uppercase font-bold">
                                  <tr>
                                      <th className="px-4 py-2 text-left">Year</th>
                                      <th className="px-4 py-2">Jan Balance</th>
                                      <th className="px-4 py-2">Gross Withdrawal</th>
                                      <th className="px-4 py-2 text-blue-600">Net Deposit</th>
                                      <th className="px-4 py-2 text-slate-400">Dec Balance</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                  {iraTableData.map((row, i) => {
                                      // Only show relevant years
                                      if (!row.isActive && row.value === 0 && i > 10) return null;

                                      return (
                                          <tr key={row.year} className="hover:bg-slate-50">
                                              <td className="px-4 py-2 text-left font-bold text-slate-700">{row.year}</td>
                                              <td className="px-4 py-2 text-slate-600">${Math.round(row.janValue).toLocaleString()}</td>
                                              <td className="px-4 py-2 font-mono">${Math.round(row.withdrawal).toLocaleString()}</td>
                                              <td className="px-4 py-2 font-mono font-bold text-blue-600">${Math.round(row.netProceeds).toLocaleString()}</td>
                                              <td className="px-4 py-2 text-slate-400">${Math.round(row.value).toLocaleString()}</td>
                                          </tr>
                                      );
                                  })}
                              </tbody>
                          </table>
                      </div>
                      <div className="mt-2 text-[10px] text-slate-400 flex gap-4">
                          <span>* Tax Rates: >$600k: 48%, >$400k: 40%, >$200k: 32%, Else: 25%</span>
                          <span>* Final year (Year 10) automatically clears remaining balance.</span>
                      </div>
                  </div>
              )}

              {activeAsset.type === 'property' && (
                  <div className="mb-8 bg-white rounded-lg shadow-sm border border-orange-200 overflow-hidden">
                      <button
                        onClick={() => setShowPlanning(!showPlanning)}
                        className="w-full flex justify-between items-center p-4 bg-orange-50 hover:bg-orange-100 transition-colors text-orange-800 font-bold"
                      >
                          <div className="flex items-center gap-2">
                              <Home size={18}/> Sale & Mortgage Planning
                          </div>
                          {showPlanning ? <ChevronDown size={18}/> : <ChevronRight size={18}/>}
                      </button>

                      {showPlanning && (
                          <div className="p-6 bg-orange-50/30 border-t border-orange-100">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="flex flex-col space-y-1">
                                        <label className="text-[10px] font-bold text-orange-700 uppercase">Planned Sell Date (Optional)</label>
                                        <div className="relative">
                                            <input
                                                type="date"
                                                className="w-full border border-orange-200 rounded px-3 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-orange-500 outline-none pr-8"
                                                value={activeAsset.inputs?.sellDate || ''}
                                                onChange={(e) => handleInputUpdate('sellDate', e.target.value)}
                                            />
                                            {activeAsset.inputs?.sellDate && (
                                                <button
                                                    onClick={() => handleInputUpdate('sellDate', '')}
                                                    className="absolute right-2 top-2 p-1 text-orange-400 hover:text-red-500 rounded-full hover:bg-orange-100 transition-colors"
                                                    title="Clear Date"
                                                >
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>
                                        <span className="text-[10px] text-orange-600/70">Property will be sold and net equity deposited to Joint/Cash.</span>
                                </div>

                                <div className="flex flex-col space-y-1">
                                        <label className="text-[10px] font-bold text-orange-700 uppercase">Linked Loans (Payoff on Sale)</label>
                                        <div className="border border-orange-200 rounded bg-white max-h-32 overflow-y-auto p-2 shadow-sm">
                                            {Object.values(loans).length === 0 && <div className="text-xs text-slate-400 italic p-2">No loans available.</div>}
                                            {Object.values(loans).map(l => {
                                                const currentIds = activeAsset.inputs?.linkedLoanIds || (activeAsset.inputs?.linkedLoanId ? [activeAsset.inputs.linkedLoanId] : []);
                                                const isLinked = currentIds.includes(l.id);
                                                return (
                                                    <label key={l.id} className="flex items-center gap-2 text-xs py-1.5 px-2 cursor-pointer hover:bg-orange-50 rounded transition-colors">
                                                        <input
                                                            type="checkbox"
                                                            className="rounded text-orange-600 focus:ring-orange-500"
                                                            checked={isLinked}
                                                            onChange={() => toggleLinkedLoan(l.id)}
                                                        />
                                                        <div className="flex flex-col">
                                                            <span className={isLinked ? 'font-bold text-orange-800' : 'text-slate-600'}>{l.name}</span>
                                                            <span className="text-[9px] text-slate-400 uppercase">{l.type} • Bal: ${Math.round(l.inputs.balance || l.inputs.principal).toLocaleString()}</span>
                                                        </div>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                </div>
                            </div>
                          </div>
                      )}
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
                       {activeAsset.inputs.purchaseType === 'construction' ? (
                           <NewConstructionPlanner asset={activeAsset} updateAsset={handleFullUpdate} actions={actions} accounts={accounts} />
                       ) : (
                           <HomePurchasePlanner asset={activeAsset} updateAsset={handleFullUpdate} actions={actions} accounts={accounts} />
                       )}
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

                                {/* PROPERTY STACKS (Only render for property) */}
                                {activeAsset.type === 'property' && <Bar dataKey="debt" stackId="p" fill="#ef4444" name="Linked Debt" radius={[0, 0, 0, 0]} />}
                                {activeAsset.type === 'property' && <Bar dataKey="equity" stackId="p" fill="#10b981" name="Net Equity" radius={[2, 2, 0, 0]} />}

                                {/* LIQUID STACKS (Only render for liquid) */}
                                {activeAsset.type !== 'property' && activeAsset.type !== 'inherited' && (
                                    <>
                                        <Bar dataKey="basis" stackId="a" fill="#3b82f6" name="Principal/Deposits" radius={[0, 0, 0, 0]} />
                                        <Bar dataKey="growth" stackId="a" fill="#10b981" name="Accumulated Growth" radius={[2, 2, 0, 0]} />
                                        <Bar dataKey="annualWithdrawals" stackId="a" fill="#ef4444" name="Annual Withdrawals" radius={[0, 0, 2, 2]} />
                                    </>
                                )}

                                {/* IRA STACKS */}
                                {activeAsset.type === 'inherited' && (
                                    <>
                                        <Bar dataKey="equity" stackId="i" fill="#10b981" name="Balance" radius={[2, 2, 0, 0]} />
                                        <Bar dataKey="cumulativeWithdrawals" stackId="i" fill="#f59e0b" name="Cumulative Withdrawals" radius={[2, 2, 0, 0]} />
                                    </>
                                )}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-4 text-xs text-slate-400 italic flex justify-between">
                         <span>* Charts show end-of-year values derived from the <strong>Integrated Financial Simulation</strong>.</span>
                         {activeAsset.type === 'joint' && <span className="text-blue-600 font-bold">* Red bars show annual outflow. Blue/Green show remaining balance.</span>}
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