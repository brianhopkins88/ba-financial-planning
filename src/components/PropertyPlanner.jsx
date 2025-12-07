import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, ExternalLink, Calendar, DollarSign, Calculator, Lock, Info } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';

// --- CONSTANTS ---
const DEFAULT_FEES = [
    { name: "Underwriting / Processing / Credit", note: "$1,200 – $1,800", amount: 1500 },
    { name: "Appraisal", note: "$650 – $900", amount: 775 },
    { name: "Title & Escrow (Owner + Lender)", note: "$3,500 – $6,000", amount: 4750 },
    { name: "Recording & Notary", note: "$150 – $300", amount: 225 },
    { name: "HOA Setup / Transfer", note: "$200 – $500", amount: 350 }
];

const DEFAULT_PREPAIDS = [
    { name: "Prepaid Interest (15 days)", note: "@ 5.5%", amount: 900 },
    { name: "Property Tax Impound (3 mo)", note: "@ 1.1%", amount: 4417 },
    { name: "Insurance Impound (2 mo)", note: "Est. $250", amount: 250 },
    { name: "1st Year Home Insurance", note: "Premium", amount: 1500 }
];

// --- SHARED UTILS ---
const Section = ({ title, children, rightAction, variant = 'default' }) => {
    const variants = {
        default: 'border-slate-200',
        blue: 'border-blue-200 ring-1 ring-blue-50',
        emerald: 'border-emerald-200 ring-1 ring-emerald-50'
    };
    const headerVariants = {
        default: 'bg-slate-50 text-slate-500',
        blue: 'bg-blue-50 text-blue-600',
        emerald: 'bg-emerald-50 text-emerald-600'
    };

    return (
        <div className={`mb-6 bg-white border rounded-lg overflow-hidden shadow-sm ${variants[variant]}`}>
            <div className={`px-4 py-2 border-b border-slate-100 flex justify-between items-center ${headerVariants[variant]}`}>
                <span className="font-bold text-xs uppercase tracking-wider flex items-center gap-2">{title}</span>
                {rightAction}
            </div>
            <div className="p-4">{children}</div>
        </div>
    );
};

