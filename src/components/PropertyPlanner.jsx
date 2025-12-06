import React from 'react';
import { Plus, Trash2, ExternalLink, Calculator, Info, Undo2 } from 'lucide-react';
import { getDaysInMonth, getDate, parseISO, isValid } from 'date-fns';

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

const LineItem = ({ label, value, onChange, type="number", onRemove, step, readOnly, subtext, highlight, onRevert }) => (
    <div className={`flex justify-between items-center mb-2 group ${highlight ? 'bg-blue-50/50 -mx-2 px-2 py-1 rounded' : ''}`}>
        <div className="flex-1">
            <span className={`text-sm ${highlight ? 'font-bold text-blue-700' : 'text-slate-600'}`}>{label}</span>
            {subtext && <div className="text-[10px] text-slate-400 leading-tight">{subtext}</div>}
        </div>
        <div className="flex items-center gap-2">
            {onRevert && (
                <button onClick={onRevert} className="text-blue-400 hover:text-blue-600" title="Revert to Calculated Value">
                    <Undo2 size={14}/>
                </button>
            )}
            <div className="relative w-32">
                <span className="absolute left-2 top-1.5 text-slate-400 text-xs">$</span>
                <input
                    type={type}
                    step={step}
                    readOnly={readOnly}
                    className={`w-full pl-6 pr-2 py-1 border rounded text-right text-sm font-mono font-bold outline-none ${
                        readOnly
                        ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-default'
                        : 'border-slate-200 text-slate-700 focus:border-blue-500 bg-white'
                    } ${onRevert ? 'ring-1 ring-blue-200 bg-blue-50/20' : ''}`}
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

// --- REUSABLE CLOSING COST ESTIMATOR ---
const ClosingCostEstimator = ({ plan, updatePlan, purchasePrice, loanAmount, loanRate, closeDateStr }) => {
    if (!plan.closingWorksheet) plan.closingWorksheet = {
        fees: { lenderAdmin: 1500, appraisal: 775, titleEscrow: 4750, recording: 225, hoaSetup: 350 },
        prepaids: { taxMonths: 3, insuranceMonths: 2, insurancePremiumYear: 1500, taxRate: 0.0125, manualTax: null, manualIns: null, manualInt: null },
        buyDown: { points: 0, cost: 0 },
        incentives: { builderCredit: 0 }
    };

    const fees = plan.closingWorksheet.fees;
    const pre = plan.closingWorksheet.prepaids;
    const buyDown = plan.closingWorksheet.buyDown;
    const incentives = plan.closingWorksheet.incentives;

    // --- CALCULATIONS ---
    const estMonthlyTax = (purchasePrice * (pre.taxRate || 0.0125)) / 12;
    const calcTax = estMonthlyTax * (pre.taxMonths || 3);
    const finalTax = pre.manualTax !== undefined && pre.manualTax !== null ? pre.manualTax : calcTax;

    const estMonthlyIns = (pre.insurancePremiumYear || 1500) / 12;
    const calcIns = (estMonthlyIns * (pre.insuranceMonths || 2)) + (pre.insurancePremiumYear || 1500);
    const finalIns = pre.manualIns !== undefined && pre.manualIns !== null ? pre.manualIns : calcIns;

    let calcInt = 0;
    const closeDate = parseISO(closeDateStr);
    if (isValid(closeDate) && loanAmount > 0) {
        const daysInMonth = getDaysInMonth(closeDate);
        const dayOfMonth = getDate(closeDate);
        const daysRemaining = daysInMonth - dayOfMonth + 1;
        const annualInterest = loanAmount * (loanRate || 0);
        const dailyInterest = annualInterest / 365;
        const monthlyInterest = annualInterest / 12;
        calcInt = (dailyInterest * daysRemaining) + monthlyInterest;
    }
    const finalInt = pre.manualInt !== undefined && pre.manualInt !== null ? pre.manualInt : calcInt;

    const totalFixedFees = fees.lenderAdmin + fees.appraisal + fees.titleEscrow + fees.recording + fees.hoaSetup;
    const totalPrepaids = finalTax + finalIns + finalInt;
    const totalClosingCosts = totalFixedFees + totalPrepaids + (buyDown.cost || 0);

    return (
        <Section title="Closing Cost Estimator">
            <div className="bg-slate-50 -m-4 p-4 mb-2 border-b border-slate-100">
                <h4 className="font-bold text-xs text-slate-600 uppercase mb-3 flex items-center gap-2"><Calculator size={14}/> Fixed Fees</h4>
                <LineItem label="Lender / Admin / Credit" value={fees.lenderAdmin} onChange={v => updatePlan('closingWorksheet.fees.lenderAdmin', v)} subtext="Norm: $1,200 - $1,800" />
                <LineItem label="Appraisal" value={fees.appraisal} onChange={v => updatePlan('closingWorksheet.fees.appraisal', v)} subtext="Norm: $650 - $900" />
                <LineItem label="Title & Escrow" value={fees.titleEscrow} onChange={v => updatePlan('closingWorksheet.fees.titleEscrow', v)} subtext="Norm: $3,500 - $6,000" />
                <LineItem label="Recording & Notary" value={fees.recording} onChange={v => updatePlan('closingWorksheet.fees.recording', v)} subtext="Norm: $150 - $300" />
                <LineItem label="HOA Transfer/Setup" value={fees.hoaSetup} onChange={v => updatePlan('closingWorksheet.fees.hoaSetup', v)} subtext="Norm: $200 - $500" />
            </div>

            <div className="bg-slate-50 -m-4 p-4 mb-2 border-b border-slate-100">
                <h4 className="font-bold text-xs text-slate-600 uppercase mb-3 flex items-center gap-2"><Info size={14}/> Prepaids & Impounds</h4>

                <div className="grid grid-cols-2 gap-4 mb-2">
                    <div><label className="text-[10px] text-slate-400 uppercase font-bold">Tax Rate (Est)</label><input type="number" step="0.001" className="w-full border rounded px-2 py-1 text-sm text-right" value={pre.taxRate} onChange={e => updatePlan('closingWorksheet.prepaids.taxRate', parseFloat(e.target.value))} /></div>
                    <div><label className="text-[10px] text-slate-400 uppercase font-bold">Impound Mos</label><input type="number" className="w-full border rounded px-2 py-1 text-sm text-right" value={pre.taxMonths} onChange={e => updatePlan('closingWorksheet.prepaids.taxMonths', parseFloat(e.target.value))} /></div>
                </div>
                <LineItem
                    label="Tax Impound (Total)"
                    value={Math.round(finalTax)}
                    onChange={v => updatePlan('closingWorksheet.prepaids.manualTax', v)}
                    onRevert={pre.manualTax !== null ? () => updatePlan('closingWorksheet.prepaids.manualTax', null) : null}
                    subtext={pre.manualTax !== null ? "Manual Override Active" : `Calculated based on Price & Rate`}
                />

                <div className="h-px bg-slate-200 my-2"></div>

                <LineItem label="1st Year Insurance" value={pre.insurancePremiumYear} onChange={v => updatePlan('closingWorksheet.prepaids.insurancePremiumYear', v)} />
                <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-slate-600">Ins. Reserve Months</span>
                    <input type="number" className="w-16 border rounded text-right text-sm" value={pre.insuranceMonths} onChange={e => updatePlan('closingWorksheet.prepaids.insuranceMonths', parseFloat(e.target.value))} />
                </div>
                <LineItem
                    label="Insurance Total"
                    value={Math.round(finalIns)}
                    onChange={v => updatePlan('closingWorksheet.prepaids.manualIns', v)}
                    onRevert={pre.manualIns !== null ? () => updatePlan('closingWorksheet.prepaids.manualIns', null) : null}
                    subtext={pre.manualIns !== null ? "Manual Override Active" : "1st Year + Reserves"}
                />

                <div className="h-px bg-slate-200 my-2"></div>

                <LineItem
                    label="Prepaid Interest"
                    value={Math.round(finalInt)}
                    onChange={v => updatePlan('closingWorksheet.prepaids.manualInt', v)}
                    onRevert={pre.manualInt !== null ? () => updatePlan('closingWorksheet.prepaids.manualInt', null) : null}
                    subtext={pre.manualInt !== null ? "Manual Override Active" : "Close Month Prorated + Next Full Month"}
                />
            </div>

            <div className="mt-6 space-y-3">
                <LineItem label="Rate Buy Down Cost" value={buyDown.cost} onChange={v => updatePlan('closingWorksheet.buyDown.cost', v)} />
                <LineItem label="Builder/Lender Credits" value={incentives.builderCredit} onChange={v => updatePlan('closingWorksheet.incentives.builderCredit', v)} highlight={true} subtext="Applied against closing costs" />
            </div>

            <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between items-center">
                <span className="font-bold text-slate-700">Total Est. Closing Costs</span>
                <span className="font-bold text-red-600">${Math.round(totalClosingCosts).toLocaleString()}</span>
            </div>
        </Section>
    );
};

// --- MULTI-SOURCE FUNDING COMPONENT ---
const FundingManager = ({ plan, updatePlan, accounts, getEstBalance, closeDateStr, totalNeeded }) => {

    // Toggle a funding source in the list
    const toggleSource = (sourceId) => {
        const currentSources = plan.funding || [];
        const exists = currentSources.find(f => f.sourceId === sourceId);
        let newSources;
        if (exists) {
            newSources = currentSources.filter(f => f.sourceId !== sourceId);
        } else {
            newSources = [...currentSources, { sourceId, amount: 0 }];
        }
        updatePlan('funding', newSources);
    };

    const updateAmount = (sourceId, amount) => {
        const newSources = plan.funding.map(f => f.sourceId === sourceId ? { ...f, amount } : f);
        updatePlan('funding', newSources);
    };

    const totalAllocated = (plan.funding || []).reduce((sum, f) => sum + (f.amount || 0), 0);
    const remaining = totalNeeded - totalAllocated;

    return (
        <Section title="5. Funding Logic (Source of Cash)">
            <div className="mb-4 text-sm text-slate-600 flex justify-between bg-emerald-50 p-3 rounded border border-emerald-100">
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-emerald-600">Cash Needed at Close</span>
                    <span className="font-bold text-emerald-800 text-lg">${Math.round(totalNeeded).toLocaleString()}</span>
                </div>
                <div className="flex flex-col text-right">
                    <span className="text-[10px] uppercase font-bold text-emerald-600">Remaining to Alloc</span>
                    <span className={`font-bold text-lg ${remaining > 0 ? 'text-red-500' : 'text-emerald-500'}`}>${Math.round(remaining).toLocaleString()}</span>
                </div>
            </div>

            <div className="space-y-3">
                <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-slate-400 uppercase border-b border-slate-100 pb-1 mb-1">
                    <div className="col-span-5">Account</div>
                    <div className="col-span-3 text-right">Est. Bal (Close)</div>
                    <div className="col-span-4 text-right">Use Amount (Net)</div>
                </div>
                {Object.values(accounts).filter(a => a.type !== 'property').map(acct => {
                    const isSelected = (plan.funding || []).some(f => f.sourceId === acct.id);
                    const fundingItem = (plan.funding || []).find(f => f.sourceId === acct.id) || { amount: 0 };
                    const estBalance = getEstBalance ? getEstBalance(acct.id, closeDateStr) : acct.balance;

                    // Tax Warning
                    const isTaxable = ['retirement', 'inherited'].includes(acct.type);

                    return (
                        <div key={acct.id} className={`p-2 rounded border transition-colors ${isSelected ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-100 hover:border-blue-100'}`}>
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleSource(acct.id)}
                                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                                />
                                <div className="flex-1 grid grid-cols-12 gap-2 items-center">
                                    <div className="col-span-5 truncate">
                                        <div className="font-bold text-slate-700 text-xs truncate">{acct.name}</div>
                                        <div className="text-[9px] text-slate-400 uppercase">{acct.type}</div>
                                    </div>
                                    <div className="col-span-3 text-right text-xs font-mono text-slate-500">
                                        ${Math.round(estBalance).toLocaleString()}
                                    </div>
                                    <div className="col-span-4">
                                        {isSelected ? (
                                            <input
                                                type="number"
                                                className="w-full text-right text-sm font-bold border rounded px-1 py-0.5 focus:border-blue-500 outline-none"
                                                value={fundingItem.amount}
                                                onChange={(e) => updateAmount(acct.id, parseFloat(e.target.value) || 0)}
                                            />
                                        ) : <div className="text-right text-xs text-slate-300">-</div>}
                                    </div>
                                </div>
                            </div>
                            {isSelected && isTaxable && fundingItem.amount > 0 && (
                                <div className="ml-7 mt-1 text-[10px] text-orange-600 bg-orange-50 p-1 rounded flex gap-1 items-center">
                                    <Info size={10}/>
                                    <span>Subject to Income Tax. System will withdraw gross amount to cover net need.</span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </Section>
    );
};

// --- NEW CONSTRUCTION PLANNER ---
export const NewConstructionPlanner = ({ asset, updateAsset, actions, accounts, getEstBalance }) => {
    const plan = asset.inputs.purchasePlan || {};
    if (!plan.costs) plan.costs = { base: 0, structural: 0, design: 0, lot: 0, credits: 0, custom: [] };
    if (!plan.deposits) plan.deposits = { contract: 30000, designPct: 0.20 };
    if (!plan.loan) plan.loan = { amount: 0, rate: 0.065, term: 360 };
    if (!plan.funding) plan.funding = [];

    const updatePlan = (path, val) => {
        const newPlan = { ...plan };
        const parts = path.split('.');
        let current = newPlan;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) current[parts[i]] = {};
            current = current[parts[i]];
        }
        current[parts[parts.length - 1]] = val;
        updateAsset('inputs.purchasePlan', newPlan);
    };

    const totalPurchasePrice = (plan.costs.base + plan.costs.structural + plan.costs.design + plan.costs.lot) - plan.costs.credits + plan.costs.custom.reduce((s,i) => s + i.amount, 0);

    // Quick Calc for summary
    const closingWorksheet = plan.closingWorksheet || {};
    const fees = closingWorksheet.fees || { lenderAdmin:0, appraisal:0, titleEscrow:0, recording:0, hoaSetup:0 };
    const pre = closingWorksheet.prepaids || { manualTax:null, manualIns:null, manualInt:null };
    const buyDown = closingWorksheet.buyDown || { cost: 0 };
    const incentives = closingWorksheet.incentives || { builderCredit: 0 };

    const estTax = pre.manualTax ?? ((totalPurchasePrice * (pre.taxRate||0.0125)/12) * (pre.taxMonths||3));
    const estIns = pre.manualIns ?? (((pre.insurancePremiumYear||1500)/12 * (pre.insuranceMonths||2)) + (pre.insurancePremiumYear||1500));
    const estInt = pre.manualInt ?? 0;

    const estClosing = fees.lenderAdmin+fees.appraisal+fees.titleEscrow+fees.recording+fees.hoaSetup + estTax + estIns + estInt + (buyDown.cost||0);
    const depositsPaid = plan.deposits.contract + (plan.costs.design * plan.deposits.designPct);
    const totalCashToClose = (totalPurchasePrice + estClosing) - incentives.builderCredit - depositsPaid - plan.loan.amount;

    const handleCreateLoan = () => {
        const startDate = asset.inputs.startDate || '2026-06-01';
        actions.addLoan({
            name: `Loan: ${asset.name}`,
            type: 'mortgage',
            inputs: { principal: plan.loan.amount, rate: plan.loan.rate, termMonths: plan.loan.term, startDate: startDate, payment: 0 }
        });
        alert(`Loan created starting ${startDate}.`);
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
                 <div className="p-4 bg-blue-50 rounded border border-blue-100">
                     <div className="text-xs text-blue-500 font-bold uppercase">Total Purchase Price</div>
                     <div className="text-2xl font-bold text-blue-700">${totalPurchasePrice.toLocaleString()}</div>
                 </div>
                 <div className="p-4 bg-emerald-50 rounded border border-emerald-100">
                     <div className="text-xs text-emerald-600 font-bold uppercase">Net Cash to Close</div>
                     <div className="text-2xl font-bold text-emerald-700">${Math.round(totalCashToClose).toLocaleString()}</div>
                     <div className="text-[10px] text-emerald-600 mt-1">Includes Closing Costs & Credits</div>
                 </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                        <LineItem label="Close Date (Calc Interest)" value={asset.inputs.startDate || ''} type="date" onChange={v => updateAsset('inputs.startDate', v)} />
                    </Section>

                    <Section title="3. Deposits & Prepaids">
                        <LineItem label="Contract Deposit" value={plan.deposits.contract} onChange={v => updatePlan('deposits.contract', v)} />
                        <div className="flex justify-between items-center mb-2">
                             <span className="text-sm text-slate-600">Design Deposit %</span>
                             <input type="number" className="w-16 border rounded text-right text-sm" value={plan.deposits.designPct} onChange={e => updatePlan('deposits.designPct', parseFloat(e.target.value))} step="0.1"/>
                        </div>
                        <div className="flex justify-between items-center mb-2 text-sm text-slate-400">
                            <span>Calc Design Deposit:</span>
                            <span>${(plan.costs.design * plan.deposits.designPct).toLocaleString()}</span>
                        </div>
                    </Section>
                </div>

                <div>
                    <ClosingCostEstimator
                        plan={plan}
                        updatePlan={updatePlan}
                        purchasePrice={totalPurchasePrice}
                        loanAmount={plan.loan.amount}
                        loanRate={plan.loan.rate}
                        closeDateStr={asset.inputs.startDate}
                    />

                    <FundingManager
                        plan={plan}
                        updatePlan={updatePlan}
                        accounts={accounts}
                        getEstBalance={getEstBalance}
                        closeDateStr={asset.inputs.startDate}
                        totalNeeded={totalCashToClose}
                    />
                </div>
            </div>
        </div>
    );
};

// --- EXISTING HOME PLANNER ---
export const HomePurchasePlanner = ({ asset, updateAsset, actions, accounts, getEstBalance }) => {
    const plan = asset.inputs.purchasePlan || {};
    if (!plan.costs) plan.costs = { base: 0 };
    if (!plan.loan) plan.loan = { amount: 0, rate: 0.065, term: 360 };
    if (!plan.funding) plan.funding = [];

    const updatePlan = (path, val) => {
        const newPlan = { ...plan };
        const parts = path.split('.');
        let current = newPlan;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) current[parts[i]] = {};
            current = current[parts[i]];
        }
        current[parts[parts.length - 1]] = val;
        updateAsset('inputs.purchasePlan', newPlan);
    };

    const totalPurchasePrice = plan.costs.base || 0;

    // Quick Calc for summary
    const closingWorksheet = plan.closingWorksheet || {};
    const fees = closingWorksheet.fees || { lenderAdmin:0, appraisal:0, titleEscrow:0, recording:0, hoaSetup:0 };
    const pre = closingWorksheet.prepaids || { manualTax:null, manualIns:null, manualInt:null };
    const buyDown = closingWorksheet.buyDown || { cost: 0 };
    const incentives = closingWorksheet.incentives || { builderCredit: 0 };

    const estTax = pre.manualTax ?? ((totalPurchasePrice * (pre.taxRate||0.0125)/12) * (pre.taxMonths||3));
    const estIns = pre.manualIns ?? (((pre.insurancePremiumYear||1500)/12 * (pre.insuranceMonths||2)) + (pre.insurancePremiumYear||1500));
    const estInt = pre.manualInt ?? 0;

    const estClosing = fees.lenderAdmin+fees.appraisal+fees.titleEscrow+fees.recording+fees.hoaSetup + estTax + estIns + estInt + (buyDown.cost||0);
    const cashNeeded = (totalPurchasePrice + estClosing) - incentives.builderCredit - plan.loan.amount;

    const handleCreateLoan = () => {
        const startDate = asset.inputs.startDate || '2026-01-01';
        actions.addLoan({
            name: `Loan: ${asset.name}`,
            type: 'mortgage',
            inputs: { principal: plan.loan.amount, rate: plan.loan.rate, termMonths: 360, startDate: startDate, payment: 0 }
        });
        alert("Loan created.");
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <Section title="Purchase Details">
                    <LineItem label="Purchase Price" value={plan.costs.base} onChange={v => updatePlan('costs.base', v)} />
                    <div className="h-px bg-slate-100 my-4"/>
                    <LineItem label="Loan Amount" value={plan.loan.amount} onChange={v => updatePlan('loan.amount', v)} />
                    <LineItem label="Interest Rate" value={plan.loan.rate} onChange={v => updatePlan('loan.rate', v)} step="0.001" />
                    <LineItem label="Close Date" value={asset.inputs.startDate || ''} type="date" onChange={v => updateAsset('inputs.startDate', v)} />
                    <button onClick={handleCreateLoan} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded w-full font-bold mt-2">
                        Create Loan Profile
                    </button>
                </Section>
            </div>

            <div>
                {/* SHARED ESTIMATOR */}
                <ClosingCostEstimator
                    plan={plan}
                    updatePlan={updatePlan}
                    purchasePrice={plan.costs.base}
                    loanAmount={plan.loan.amount}
                    loanRate={plan.loan.rate}
                    closeDateStr={asset.inputs.startDate}
                />

                <FundingManager
                    plan={plan}
                    updatePlan={updatePlan}
                    accounts={accounts}
                    getEstBalance={getEstBalance}
                    closeDateStr={asset.inputs.startDate}
                    totalNeeded={cashNeeded}
                />
            </div>
        </div>
    );
};