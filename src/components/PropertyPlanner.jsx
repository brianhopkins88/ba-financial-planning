{
type: "file",
fileName: "src/components/PropertyPlanners.jsx",
fullContent: `import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Calculator, ArrowRight, DollarSign, ExternalLink } from 'lucide-react';

// --- SHARED UTILS ---
const Section = ({ title, children, rightAction }) => (
    <div className="mb-6 bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
        <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex justify-between items-center">
            <span className="font-bold text-xs uppercase text-slate-500 tracking-wider">{title}</span>
            {rightAction}
        </div>
        <div className="p-4">{children}</div>
    </div>
);

const LineItem = ({ label, value, onChange, type="number", onRemove }) => (
    <div className="flex justify-between items-center mb-2 group">
        <span className="text-sm text-slate-600 flex-1">{label}</span>
        <div className="flex items-center gap-2">
            <div className="relative w-32">
                <span className="absolute left-2 top-1.5 text-slate-400 text-xs">$</span>
                <input
                    type={type}
                    className="w-full pl-6 pr-2 py-1 border border-slate-200 rounded text-right text-sm font-mono font-bold text-slate-700 focus:border-blue-500 outline-none"
                    value={value}
                    onChange={(e) => onChange(type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
                />
            </div>
            {onRemove && (
                <button onClick={onRemove} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14}/></button>
            )}
        </div>
    </div>
);

// --- NEW CONSTRUCTION PLANNER ---
export const NewConstructionPlanner = ({ asset, updateAsset, actions, accounts }) => {
    const plan = asset.inputs.purchasePlan || {
        costs: { base: 0, structural: 0, design: 0, lot: 0, credits: 0, custom: [] },
        closing: { items: [], prepaids: 0 },
        deposits: { contract: 30000, designPct: 0.20 },
        loan: { amount: 0, rate: 0.065, term: 360 },
        funding: []
    };

    const updatePlan = (path, val) => {
        const newPlan = { ...plan };
        const parts = path.split('.');
        if(parts.length === 1) newPlan[parts[0]] = val;
        if(parts.length === 2) newPlan[parts[0]][parts[1]] = val;
        updateAsset('inputs.purchasePlan', newPlan);
    };

    // Calculations
    const totalCosts = (plan.costs.base + plan.costs.structural + plan.costs.design + plan.costs.lot) - plan.costs.credits + plan.costs.custom.reduce((s,i) => s + i.amount, 0);
    const totalClosing = plan.closing.items.reduce((s,i) => s + i.amount, 0) + plan.closing.prepaids;
    const depositsPaid = plan.deposits.contract + (plan.costs.design * plan.deposits.designPct);
    const totalCashToClose = (totalCosts + totalClosing) - depositsPaid - plan.loan.amount;

    // Loan Creator
    const handleCreateLoan = () => {
        actions.addLoan({
            name: \`Loan: \${asset.name}\`,
            type: 'mortgage',
            inputs: {
                principal: plan.loan.amount,
                rate: plan.loan.rate,
                termMonths: plan.loan.term,
                startDate: asset.inputs.startDate || '2026-06-01',
                payment: 0 // Will auto-calc
            }
        });
        alert("Estimated Loan created in Loans Module. Please review it there.");
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
                 <div className="p-4 bg-blue-50 rounded border border-blue-100">
                     <div className="text-xs text-blue-500 font-bold uppercase">Total Purchase Price</div>
                     <div className="text-2xl font-bold text-blue-700">${totalCosts.toLocaleString()}</div>
                 </div>
                 <div className="p-4 bg-emerald-50 rounded border border-emerald-100">
                     <div className="text-xs text-emerald-600 font-bold uppercase">Est. Cash to Close</div>
                     <div className="text-2xl font-bold text-emerald-700">${totalCashToClose.toLocaleString()}</div>
                 </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* LEFT COLUMN: COSTS */}
                <div>
                    <Section title="1. Purchase Price Worksheet">
                        <LineItem label="Base Price" value={plan.costs.base} onChange={v => updatePlan('costs.base', v)} />
                        <LineItem label="Lot Premium" value={plan.costs.lot} onChange={v => updatePlan('costs.lot', v)} />
                        <LineItem label="Structural Upgrades" value={plan.costs.structural} onChange={v => updatePlan('costs.structural', v)} />
                        <LineItem label="Design Studio Options" value={plan.costs.design} onChange={v => updatePlan('costs.design', v)} />
                        <div className="h-px bg-slate-100 my-2"/>
                        <LineItem label="Builder Credits (-)" value={plan.costs.credits} onChange={v => updatePlan('costs.credits', v)} />
                    </Section>

                    <Section title="2. Loan Estimation" rightAction={<button onClick={handleCreateLoan} className="text-[10px] bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 flex items-center gap-1">Create Loan <ExternalLink size={10}/></button>}>
                        <LineItem label="Loan Amount" value={plan.loan.amount} onChange={v => updatePlan('loan.amount', v)} />
                        <LineItem label="Interest Rate (dec)" value={plan.loan.rate} onChange={v => updatePlan('loan.rate', v)} step="0.001" />
                        <div className="text-xs text-slate-400 italic mt-2">
                             * Clicking "Create Loan" adds this to the Loans module for monthly debt service calculation.
                        </div>
                    </Section>
                </div>

                {/* RIGHT COLUMN: CLOSING & FUNDING */}
                <div>
                    <Section title="3. Deposits & Prepaids">
                        <LineItem label="Contract Deposit (Paid Now)" value={plan.deposits.contract} onChange={v => updatePlan('deposits.contract', v)} />
                        <div className="flex justify-between items-center mb-2">
                             <span className="text-sm text-slate-600">Design Deposit %</span>
                             <input type="number" className="w-16 border rounded text-right text-sm" value={plan.deposits.designPct} onChange={e => updatePlan('deposits.designPct', parseFloat(e.target.value))} step="0.1"/>
                        </div>
                        <div className="flex justify-between items-center mb-2 text-sm text-slate-400">
                            <span>Calc Design Deposit:</span>
                            <span>\${(plan.costs.design * plan.deposits.designPct).toLocaleString()}</span>
                        </div>
                        <LineItem label="Est. Prepaids (Tax/Ins)" value={plan.closing.prepaids} onChange={v => updatePlan('closing.prepaids', v)} />
                    </Section>

                    <Section title="4. Funding Logic (Source of Cash)">
                        <div className="mb-4 text-sm text-slate-600">
                            Total Cash Needed at Close: <span className="font-bold text-red-500">\${totalCashToClose.toLocaleString()}</span>
                        </div>
                        <div className="space-y-2">
                            {plan.funding.map((fund, idx) => (
                                <div key={idx} className="flex gap-2 items-center">
                                    <select
                                        className="flex-1 text-sm border rounded px-2 py-1"
                                        value={fund.sourceId}
                                        onChange={(e) => {
                                            const list = [...plan.funding];
                                            list[idx].sourceId = e.target.value;
                                            updatePlan('funding', list);
                                        }}
                                    >
                                        <option value="">Select Source Account...</option>
                                        {Object.values(accounts).filter(a => a.type !== 'property' && a.id !== asset.id).map(a => (
                                            <option key={a.id} value={a.id}>{a.name} ({a.type})</option>
                                        ))}
                                    </select>
                                    <input
                                        type="number"
                                        className="w-24 border rounded px-2 py-1 text-sm text-right"
                                        value={fund.amount}
                                        onChange={(e) => {
                                            const list = [...plan.funding];
                                            list[idx].amount = parseFloat(e.target.value);
                                            updatePlan('funding', list);
                                        }}
                                    />
                                    <button onClick={() => {
                                        const list = plan.funding.filter((_, i) => i !== idx);
                                        updatePlan('funding', list);
                                    }}><Trash2 size={14} className="text-slate-300 hover:text-red-500"/></button>
                                </div>
                            ))}
                            <button
                                onClick={() => updatePlan('funding', [...plan.funding, { sourceId: '', amount: 0 }])}
                                className="text-xs text-blue-600 font-bold flex items-center gap-1 mt-2"
                            >
                                <Plus size={12}/> Add Funding Source
                            </button>
                        </div>
                    </Section>
                </div>
            </div>
        </div>
    );
};

// --- SIMPLE HOME PURCHASE PLANNER ---
export const HomePurchasePlanner = ({ asset, updateAsset, actions, accounts }) => {
    // Simplified version of the above
    const plan = asset.inputs.purchasePlan || {
        costs: { base: 0, closing: 0 },
        loan: { amount: 0, rate: 0.065 },
        funding: []
    };

    const updatePlan = (path, val) => {
        const newPlan = { ...plan };
        const parts = path.split('.');
        if(parts.length === 1) newPlan[parts[0]] = val;
        if(parts.length === 2) newPlan[parts[0]][parts[1]] = val;
        updateAsset('inputs.purchasePlan', newPlan);
    };

    const cashNeeded = (plan.costs.base + plan.costs.closing) - plan.loan.amount;

    const handleCreateLoan = () => {
        actions.addLoan({
            name: \`Loan: \${asset.name}\`,
            type: 'mortgage',
            inputs: {
                principal: plan.loan.amount,
                rate: plan.loan.rate,
                termMonths: 360,
                startDate: asset.inputs.startDate || '2026-01-01',
                payment: 0
            }
        });
        alert("Loan created.");
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Section title="Purchase Details">
                <LineItem label="Purchase Price" value={plan.costs.base} onChange={v => updatePlan('costs.base', v)} />
                <LineItem label="Est. Closing Costs" value={plan.costs.closing} onChange={v => updatePlan('costs.closing', v)} />
                <div className="h-px bg-slate-100 my-4"/>
                <LineItem label="Loan Amount" value={plan.loan.amount} onChange={v => updatePlan('loan.amount', v)} />
                <LineItem label="Interest Rate" value={plan.loan.rate} onChange={v => updatePlan('loan.rate', v)} step="0.001" />
                <button onClick={handleCreateLoan} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded w-full font-bold mt-2">
                    Create Loan Profile
                </button>
            </Section>

            <Section title="Funding (Cash to Close)">
                <div className="mb-4 font-bold text-center text-xl text-slate-700 border-b border-slate-100 pb-2">
                    <div className="text-xs text-slate-400 uppercase font-normal mb-1">Total Cash Needed</div>
                    \${cashNeeded.toLocaleString()}
                </div>
                 <div className="space-y-2">
                    {plan.funding.map((fund, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                            <select
                                className="flex-1 text-sm border rounded px-2 py-1"
                                value={fund.sourceId}
                                onChange={(e) => {
                                    const list = [...plan.funding];
                                    list[idx].sourceId = e.target.value;
                                    updatePlan('funding', list);
                                }}
                            >
                                <option value="">Select Source...</option>
                                {Object.values(accounts).filter(a => a.type !== 'property' && a.id !== asset.id).map(a => (
                                    <option key={a.id} value={a.id}>{a.name}</option>
                                ))}
                            </select>
                            <input
                                type="number"
                                className="w-24 border rounded px-2 py-1 text-sm text-right"
                                value={fund.amount}
                                onChange={(e) => {
                                    const list = [...plan.funding];
                                    list[idx].amount = parseFloat(e.target.value);
                                    updatePlan('funding', list);
                                }}
                            />
                            <button onClick={() => {
                                const list = plan.funding.filter((_, i) => i !== idx);
                                updatePlan('funding', list);
                            }}><Trash2 size={14} className="text-slate-300 hover:text-red-500"/></button>
                        </div>
                    ))}
                    <button
                        onClick={() => updatePlan('funding', [...plan.funding, { sourceId: '', amount: 0 }])}
                        className="text-xs text-blue-600 font-bold flex items-center gap-1 mt-2"
                    >
                        <Plus size={12}/> Add Funding Source
                    </button>
                </div>
            </Section>
        </div>
    );
};`
}