const LineItem = ({ label, value, onChange, type="number", onRemove, step, negative = false, readOnly = false }) => (
    <div className="flex justify-between items-center mb-2 group">
        <span className="text-sm text-slate-600 flex-1">{label}</span>
        <div className="flex items-center gap-2">
            <div className="relative w-32">
                <span className={`absolute left-2 top-1.5 text-xs ${negative ? 'text-red-400' : 'text-slate-400'}`}>$</span>
                <input
                    type={type}
                    step={step}
                    readOnly={readOnly}
                    className={`w-full pl-6 pr-2 py-1 border border-slate-200 rounded text-right text-sm font-mono font-bold outline-none focus:border-blue-500 ${negative ? 'text-red-600' : 'text-slate-700'} ${readOnly ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                    value={value}
                    onChange={(e) => onChange && onChange(type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
                />
            </div>
            {onRemove && (
                <button onClick={onRemove} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14}/></button>
            )}
        </div>
    </div>
);

const WorksheetTable = ({ items, onUpdate, onAdd, onRemove, title }) => (
    <div className="bg-slate-50 p-3 rounded border border-slate-200 mb-4">
        <div className="flex text-[10px] font-bold text-slate-400 uppercase mb-2">
            <div className="flex-1">{title}</div>
            <div className="w-24 text-right pr-2">Range / Note</div>
            <div className="w-24 text-right">Est. Cost</div>
            <div className="w-6"></div>
        </div>
        <div className="space-y-1">
            {items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center group">
                    <input
                        className="flex-1 text-xs border border-slate-200 rounded px-2 py-1 focus:border-blue-500 outline-none text-slate-700"
                        value={item.name}
                        onChange={(e) => onUpdate(idx, 'name', e.target.value)}
                        placeholder="Item Name"
                    />
                    <div className="w-24 relative">
                         <input
                            className="w-full text-[10px] text-right bg-transparent text-slate-400 border-b border-transparent focus:border-slate-300 outline-none"
                            value={item.note || ''}
                            onChange={(e) => onUpdate(idx, 'note', e.target.value)}
                            placeholder="Range..."
                        />
                    </div>
                    <div className="relative w-24">
                        <span className="absolute left-2 top-1 text-[10px] text-slate-400">$</span>
                        <input
                            type="number"
                            className="w-full pl-4 pr-1 py-1 text-xs text-right font-mono font-bold border border-slate-200 rounded focus:border-blue-500 outline-none text-slate-700"
                            value={item.amount}
                            onChange={(e) => onUpdate(idx, 'amount', parseFloat(e.target.value) || 0)}
                        />
                    </div>
                    <button onClick={() => onRemove(idx)} className="text-slate-300 hover:text-red-500 w-6 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={12}/></button>
                </div>
            ))}
        </div>
        <button onClick={onAdd} className="text-[10px] text-blue-600 font-bold flex items-center gap-1 hover:underline mt-2">
            <Plus size={10}/> Add Line Item
        </button>
    </div>
);

const FundingSourceSelector = ({ list, updateList, accounts, simulation, targetDate, label, autoLoanMode }) => {
    const targetMonthKey = targetDate ? targetDate.substring(0, 7) : null;
    const projectedBalances = useMemo(() => {
        if (!simulation || !targetMonthKey) return {};
        const row = simulation.timeline.find(t => t.date.startsWith(targetMonthKey))
                 || simulation.timeline[simulation.timeline.length - 1];
        return row ? row.balances : {};
    }, [simulation, targetMonthKey]);

    return (
        <div className="space-y-3">
            <div className="flex justify-between items-center text-xs text-slate-400 mb-1">
                <span>{label}</span>
                <span>Date: <span className="font-mono text-slate-600">{targetDate || 'Not Set'}</span></span>
            </div>
            {list.map((fund, idx) => {
                const acct = accounts[fund.sourceId];
                const projBal = acct ? (projectedBalances[acct.type] || acct.balance) : 0;
                const isOverdraft = projBal < fund.amount;

                return (
                    <div key={idx} className="flex gap-2 items-center bg-slate-50 p-2 rounded border border-slate-100">
                        <div className="flex-1 flex flex-col">
                            <select
                                className="text-sm bg-transparent outline-none font-medium text-slate-700 w-full"
                                value={fund.sourceId}
                                onChange={(e) => {
                                    const newList = [...list];
                                    newList[idx].sourceId = e.target.value;
                                    updateList(newList);
                                }}
                            >
                                <option value="">Select Account...</option>
                                {Object.values(accounts).filter(a => a.type !== 'property').map(a => (
                                    <option key={a.id} value={a.id}>{a.name} ({a.type})</option>
                                ))}
                            </select>
                            {fund.sourceId && (
                                <div className="flex items-center gap-1 mt-1">
                                    <span className="text-[10px] text-slate-400 uppercase">Est. Bal:</span>
                                    <span className={`text-[10px] font-mono font-bold ${isOverdraft ? 'text-red-500' : 'text-blue-600'}`}>
                                        ${Math.round(projBal).toLocaleString()}
                                    </span>
                                </div>
                            )}
                        </div>
                        <input
                            type="number"
                            className="w-24 border border-slate-200 rounded px-2 py-1 text-sm text-right font-bold h-8 focus:border-blue-500 outline-none"
                            value={fund.amount}
                            onChange={(e) => {
                                const newList = [...list];
                                newList[idx].amount = parseFloat(e.target.value);
                                updateList(newList);
                            }}
                        />
                        <button onClick={() => {
                            const newList = list.filter((_, i) => i !== idx);
                            updateList(newList);
                        }}><Trash2 size={14} className="text-slate-300 hover:text-red-500"/></button>
                    </div>
                );
            })}
            <button
                onClick={() => updateList([...list, { sourceId: '', amount: 0 }])}
                className="text-xs text-blue-600 font-bold flex items-center gap-1 mt-1 hover:underline"
            >
                <Plus size={12}/> {autoLoanMode ? "Add Down Payment Source" : "Add Funding Source"}
            </button>
        </div>
    );
};

// --- NEW CONSTRUCTION PLANNER ---
export const NewConstructionPlanner = ({ asset, updateAsset, actions, accounts, simulation }) => {
    const plan = asset.inputs.purchasePlan || {
        contractDate: '2026-06-01',
        autoLoan: false,
        costs: { base: 0, structural: 0, design: 0, lot: 0, credits: 0, custom: [] },
        closing: { fees: [...DEFAULT_FEES], prepaids: [...DEFAULT_PREPAIDS], buyDown: 0, lenderCredits: 0 },
        deposits: { contract: 30000, designPct: 0.20 },
        loan: { amount: 0, rate: 0.065, term: 360 },
        funding: [],
        depositFunding: []
    };

    if (!plan.closing.fees) plan.closing.fees = [...DEFAULT_FEES];
    if (!plan.closing.prepaids) plan.closing.prepaids = [...DEFAULT_PREPAIDS];

    const updatePlan = (path, val) => {
        const newPlan = { ...plan };
        const parts = path.split('.');
        if(parts.length === 1) newPlan[parts[0]] = val;
        else if(parts.length === 2) newPlan[parts[0]][parts[1]] = val;
        updateAsset('inputs.purchasePlan', newPlan);
    };

    // 1. PRICE CALCS
    const totalPurchasePrice = (plan.costs.base + plan.costs.structural + plan.costs.design + plan.costs.lot) - plan.costs.credits;

    // 2. DEPOSIT CALCS
    const designDepositAmount = plan.costs.design * (plan.deposits.designPct || 0);
    const totalDepositsDue = plan.deposits.contract + designDepositAmount;

    // 3. CLOSING CALCS
    const feesTotal = (plan.closing.fees || []).reduce((s,i) => s + (i.amount || 0), 0);
    const prepaidsTotal = (plan.closing.prepaids || []).reduce((s,i) => s + (i.amount || 0), 0);
    const buyDownCost = plan.closing.buyDown || 0;
    const lenderCredits = plan.closing.lenderCredits || 0;

    const totalClosingCosts = feesTotal + prepaidsTotal + buyDownCost;
    const netClosingCosts = Math.max(0, totalClosingCosts - lenderCredits);

    // 4. CASH TO CLOSE
    const grandTotalRequired = totalPurchasePrice + netClosingCosts;
    const remainingToClose = grandTotalRequired - totalDepositsDue;

    // Funding Totals
    const totalClosingFunding = (plan.funding || []).reduce((s, i) => s + (i.amount || 0), 0);
    const totalDepositFunding = (plan.depositFunding || []).reduce((s, i) => s + (i.amount || 0), 0);

    // --- AUTO-LOAN LOGIC ---
    useEffect(() => {
        if (plan.autoLoan) {
            const calculatedLoan = Math.max(0, remainingToClose - totalClosingFunding);
            if (calculatedLoan !== plan.loan.amount) {
                updatePlan('loan.amount', calculatedLoan);
            }
        }
    }, [plan.autoLoan, remainingToClose, totalClosingFunding, plan.loan.amount]);

    // --- AUTO-SYNC ASSET VALUE ---
    // Ensure the main asset "balance" (value) matches the calculated Total Purchase Price
    useEffect(() => {
        if (Math.abs(asset.balance - totalPurchasePrice) > 1) {
            updateAsset('balance', totalPurchasePrice);
        }
    }, [totalPurchasePrice, asset.balance]);

    // Gap (Manual Mode)
    const fundingGap = remainingToClose - plan.loan.amount - totalClosingFunding;

    const updateList = (listKey, idx, field, val) => {
        const items = [...plan.closing[listKey]];
        items[idx] = { ...items[idx], [field]: val };
        updatePlan(`closing.${listKey}`, items);
    };
    const addToList = (listKey) => updatePlan(`closing.${listKey}`, [...plan.closing[listKey], { name: '', amount: 0 }]);
    const removeFromList = (listKey, idx) => updatePlan(`closing.${listKey}`, plan.closing[listKey].filter((_, i) => i !== idx));

    const handleCreateLoan = () => {
        const startDate = asset.inputs.startDate || '2027-01-01';

        // CALCULATE PMT (Monthly Payment)
        const principal = plan.loan.amount;
        const rate = plan.loan.rate;
        const months = plan.loan.term;
        let pmt = 0;

        if (principal > 0 && months > 0) {
            if (rate === 0) {
                pmt = principal / months;
            } else {
                const r = rate / 12;
                pmt = (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
            }
        }

        actions.addLoan({
            name: `Loan: ${asset.name}`,
            type: 'mortgage',
            inputs: {
                principal: principal,
                rate: rate,
                termMonths: months,
                startDate: startDate,
                payment: Number(pmt.toFixed(2)) // Store correct calculated payment
            }
        });
        alert(`Loan created starting ${startDate} with payment $${pmt.toFixed(2)}/mo. Check Loans module.`);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* TOP METRICS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div className="p-4 bg-slate-50 rounded border border-slate-200">
                     <div className="text-[10px] text-slate-500 font-bold uppercase">Total Purchase Price</div>
                     <div className="text-xl font-bold text-slate-700">${totalPurchasePrice.toLocaleString()}</div>
                 </div>
                 <div className="p-4 bg-blue-50 rounded border border-blue-100">
                     <div className="text-[10px] text-blue-600 font-bold uppercase flex justify-between">
                        <span>Due at Contract</span>
                        <span>{plan.contractDate}</span>
                     </div>
                     <div className="text-xl font-bold text-blue-700">${totalDepositsDue.toLocaleString()}</div>
                 </div>
                 <div className="p-4 bg-emerald-50 rounded border border-emerald-100">
                     <div className="text-[10px] text-emerald-600 font-bold uppercase flex justify-between">
                        <span>Due at Closing</span>
                        <span>{asset.inputs.startDate}</span>
                     </div>
                     <div className="text-xl font-bold text-emerald-700">${remainingToClose.toLocaleString()}</div>
                 </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* --- LEFT: COST WORKSHEET --- */}
                <div className="space-y-6">
                    <Section title="1. Construction Costs">
                        <div className="flex gap-4 mb-4">
                            <div className="flex-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Contract Date</label>
                                <input type="date" className="w-full border border-slate-200 rounded px-2 py-1 text-sm font-bold text-slate-700" value={plan.contractDate} onChange={e => updatePlan('contractDate', e.target.value)} />
                            </div>
                            <div className="flex-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Closing Date</label>
                                <input type="date" disabled className="w-full bg-slate-100 border border-slate-200 rounded px-2 py-1 text-sm font-bold text-slate-500" value={asset.inputs.startDate || ''} />
                            </div>
                        </div>
                        <LineItem label="Base Price" value={plan.costs.base} onChange={v => updatePlan('costs.base', v)} />
                        <LineItem label="Lot Premium" value={plan.costs.lot} onChange={v => updatePlan('costs.lot', v)} />
                        <LineItem label="Structural Upgrades" value={plan.costs.structural} onChange={v => updatePlan('costs.structural', v)} />
                        <LineItem label="Design Studio Options" value={plan.costs.design} onChange={v => updatePlan('costs.design', v)} />
                        <div className="h-px bg-slate-100 my-2"/>
                        <LineItem label="Builder Credits (-)" value={plan.costs.credits} onChange={v => updatePlan('costs.credits', v)} negative />
                    </Section>

                    <Section title="3. Loan & Closing Cost Estimator" rightAction={<button onClick={handleCreateLoan} className="text-[10px] bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 flex items-center gap-1">Create Loan <ExternalLink size={10}/></button>}>

                        {/* Auto-Calculate Toggle */}
                        <div className="flex items-center gap-2 mb-4 bg-indigo-50 p-2 rounded border border-indigo-100">
                            <input
                                type="checkbox"
                                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                                checked={plan.autoLoan || false}
                                onChange={e => updatePlan('autoLoan', e.target.checked)}
                            />
                            <div className="flex-1">
                                <span className="text-xs font-bold text-indigo-700 block">Auto-Calculate Loan Amount</span>
                                <span className="text-[10px] text-indigo-500">Loan fills the gap between Price and Cash Paid</span>
                            </div>
                            <Calculator size={16} className="text-indigo-300"/>
                        </div>

                        <LineItem
                            label="Loan Amount"
                            value={plan.loan.amount}
                            onChange={v => updatePlan('loan.amount', v)}
                            readOnly={plan.autoLoan}
                        />
                        <LineItem label="Interest Rate (dec)" value={plan.loan.rate} onChange={v => updatePlan('loan.rate', v)} step="0.001" />

                        <div className="h-px bg-slate-100 my-4"/>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Closing Cost Worksheet</span>
                            <span className="text-xs font-bold text-slate-700">${totalClosingCosts.toLocaleString()} (Gross)</span>
                        </div>

                        <WorksheetTable
                            title="Lender, Title & Escrow Fees"
                            items={plan.closing.fees}
                            onUpdate={(i,f,v) => updateList('fees', i, f, v)}
                            onAdd={() => addToList('fees')}
                            onRemove={(i) => removeFromList('fees', i)}
                        />

                        <WorksheetTable
                            title="Prepaids & Impounds"
                            items={plan.closing.prepaids}
                            onUpdate={(i,f,v) => updateList('prepaids', i, f, v)}
                            onAdd={() => addToList('prepaids')}
                            onRemove={(i) => removeFromList('prepaids', i)}
                        />

                        <LineItem label="Interest Rate Buy Down" value={plan.closing.buyDown} onChange={v => updatePlan('closing.buyDown', v)} />
                        <div className="h-px bg-slate-100 my-2"/>
                        <LineItem label="Lender / Seller Credits (-)" value={plan.closing.lenderCredits} onChange={v => updatePlan('closing.lenderCredits', v)} negative />

                        <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100 bg-slate-50 p-2 rounded">
                            <span className="text-xs font-bold text-slate-600">Net Closing Costs (to pay)</span>
                            <span className="text-sm font-bold text-slate-800">${netClosingCosts.toLocaleString()}</span>
                        </div>
                    </Section>
                </div>

                {/* --- RIGHT: FUNDING --- */}
                <div className="space-y-6">
                    <Section title="2. Contract Deposits" variant="blue">
                        <LineItem label="Fixed Contract Deposit" value={plan.deposits.contract} onChange={v => updatePlan('deposits.contract', v)} />
                        <div className="flex justify-between items-center mb-2">
                             <span className="text-sm text-slate-600">Design Deposit %</span>
                             <input type="number" className="w-16 border rounded text-right text-sm" value={plan.deposits.designPct} onChange={e => updatePlan('deposits.designPct', parseFloat(e.target.value))} step="0.1"/>
                        </div>
                        <div className="flex justify-between items-center mb-4 text-xs text-slate-400 bg-slate-50 p-2 rounded">
                            <span>Calc Design Deposit:</span>
                            <span className="font-mono">${designDepositAmount.toLocaleString()}</span>
                        </div>

                        <div className="border-t border-slate-100 pt-4">
                            <FundingSourceSelector
                                list={plan.depositFunding || []}
                                updateList={(l) => updatePlan('depositFunding', l)}
                                accounts={accounts}
                                simulation={simulation}
                                targetDate={plan.contractDate}
                                label="Source for Deposits"
                            />
                            <div className="flex justify-between items-center mt-2 text-xs">
                                <span className="text-slate-400">Total Funded:</span>
                                <span className={`font-bold ${totalDepositFunding < totalDepositsDue ? 'text-red-500' : 'text-green-600'}`}>
                                    ${totalDepositFunding.toLocaleString()} / ${totalDepositsDue.toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </Section>

                    <Section title={plan.autoLoan ? "4. Cash Down Payment" : "4. Closing Funding"} variant="emerald">
                        <div className="mb-4 bg-emerald-50 p-3 rounded border border-emerald-100">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs text-emerald-800 font-bold uppercase">Total Due at Close</span>
                                <span className="text-sm font-bold text-emerald-700 font-mono">${remainingToClose.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs opacity-70">
                                <span>(Price + Net Costs - Deposits)</span>
                            </div>
                        </div>

                        {!plan.autoLoan && fundingGap !== 0 && (
                            <div className={`mb-4 p-2 rounded text-xs font-bold flex justify-between items-center ${fundingGap > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                <span>{fundingGap > 0 ? "Shortfall (Need Cash or Loan):" : "Surplus (Reduce Loan/Cash):"}</span>
                                <span>${Math.abs(fundingGap).toLocaleString()}</span>
                            </div>
                        )}

                        <FundingSourceSelector
                            list={plan.funding}
                            updateList={(l) => updatePlan('funding', l)}
                            accounts={accounts}
                            simulation={simulation}
                            targetDate={asset.inputs.startDate}
                            label={plan.autoLoan ? "Sources for Down Payment" : "Sources to Fill Gap"}
                            autoLoanMode={plan.autoLoan}
                        />
                    </Section>
                </div>
            </div>
        </div>
    );
};

// --- HOME PURCHASE PLANNER ---
export const HomePurchasePlanner = ({ asset, updateAsset, actions, accounts, simulation }) => {
    // Basic implementation for existing homes - logic mirrors the advanced planner
    // but simplified UI.
    return <NewConstructionPlanner asset={asset} updateAsset={updateAsset} actions={actions} accounts={accounts} simulation={simulation} />;
};