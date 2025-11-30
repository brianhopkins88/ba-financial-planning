{
type: "file",
fileName: "src/views/assets.jsx",
fullContent: `import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { calculateAssetGrowth } from '../utils/asset_math';
import { Plus, Trash2, TrendingUp, Home, DollarSign, PiggyBank, Briefcase, Calendar, PenTool } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { NewConstructionPlanner, HomePurchasePlanner } from '../components/PropertyPlanners';
import { isAfter, parseISO } from 'date-fns';

// --- SUB-COMPONENTS ---
const AssetCard = ({ asset, isSelected, onClick }) => (
  <div
    onClick={onClick}
    className={\`p-3 rounded-lg cursor-pointer border transition-all mb-2 \${
      isSelected ? 'bg-blue-50 border-blue-400 shadow-sm' : 'bg-white border-slate-200 hover:border-blue-200'
    }\`}
  >
    <div className="flex justify-between items-start">
      <div>
        <div className="font-bold text-slate-700 text-sm">{asset.name}</div>
        <div className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">{asset.owner}</div>
      </div>
      <div className="text-right">
        <div className="font-mono font-bold text-blue-600 text-sm">\${asset.balance.toLocaleString()}</div>
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

export default function Assets() {
  const { activeScenario, actions, simulationDate } = useData();
  const accounts = activeScenario.data.assets.accounts || {};
  const [selectedId, setSelectedId] = useState(null);

  // Group Assets
  const grouped = useMemo(() => {
    const g = { retirement: [], inherited: [], joint: [], cash: [], property: [] };
    Object.values(accounts).forEach(a => {
        if (g[a.type]) g[a.type].push(a);
    });
    return g;
  }, [accounts]);

  // Handle Selection (Auto-select first if none)
  const activeAsset = accounts[selectedId] || Object.values(accounts)[0];
  const activeId = activeAsset?.id;

  // Actions
  const handleUpdate = (field, val) => actions.updateScenarioData(\`assets.accounts.\${activeId}.\${field}\`, val);
  const handleInputUpdate = (field, val) => actions.updateScenarioData(\`assets.accounts.\${activeId}.inputs.\${field}\`, val);

  // Wrapper for Planners
  const handleFullUpdate = (path, val) => actions.updateScenarioData(\`assets.accounts.\${activeId}.\${path}\`, val);

  // Projection Logic
  const projectionData = useMemo(() => {
     if (!activeAsset) return [];
     return calculateAssetGrowth(activeAsset, activeScenario.data.globals, 35);
  }, [activeAsset, activeScenario.data.globals]);

  // Future Logic: Is this a future purchase?
  const isFutureProperty = useMemo(() => {
      if(activeAsset?.type !== 'property') return false;
      const start = activeAsset.inputs?.startDate;
      if(!start) return false;
      // If Start Date > Scenario Start (or Simulation Date), it's future
      return isAfter(parseISO(start), simulationDate);
  }, [activeAsset, simulationDate]);

  return (
    <div className="flex h-full bg-slate-50">
      {/* LEFT SIDEBAR: ASSET LIST */}
      <div className="w-80 bg-slate-100 border-r border-slate-200 flex flex-col h-full overflow-y-auto p-4 flex-shrink-0">
         <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2"><PiggyBank className="text-blue-600"/> Assets</h2>

         {/* 1. RETIREMENT */}
         <SectionHeader title="Retirement (401k/403b)" icon={Briefcase} onAdd={() => actions.addAsset('retirement')} />
         {grouped.retirement.map(a => <AssetCard key={a.id} asset={a} isSelected={activeId === a.id} onClick={() => setSelectedId(a.id)} />)}

         {/* 2. INHERITED IRA */}
         <SectionHeader title="Inherited IRA" icon={TrendingUp} onAdd={() => actions.addAsset('inherited')} />
         {grouped.inherited.map(a => <AssetCard key={a.id} asset={a} isSelected={activeId === a.id} onClick={() => setSelectedId(a.id)} />)}

         {/* 3. JOINT INVESTMENT */}
         <SectionHeader title="Joint Investment" icon={TrendingUp} onAdd={() => actions.addAsset('joint')} />
         {grouped.joint.map(a => <AssetCard key={a.id} asset={a} isSelected={activeId === a.id} onClick={() => setSelectedId(a.id)} />)}

         {/* 4. CASH SAVINGS */}
         <SectionHeader title="Cash Savings" icon={DollarSign} onAdd={() => actions.addAsset('cash')} />
         {grouped.cash.map(a => <AssetCard key={a.id} asset={a} isSelected={activeId === a.id} onClick={() => setSelectedId(a.id)} />)}

         {/* 5. PROPERTY */}
         <SectionHeader title="Property" icon={Home} onAdd={() => actions.addAsset('property')} />
         {grouped.property.map(a => <AssetCard key={a.id} asset={a} isSelected={activeId === a.id} onClick={() => setSelectedId(a.id)} />)}
      </div>

      {/* RIGHT MAIN: CONFIG & VISUALIZATION */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {activeAsset ? (
           <div className="p-8 overflow-y-auto">
              {/* HEADER */}
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

              {/* SHARED INPUTS */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                  <InputGroup label="Current Balance / Value" type="number" step="1000" value={activeAsset.balance} onChange={(v) => handleUpdate('balance', v)} />

                  {/* TYPE SPECIFIC INPUTS */}
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
                        <InputGroup label="End Date (Deadline)" type="date" value={activeAsset.inputs?.endDate || ''} onChange={(v) => handleInputUpdate('endDate', v)} />
                      </>
                  )}
              </div>

              {/* FUTURE PROPERTY LOGIC */}
              {isFutureProperty && (
                   <div className="mb-8 bg-white p-6 rounded-lg shadow-sm border border-slate-200 ring-2 ring-blue-100">
                       <div className="flex justify-between items-center mb-6">
                           <h3 className="font-bold text-blue-700 flex items-center gap-2"><PenTool size={18}/> Future Purchase Planner</h3>
                           <div className="flex bg-slate-100 rounded p-1">
                               <button
                                  onClick={() => handleInputUpdate('purchaseType', 'construction')}
                                  className={\`px-3 py-1 text-xs font-bold rounded \${activeAsset.inputs.purchaseType === 'construction' ? 'bg-white shadow text-blue-600' : 'text-slate-400'}\`}
                               >
                                   New Construction
                               </button>
                               <button
                                  onClick={() => handleInputUpdate('purchaseType', 'existing')}
                                  className={\`px-3 py-1 text-xs font-bold rounded \${activeAsset.inputs.purchaseType === 'existing' ? 'bg-white shadow text-blue-600' : 'text-slate-400'}\`}
                               >
                                   Existing Home
                               </button>
                           </div>
                       </div>

                       {activeAsset.inputs.purchaseType === 'construction' ? (
                           <NewConstructionPlanner
                                asset={activeAsset}
                                updateAsset={handleFullUpdate}
                                actions={actions}
                                accounts={accounts}
                           />
                       ) : (
                           <HomePurchasePlanner
                                asset={activeAsset}
                                updateAsset={handleFullUpdate}
                                actions={actions}
                                accounts={accounts}
                           />
                       )}
                   </div>
              )}

              {/* STANDARD VISUALIZATION */}
              {!isFutureProperty && (
                <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 h-96">
                    <h3 className="font-bold text-slate-600 mb-4 flex items-center gap-2"><TrendingUp size={16}/> Projected Growth (35 Years)</h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={projectionData}>
                            <defs>
                                <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                            <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} tickFormatter={(v) => \`\$\${v/1000}k\`} />
                            <Tooltip
                                contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                                formatter={(val) => [\`\$\${Math.round(val).toLocaleString()}\`, 'Value']}
                            />
                            <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorVal)" />
                        </AreaChart>
                    </ResponsiveContainer>
                    {activeAsset.type === 'property' && (
                        <div className="mt-4 text-xs text-slate-400 italic">
                            * Projection based on Home Value Algorithm: {activeAsset.inputs?.buildYear ? \`Age \${new Date().getFullYear() - activeAsset.inputs.buildYear} start\` : 'New Build'}
                        </div>
                    )}
                </div>
              )}

           </div>
        ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400">
                <PiggyBank size={48} className="mb-4 opacity-20"/>
                <p>Select an asset to configure.</p>
            </div>
        )}
      </div>
    </div>
  );
}`
}