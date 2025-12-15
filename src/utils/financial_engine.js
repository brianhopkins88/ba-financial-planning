import { addMonths, getYear, getMonth, format, isAfter, parseISO, isValid, differenceInMonths } from 'date-fns';
import { calculateRevolvingLoan, calculateFixedLoan } from './loan_math.js';
import { calculateAssetGrowth } from './asset_math.js';

// --- HELPER: Smart Profile Resolution ---
// This prioritizes the local "Draft" data if the simulation is running
// in the same period as the base profile, ensuring immediate feedback for edits.
const getEffectiveProfile = (sequence, dateStr, profiles, localData) => {
    // 1. If no sequence, default to local data
    if (!sequence || sequence.length === 0) return localData;

    // 2. Find the active profile item for this simulation date
    const activeItems = sequence.filter(item => item.isActive);
    const candidates = activeItems.filter(item => item.startDate <= dateStr);

    // Sort by date descending (latest start date first)
    candidates.sort((a, b) => b.startDate.localeCompare(a.startDate));
    const currentMatch = candidates[0];

    if (!currentMatch) return localData; // No profile active yet, use local defaults

    // 3. Determine if this is the "Base" profile (the first one in the chain)
    // We assume the user is editing the base profile in the main view.
    const sortedByDate = [...activeItems].sort((a, b) => a.startDate.localeCompare(b.startDate));
    const baseItem = sortedByDate[0];

    // 4. CRITICAL FIX: If the current timeline profile IS the base profile,
    // use 'localData' (which contains your recent unsaved edits) instead of the stale store data.
    if (baseItem && currentMatch.profileId === baseItem.profileId) {
        return localData;
    }

    // 5. Otherwise, this is a future profile switch (e.g. Retirement Phase), load from store.
    return profiles[currentMatch.profileId]?.data || localData;
};

const getWorkStatus = (year, activeIncomeProfile, fallbackWorkStatus) => {
    if (activeIncomeProfile && activeIncomeProfile.workStatus && activeIncomeProfile.workStatus[year]) {
        return activeIncomeProfile.workStatus[year];
    }
    if (fallbackWorkStatus && fallbackWorkStatus[year]) {
        return fallbackWorkStatus[year];
    }
    return { primary: 0, spouse: 0 };
};

const getTaxRate = (status, assumptions) => {
    const tiers = assumptions.taxTiers || { bothFull: 0.32, onePart: 0.27, bothPart: 0.25, retired: 0.20 };
    if (status.primary >= 1 && status.spouse >= 1) return tiers.bothFull;
    if ((status.primary > 0 || status.spouse > 0) && (status.primary < 1 || status.spouse < 1)) return tiers.onePart;
    if (status.primary === 0 && status.spouse === 0) return tiers.retired;
    return tiers.onePart;
};

const getIraTaxRate = (amount, baseRate) => {
    if (amount > 600000) return 0.48;
    if (amount > 400000) return 0.40;
    if (amount > 200000) return 0.32;
    return baseRate;
};

const getLtvLimit = (age) => {
    if (age < 70) return 0.40;
    if (age <= 80) return 0.50;
    return 0.60;
};

const getPortfolioReturn = (age, assumptions) => {
    const initial = assumptions.market?.initial || 0.07;
    const terminal = assumptions.market?.terminal || 0.035;
    const taperEnd = assumptions.market?.taperEndAge || 85;
    if (age < 60) return initial;
    if (age >= taperEnd) return terminal;
    const slope = (initial - terminal) / (taperEnd - 60);
    const drop = slope * (age - 60);
    return initial - drop;
};

// --- MAIN SIMULATION ---
export const runFinancialSimulation = (scenario, profiles, registry) => {
    if (!scenario || !scenario.data) return { timeline: [], events: [], reverseMortgageDetails: [] };

    const data = scenario.data;
    const assumptions = data.assumptions || data.globals;
    const startYear = parseInt(assumptions.timing.startYear);
    const startMonth = parseInt(assumptions.timing.startMonth);
    const startDate = new Date(startYear, startMonth - 1, 1);
    const horizonYears = assumptions.horizonYears || assumptions.horizon || 35;
    const totalMonths = horizonYears * 12;

    // --- PRE-CALCULATION ---
    const propertyTrajectories = {};
    const propertyLoanIds = new Set();
    const propertyAssets = Object.values(data.assets.accounts || {}).filter(a => a.type === 'property');
    propertyAssets.forEach(prop => {
        const growth = calculateAssetGrowth(prop, assumptions, data.loans, horizonYears);
        propertyTrajectories[prop.id] = {};
        growth.forEach(pt => { propertyTrajectories[prop.id][pt.year] = pt.value; });
        (prop.inputs?.linkedLoanIds || (prop.inputs?.linkedLoanId ? [prop.inputs.linkedLoanId] : [])).forEach(id => propertyLoanIds.add(id));
        Object.values(data.loans || {}).forEach(l => {
            if (l.propertyLinked && l.linkedPropertyId === prop.id) propertyLoanIds.add(l.id);
        });
    });

    const loanScheduleMap = {};
    Object.values(data.loans || {}).forEach(loan => {
        if (!loan.active) return;
        const stratId = loan.activeStrategyId || 'base';
        const strategy = loan.strategies?.[stratId] || { extraPayments: {} };
        let res;
        if (loan.type === 'revolving') res = calculateRevolvingLoan(loan.inputs, strategy.extraPayments);
        else res = calculateFixedLoan(loan.inputs, strategy.extraPayments);

        loanScheduleMap[loan.id] = {};
        res.schedule.forEach(row => {
            loanScheduleMap[loan.id][row.date] = { payment: row.payment, balance: row.endingBalance };
        });
    });

    // --- INITIAL STATE ---
    const state = {
        cash: 0, joint: 0, inherited: 0, retirement: 0, reverseMortgage: 0,
        components: { cash: { basis: 0, growth: 0 }, joint: { basis: 0, growth: 0 }, inherited: { basis: 0, growth: 0 }, retirement: { basis: 0, growth: 0 } },
        annualFlows: { cash: { deposits: 0, withdrawals: 0, growth: 0 }, joint: { deposits: 0, withdrawals: 0, growth: 0 }, inherited: { deposits: 0, withdrawals: 0, growth: 0 }, retirement: { deposits: 0, withdrawals: 0, growth: 0 } },
        rmActive: false, netWorth: 0, date: startDate,
        insolvencyLogged: false,
        properties: {}, closedLoans: new Set(), activeLoans: new Set(),
        ssLogged: { primary: false, spouse: false }, pensionLogged: { primary: false, spouse: false },
        iraEvents: { depleted: false },
        forcedSaleOccurred: false, postHousingPhase: false
    };

    // Load Initial Balances
    const assets = Object.values(data.assets.accounts || {});
    const retirementAssets = assets.filter(a => a.type === 'retirement');
    const futureAssets = [];
    const accountIndex = {};
    assets.forEach(a => {
        if (!a.active) return;
        accountIndex[a.id] = a.type;
        if (a.type === 'property') {
            const pStart = a.inputs?.startDate ? parseISO(a.inputs.startDate) : startDate;
            if (isAfter(pStart, startDate)) {
                futureAssets.push({ id: a.id, type: 'property', name: a.name, balance: a.balance, inputs: a.inputs, startDateStr: a.inputs.startDate.substring(0, 7), activated: false });
            } else {
                state.properties[a.id] = { active: true, value: a.balance, inputs: a.inputs, name: a.name };
            }
        }
        else if (['cash', 'joint', 'inherited', 'retirement'].includes(a.type)) {
            const aStartStr = a.inputs?.startDate;
            const aStart = aStartStr ? parseISO(aStartStr) : startDate;
            if (isAfter(aStart, startDate)) {
                futureAssets.push({ id: a.id, type: a.type, name: a.name, balance: a.balance, inputs: a.inputs, startDateStr: aStartStr.substring(0, 7), activated: false });
            } else {
                state[a.type] += a.balance;
                state.components[a.type].basis += a.balance;
            }
        }
    });

    // Initialize Debt
    let initialDebt = 0;
    const startMonthKey = format(startDate, 'yyyy-MM');
    // Map loans to property sell month to suppress post-sale payments/extra payments
    const loanSellCutoff = {};
    Object.values(data.assets.accounts || {}).forEach(asset => {
        if (asset.type !== 'property') return;
        const sellKey = asset.inputs?.sellDate ? asset.inputs.sellDate.substring(0, 7) : null;
        if (!sellKey) return;
        (asset.inputs?.linkedLoanIds || []).forEach(id => { loanSellCutoff[id] = sellKey; });
        if (asset.inputs?.linkedLoanId) loanSellCutoff[asset.inputs.linkedLoanId] = sellKey;
    });

    Object.values(data.loans || {}).forEach(l => {
        if(l.active) {
            state.activeLoans.add(l.id);
            const sched = loanScheduleMap[l.id];
            if (sched && sched[startMonthKey]) initialDebt += sched[startMonthKey].balance;
            else initialDebt += (l.inputs.balance || l.inputs.principal);
        }
    });

    const iraAccount = assets.find(a => a.type === 'inherited');
    const iraStartStr = iraAccount?.inputs?.startDate;
    const iraStart = iraStartStr ? parseISO(iraStartStr) : startDate;
    const iraStartYear = isValid(iraStart) ? getYear(iraStart) : startYear;
    const iraFinalWithdrawalYear = iraStartYear + 10;
    const iraSchedule = iraAccount?.inputs?.withdrawalSchedule || {};

    const timeline = [];
    const events = [];
    const rmDetails = [];
    const rmCurrentYear = { draws: 0, interest: 0 };

    const emptyAnnualData = () => ({
        income: 0, expenses: 0, netCashFlow: 0,
        breakdown: {
            income: { employment: 0, socialSecurity: 0, pension: 0 },
            expenses: { bills: 0, homeMortgage: 0, homeImpounds: 0, homeOther: 0, home: 0, living: 0, otherDebt: 0, extra: 0, healthcare: 0 },
            assetFlows: { rmd: 0 }
        }
    });

    let accumulatedYear = emptyAnnualData();

    // --- MAIN MONTHLY LOOP ---
    const syntheticLoans = {};

    const applyFundingList = (list, label, dateStr, taxRate = 0) => {
        (list || []).forEach(f => {
            const srcType = accountIndex[f.sourceId];
            if (!srcType || state[srcType] === undefined) return;
            const amt = f.amount || 0;
            if (amt === 0) return;
            const isTaxable = srcType === 'retirement' || srcType === 'inherited';
            const grossNeeded = isTaxable && taxRate > 0 ? amt / (1 - taxRate) : amt;
            const taxGrossUp = Math.max(0, grossNeeded - amt);
            updateComponents(state, srcType, -grossNeeded);
            state[srcType] -= grossNeeded;
            let note = `${label}: -$${Math.round(grossNeeded).toLocaleString()} from ${f.sourceId}`;
            if (taxGrossUp > 0.01) note += ` (includes ~$${Math.round(taxGrossUp).toLocaleString()} tax gross-up)`;
            events.push({ date: dateStr, text: note });
        });
    };

    const buildPurchaseTotals = (plan) => {
        const costs = plan.costs || {};
        const closing = plan.closing || {};
        const deposits = plan.deposits || {};
        const totalPurchasePrice = (costs.base || 0) + (costs.structural || 0) + (costs.design || 0) + (costs.lot || 0) - (costs.credits || 0);
        const designDepositAmount = (costs.design || 0) * (deposits.designPct || 0);
        const totalDepositsDue = (deposits.contract || 0) + designDepositAmount;
        const feesTotal = (closing.fees || []).reduce((s, i) => s + (i.amount || 0), 0);
        const prepaidsTotal = (closing.prepaids || []).reduce((s, i) => s + (i.amount || 0), 0);
        const buyDownCost = closing.buyDown || 0;
        const lenderCredits = closing.lenderCredits || 0;
        const totalClosingCosts = feesTotal + prepaidsTotal + buyDownCost;
        const netClosingCosts = Math.max(0, totalClosingCosts - lenderCredits);
        const grandTotalRequired = totalPurchasePrice + netClosingCosts;
        const remainingToClose = grandTotalRequired - totalDepositsDue;
        return { totalPurchasePrice, totalDepositsDue, netClosingCosts, remainingToClose, totalClosingCosts };
    };

    for (let i = 0; i < totalMonths; i++) {
        const currentDate = state.date;
        const currentYear = getYear(currentDate);
        const currentMonth = getMonth(currentDate) + 1;
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        const monthKey = format(currentDate, 'yyyy-MM');
        const dt = 1/12;

        if (currentMonth === 1) {
            ['cash', 'joint', 'inherited', 'retirement'].forEach(k => {
                state.annualFlows[k] = { deposits: 0, withdrawals: 0, growth: 0 };
            });
            rmCurrentYear.draws = 0; rmCurrentYear.interest = 0;
            accumulatedYear = emptyAnnualData();
        }

        // Parameters - USE SMART PROFILE RESOLUTION (early so taxRate is available for funding gross-up)
        const incomeProfile = getEffectiveProfile(data.income.profileSequence, dateStr, profiles, data.income);
        const expenseProfile = getEffectiveProfile(data.expenses.profileSequence, dateStr, profiles, data.expenses);

        const workStatus = getWorkStatus(currentYear, incomeProfile, data.income.workStatus);
        const taxRate = getTaxRate(workStatus, assumptions);

        // Inflation
        const inflationRate = assumptions.inflation.general || 0.025;
        const propTaxRate = assumptions.inflation.propertyTax || 0.02;
        const propInsRate = assumptions.inflation.propertyInsurance || inflationRate;
        const elapsedMonths = differenceInMonths(currentDate, startDate);
        const elapsedYears = elapsedMonths / 12;
        const inflationMult = Math.pow(1 + inflationRate, elapsedYears);
        const propTaxMult = Math.pow(1 + propTaxRate, elapsedYears);
        const propInsMult = Math.pow(1 + propInsRate, elapsedYears);

        const primaryAge = currentYear - (data.income.primary.birthYear || 1968);
        const spouseAge = currentYear - (data.income.spouse.birthYear || 1968);

        const monthlyBreakdown = {
            income: { employment: 0, socialSecurity: 0, pension: 0 },
            expenses: { bills: 0, homeMortgage: 0, homeImpounds: 0, homeOther: 0, living: 0, otherDebt: 0, extra: 0, healthcare: 0 },
            assetFlows: { rmd: 0 },
            monthlyBurn: { recurring: 0, home: 0, homeMortgage: 0, homeImpounds: 0, homeOther: 0, healthcare: 0, otherLiabilities: 0, discretionary: 0 },
            waterfall: {
                netCashFlow: 0,
                shortfallStart: 0,
                cashAvailable: 0,
                cashUsed: 0,
                jointGrossUsed: 0,
                jointNetCovered: 0,
                inheritedGrossUsed: 0,
                inheritedNetCovered: 0,
                retirementGrossUsed: 0,
                retirementNetCovered: 0,
                reverseMortgageDraw: 0,
                toCash: 0,
                remainingShortfall: 0
            }
        };

        // --- STEP 1: PROPERTY SALES (Liquidity Event) ---
        // Runs before purchases to ensure cash is available
        Object.keys(state.properties).forEach(pid => {
            const prop = state.properties[pid];
            if (!prop.active) return;
            if (prop.inputs && prop.inputs.sellDate && prop.inputs.sellDate.startsWith(monthKey)) {
                const salePrice = prop.value;
                const costOfSale = salePrice * 0.06;
                let debtPaid = 0;
                const linkedIds = new Set(prop.inputs.linkedLoanIds || (prop.inputs.linkedLoanId ? [prop.inputs.linkedLoanId] : []));
                state.activeLoans.forEach(lid => {
                    const meta = data.loans[lid] || syntheticLoans[lid] || {};
                    if (meta.propertyLinked && meta.linkedPropertyId === pid) linkedIds.add(lid);
                });
                linkedIds.forEach(lid => {
                    if (state.activeLoans.has(lid)) {
                         const sched = loanScheduleMap[lid];
                         const info = sched ? sched[monthKey] : null;
                         const balanceToPay = info ? info.balance : 0;
                         if (balanceToPay > 0) {
                             debtPaid += balanceToPay;
                             state.activeLoans.delete(lid);
                             state.closedLoans.add(lid);
                             const meta = data.loans[lid] || syntheticLoans[lid] || {};
                             events.push({ date: dateStr, text: `Loan Paid Off (Sale): ${meta.name || lid}` });
                         }
                    }
                });
                const netProceeds = Math.max(0, salePrice - costOfSale - debtPaid);

                // Route standard sale proceeds to cash; forced-sale handled separately
                updateComponents(state, 'cash', netProceeds);
                state.cash += netProceeds;

                prop.active = false;
                events.push({ date: dateStr, text: `Sold ${prop.name} for $${Math.round(salePrice/1000)}k. Net: $${Math.round(netProceeds/1000)}k deposited to CASH.` });
            }
        });

        // --- STEP 1.5: CONTRACT EVENTS FOR FUTURE PROPERTIES ---
        futureAssets.forEach((fa, idx) => {
            if (fa.type !== 'property' || fa.activated) return;
            const contractDate = fa.inputs?.purchasePlan?.contractDate;
            if (contractDate && contractDate.startsWith(monthKey)) {
                const plan = fa.inputs.purchasePlan;
                const { totalDepositsDue } = buildPurchaseTotals(plan);
                applyFundingList(plan.depositFunding, 'Construction Deposit', dateStr, taxRate);
                events.push({ date: dateStr, text: `Contract Signed: ${fa.name}. Deposits due $${Math.round(totalDepositsDue).toLocaleString()}` });
            }
        });

        // --- STEP 2: ASSET PURCHASES ---
        futureAssets.forEach((fa, idx) => {
            if (fa.activated) return;
            if (fa.startDateStr === monthKey) {
                if (fa.type === 'property') {
                    state.properties[fa.id] = { active: true, value: fa.balance, inputs: fa.inputs, name: fa.name };
                    events.push({ date: dateStr, text: `Property Purchased: ${fa.name}` });
                    if (fa.inputs && fa.inputs.purchasePlan) {
                        const plan = fa.inputs.purchasePlan;
                        const totals = buildPurchaseTotals(plan);
                        const totalFunding = (plan.funding || []).reduce((s, i) => s + (i.amount || 0), 0);
                        if (plan.autoLoan && (!plan.loan || !plan.loan.amount)) {
                            const inferredLoan = Math.max(0, totals.remainingToClose - totalFunding);
                            if (!plan.loan) plan.loan = {};
                            plan.loan.amount = inferredLoan;
                        }
                        applyFundingList(plan.funding, 'Closing Funding', dateStr, taxRate);

                        const hasLinkedLoans = Array.isArray(fa.inputs?.linkedLoanIds) && fa.inputs.linkedLoanIds.length > 0;
                        if (plan.loan && plan.loan.amount > 0 && !hasLinkedLoans) {
                            const newLoanId = `planloan_${fa.id}`;
                            const startDateStr = fa.inputs.startDate || dateStr;
                            const monthlyRate = (plan.loan.rate || 0) / 12;
                            let pmt = plan.loan.payment || 0;
                            if (!pmt) {
                                const months = plan.loan.term || 360;
                                if (monthlyRate === 0) pmt = plan.loan.amount / months;
                                else {
                                    const r = monthlyRate;
                                    pmt = (plan.loan.amount * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
                                }
                            }
                            const amort = calculateFixedLoan({
                                principal: plan.loan.amount,
                                rate: plan.loan.rate || 0.06,
                                termMonths: plan.loan.term || 360,
                                startDate: startDateStr,
                                payment: pmt
                            }, {});
                            loanScheduleMap[newLoanId] = {};
                            amort.schedule.forEach(row => { loanScheduleMap[newLoanId][row.date] = { payment: row.payment, balance: row.endingBalance }; });
                            state.activeLoans.add(newLoanId);
                            syntheticLoans[newLoanId] = { name: `Auto Loan: ${fa.name}`, type: 'mortgage', inputs: { startDate: startDateStr } };
                            propertyLoanIds.add(newLoanId);
                            events.push({ date: dateStr, text: `Auto Loan Created for ${fa.name}: $${Math.round(plan.loan.amount).toLocaleString()}` });
                        }
                        const fundingGap = Math.max(0, totals.remainingToClose - (plan.loan?.amount || 0) - totalFunding);
                        if (fundingGap > 0) {
                            updateComponents(state, 'cash', -fundingGap);
                            state.cash -= fundingGap;
                            events.push({ date: dateStr, text: `Funding Gap Covered from Cash: $${Math.round(fundingGap).toLocaleString()}` });
                        }
                        events.push({ date: dateStr, text: `Cash to Close: $${Math.round(totals.remainingToClose).toLocaleString()}` });
                    }
                } else {
                    updateComponents(state, fa.type, fa.balance);
                    state[fa.type] += fa.balance;
                    events.push({ date: dateStr, text: `Asset Activated: ${fa.name}` });
                }
                futureAssets[idx].activated = true;
            }
        });

        // --- INCOME (Using Smart Profile) ---
        const primarySalary = ((incomeProfile.primary?.netSalary || 0) * inflationMult) * workStatus.primary;
        const spouseSalary = ((incomeProfile.spouse?.netSalary || 0) * inflationMult) * workStatus.spouse;

        monthlyBreakdown.income.employment = (primarySalary + spouseSalary) * dt;

        if (incomeProfile.primary?.bonus?.month === currentMonth) {
            monthlyBreakdown.income.employment += ((incomeProfile.primary.bonus.amount || 0) * inflationMult) * workStatus.primary;
        }
        if (incomeProfile.spouse?.bonus?.month === currentMonth) {
            monthlyBreakdown.income.employment += ((incomeProfile.spouse.bonus.amount || 0) * inflationMult) * workStatus.spouse;
        }

        const calcSS = (personKey, age, birthMonth, config) => {
            const startAge = config?.startAge || 70;
            if (age < startAge) return 0;
            const monthlyVal = (config?.monthlyAmount || 0) * inflationMult;
            if (age === startAge && currentMonth < (birthMonth || 1)) return 0;
            if (age === startAge && !state.ssLogged[personKey]) {
                events.push({ date: dateStr, text: `${personKey} FICA Started` });
                state.ssLogged[personKey] = true;
            }
            return monthlyVal * (1 - taxRate);
        };
        monthlyBreakdown.income.socialSecurity += calcSS('primary', primaryAge, data.income.primary.birthMonth, incomeProfile.primary?.socialSecurity);
        monthlyBreakdown.income.socialSecurity += calcSS('spouse', spouseAge, data.income.spouse.birthMonth, incomeProfile.spouse?.socialSecurity);

        // Generalized Pension Logic
        const processPension = (personKey, age, status, config) => {
            if (config?.monthlyAmount > 0) {
                if (status === 0 && !state.pensionLogged[personKey]) {
                    state.pensionLogged[personKey] = true;
                    events.push({ date: dateStr, text: `${personKey} Pension Started` });
                }
                if (state.pensionLogged[personKey]) {
                    let pAmount = config.monthlyAmount;
                    if (config.inflationAdjusted) pAmount *= inflationMult;
                    monthlyBreakdown.income.pension += pAmount * (1 - taxRate);
                }
            }
        };
        processPension('primary', primaryAge, workStatus.primary, incomeProfile.primary?.pension);
        processPension('spouse', spouseAge, workStatus.spouse, incomeProfile.spouse?.pension);


        // 401k Contribs
        const primaryGross = (data.income.primary.grossForContrib || 0) * inflationMult;
        const spouseGross = (data.income.spouse.grossForContrib || 0) * inflationMult;
        const primaryContribPct = incomeProfile.primary?.contribPercent ?? data.income.primary.contribPercent ?? 0;
        const spouseContribPct = incomeProfile.spouse?.contribPercent ?? data.income.spouse.contribPercent ?? 0;

        const computeMatchPct = (personId, contribPct, personData) => {
            const defaultEnabled = personId === 'primary';
            const matching = (personData && personData.matching) || {};
            const enabled = matching.enabled !== undefined ? matching.enabled : defaultEnabled;
            if (!enabled) return 0;
            const capPct = matching.capPct !== undefined ? matching.capPct : 0.06;
            const matchRate = matching.matchRate !== undefined ? matching.matchRate : 0.5;
            return Math.min(contribPct, capPct) * matchRate;
        };

        const primaryMatchRate = computeMatchPct('primary', primaryContribPct, data.income.primary);
        const spouseMatchRate = computeMatchPct('spouse', spouseContribPct, data.income.spouse);

        const selectRetirement = (ownerPref) => {
            if (retirementAssets.length === 0) return true;
            return retirementAssets.some(a => {
                if (!a.owner) return true;
                if (ownerPref === 'joint' && a.owner === 'joint') return true;
                if (ownerPref === 'primary' && (a.owner === 'primary' || a.owner === 'joint')) return true;
                if (ownerPref === 'spouse' && (a.owner === 'spouse' || a.owner === 'joint')) return true;
                return false;
            });
        };

        const primaryTargetId = data.income.primary.retirementAccountId;
        const spouseTargetId = data.income.spouse.retirementAccountId;
        const primaryTarget = retirementAssets.find(a => a.id === primaryTargetId);
        const spouseTarget = retirementAssets.find(a => a.id === spouseTargetId);

        const primaryAllowed = primaryTarget ? (primaryTarget.owner === 'primary' || primaryTarget.owner === 'joint' || !primaryTarget.owner) : selectRetirement('primary');
        const spouseAllowed = spouseTarget ? (spouseTarget.owner === 'spouse' || spouseTarget.owner === 'joint' || !spouseTarget.owner) : selectRetirement('spouse');

        const primaryContrib = (primaryGross * workStatus.primary * (primaryContribPct + primaryMatchRate)) * dt;
        const spouseContrib = (spouseGross * workStatus.spouse * (spouseContribPct + spouseMatchRate)) * dt;

        const totalContrib = (primaryAllowed ? primaryContrib : 0) + (spouseAllowed ? spouseContrib : 0);
        if (totalContrib > 0) { updateComponents(state, 'retirement', totalContrib); state.retirement += totalContrib; }

        // --- RMD LOGIC ---
        if (currentMonth === 1 && state.inherited > 0 && currentYear <= iraFinalWithdrawalYear) {
            let pct = (currentYear === iraFinalWithdrawalYear) ? 1.0 : (iraSchedule[currentYear] || 0.20);
            let wAmt = state.inherited * pct;
            if (wAmt > state.inherited) wAmt = state.inherited;

            if (wAmt > 0) {
                updateComponents(state, 'inherited', -wAmt);
                state.inherited -= wAmt;
                const effTax = getIraTaxRate(wAmt, taxRate);
                const net = wAmt * (1 - effTax);
                // RMD proceeds from inherited IRA flow to Joint Investment (not cash)
                updateComponents(state, 'joint', net);
                state.joint += net;
                monthlyBreakdown.assetFlows.rmd += net;

                if (currentYear === iraFinalWithdrawalYear && !state.iraEvents.depleted) {
                    events.push({ date: dateStr, text: "Inherited IRA Final Year: Fully Withdrawn" });
                    state.iraEvents.depleted = true;
                }
            }
        }

        const totalIncome = Object.values(monthlyBreakdown.income).reduce((a, b) => a + b, 0);

        // --- EXPENSES ---
        const activeProperties = Object.values(state.properties || {}).filter(p => p.active);
        const hasActiveProperty = activeProperties.length > 0;
        (expenseProfile.bills || []).forEach(i => monthlyBreakdown.expenses.bills += (i.amount || 0) * inflationMult);
        (expenseProfile.living || []).forEach(i => monthlyBreakdown.expenses.living += (i.amount || 0) * inflationMult);

        let propertyCarryingApplied = false;
        let totalActiveLoanBalance = 0;
        const propertyLoanPaymentRecorded = new Set();
        if (hasActiveProperty) {
            activeProperties.forEach(prop => {
                const propertyStartDate = prop.inputs?.startDate ? parseISO(prop.inputs.startDate) : startDate;
                const propertyElapsedYears = Math.max(0, differenceInMonths(currentDate, propertyStartDate) / 12);
                const propInflationMult = Math.pow(1 + inflationRate, propertyElapsedYears);
                const propTaxInflationMult = Math.pow(1 + propTaxRate, propertyElapsedYears);
                const propInsInflationMult = Math.pow(1 + propInsRate, propertyElapsedYears);
                const costs = prop.inputs?.carryingCosts || {};
                const impounds = costs.impounds || [];
                const other = costs.other || [];
                if (impounds.length > 0 || other.length > 0) propertyCarryingApplied = true;
                impounds.forEach(i => {
                    let m = propInflationMult;
                    const n = (i.name || '').toLowerCase();
                    if (n.includes('tax')) m = propTaxInflationMult;
                    else if (n.includes('insurance')) m = propInsInflationMult;
                    monthlyBreakdown.expenses.homeImpounds += (i.amount || 0) * m;
                });
                other.forEach(i => {
                    monthlyBreakdown.expenses.homeOther += (i.amount || 0) * propInflationMult;
                });

                // Fallback: ensure linked mortgage payments are counted even if not in activeLoans (e.g., scheduling drift)
                const linkedIds = new Set(prop.inputs?.linkedLoanIds || (prop.inputs?.linkedLoanId ? [prop.inputs.linkedLoanId] : []));
                linkedIds.forEach(lid => {
                    const cutoff = loanSellCutoff[lid];
                    if (cutoff && monthKey > cutoff) return;
                    if (propertyLoanPaymentRecorded.has(lid)) return;
                    const sched = loanScheduleMap[lid];
                    const info = sched ? sched[monthKey] : null;
                    if (info && info.payment > 0) {
                        monthlyBreakdown.expenses.homeMortgage += info.payment;
                        propertyLoanPaymentRecorded.add(lid);
                    }
                });
            });
        }

        // Only apply profile home/impounds when there is an active property; if renting/no property, skip these rows.
        if (!propertyCarryingApplied && hasActiveProperty) {
            (expenseProfile.home || []).forEach(i => {
                monthlyBreakdown.expenses.homeOther += (i.amount || 0) * inflationMult;
            });
            (expenseProfile.impounds || []).forEach(i => {
                let m = inflationMult;
                const n = (i.name || '').toLowerCase();
                if (n.includes('property tax')) m = propTaxMult;
                else if (n.includes('insurance')) m = propInsMult;
                monthlyBreakdown.expenses.homeImpounds += (i.amount || 0) * m;
            });
        }

        // Debt Service
        state.activeLoans.forEach(lid => {
            const sched = loanScheduleMap[lid];
            const info = sched ? sched[monthKey] : null;
            const cutoff = loanSellCutoff[lid];
            if (cutoff && monthKey > cutoff) return;
            const meta = data.loans[lid] || syntheticLoans[lid] || {};
            const startKey = meta.inputs?.startDate ? meta.inputs.startDate.substring(0, 7) : null;
            // Skip future-dated loans until their start month; keep them active so they begin later
            if (startKey && monthKey < startKey) return;
            if (info) {
                if (info.payment > 0) {
                    // Global Debt Service (loan payments are fixed; do not inflate)
                    const ltype = meta.type || 'fixed';
                    const isPropertyLoan = meta.propertyLinked === true || !!meta.linkedPropertyId || ltype === 'mortgage' || propertyLoanIds.has(lid);
                    // For reporting: property-linked loan payments land in Home bucket (with impounds/HOA)
                    if (isPropertyLoan && hasActiveProperty) {
                        // Avoid double-counting if the payment was already captured via the property-linked fallback above.
                        if (propertyLoanPaymentRecorded.has(lid)) {
                            totalActiveLoanBalance += info.balance || 0;
                            return;
                        }
                        monthlyBreakdown.expenses.homeMortgage += info.payment;
                        propertyLoanPaymentRecorded.add(lid);
                    } else {
                        monthlyBreakdown.expenses.otherDebt += info.payment;
                    }
                }
                totalActiveLoanBalance += info.balance;

                if (info.balance <= 0.01 && !state.closedLoans.has(lid)) {
                    const meta = data.loans[lid] || syntheticLoans[lid] || {};
                    events.push({ date: dateStr, text: `Liability Paid Off: ${meta.name || lid}` });
                    state.closedLoans.add(lid); state.activeLoans.delete(lid);
                }
            } else {
                // Schedule exhausted: mark loan closed so it no longer contributes
                if (!state.closedLoans.has(lid)) {
                    const meta = data.loans[lid] || syntheticLoans[lid] || {};
                    events.push({ date: dateStr, text: `Liability Completed: ${meta.name || lid}` });
                    state.closedLoans.add(lid); state.activeLoans.delete(lid);
                }
            }
        });

        // Extra Expenses
        (data.expenses.oneOffs || []).forEach(i => {
            if (i.date === monthKey) monthlyBreakdown.expenses.extra += (i.amount || 0) * inflationMult;
        });

        const brackets = data.expenses.retirementBrackets || {};
        let funMoneyAnnual = 0;
        Object.keys(brackets).forEach(k => {
            const startAge = parseInt(k);
            if (primaryAge >= startAge && primaryAge < startAge + 5) funMoneyAnnual = brackets[k];
        });

        const shouldInflateFunMoney = data.expenses.adjustFunMoney !== false;
        if (funMoneyAnnual > 0) {
            const modifier = shouldInflateFunMoney ? inflationMult : 1.0;
            monthlyBreakdown.expenses.extra += (funMoneyAnnual * dt) * modifier;
        }

        // Healthcare: profile-defined + auto insurance after age 65
        const profileHealthcare = expenseProfile.healthcareMonthly ?? expenseProfile.healthcare ?? 0;
        if (profileHealthcare) monthlyBreakdown.expenses.healthcare += profileHealthcare * inflationMult;
        if (primaryAge >= 65) {
            const hcRate = assumptions.healthcareInflationRateAnnual ?? inflationRate;
            const yearsSince65 = Math.max(0, primaryAge - 65);
            const annualBase = 5000 * Math.pow(1 + hcRate, yearsSince65);
            monthlyBreakdown.expenses.healthcare += (annualBase / 12);
        }

        // Monthly burn aggregation (single-month view consumers)
        const homeTotal = monthlyBreakdown.expenses.homeMortgage + monthlyBreakdown.expenses.homeImpounds + monthlyBreakdown.expenses.homeOther;
        monthlyBreakdown.expenses.home = homeTotal;

        monthlyBreakdown.monthlyBurn.recurring = monthlyBreakdown.expenses.bills + monthlyBreakdown.expenses.living;
        monthlyBreakdown.monthlyBurn.home = homeTotal;
        monthlyBreakdown.monthlyBurn.homeMortgage = monthlyBreakdown.expenses.homeMortgage;
        monthlyBreakdown.monthlyBurn.homeImpounds = monthlyBreakdown.expenses.homeImpounds;
        monthlyBreakdown.monthlyBurn.homeOther = monthlyBreakdown.expenses.homeOther;
        monthlyBreakdown.monthlyBurn.healthcare = monthlyBreakdown.expenses.healthcare;
        monthlyBreakdown.monthlyBurn.otherLiabilities = monthlyBreakdown.expenses.otherDebt;
        monthlyBreakdown.monthlyBurn.discretionary = monthlyBreakdown.expenses.extra;

        const totalExpenses =
            monthlyBreakdown.expenses.bills +
            monthlyBreakdown.expenses.living +
            monthlyBreakdown.expenses.otherDebt +
            monthlyBreakdown.expenses.extra +
            monthlyBreakdown.expenses.healthcare +
            homeTotal;

        // --- WATERFALL ---
        let netCashFlow = totalIncome - totalExpenses;
        let shortfall = 0;
        monthlyBreakdown.waterfall.netCashFlow = netCashFlow;

        if (netCashFlow >= 0) {
            // Surplus logic: All surplus to Cash
            updateComponents(state, 'cash', netCashFlow);
            state.cash += netCashFlow;
            monthlyBreakdown.waterfall.toCash = netCashFlow;
        } else {
            let needed = Math.abs(netCashFlow);
            const cashMin = assumptions.thresholds?.cashMin || 15000;
            monthlyBreakdown.waterfall.shortfallStart = needed;

            const availCash = Math.max(0, state.cash - cashMin);
            monthlyBreakdown.waterfall.cashAvailable = availCash;
            if (availCash >= needed) { updateComponents(state, 'cash', -needed); state.cash -= needed; monthlyBreakdown.waterfall.cashUsed = needed; needed = 0; }
            else { updateComponents(state, 'cash', -availCash); state.cash -= availCash; monthlyBreakdown.waterfall.cashUsed = availCash; needed -= availCash; }

            if (needed > 0 && state.joint > 0) {
                const jointMin = assumptions.thresholds?.jointMin || 0;
                const availJoint = Math.max(0, state.joint - jointMin);
                const effTax = taxRate * 0.5;
                const grossNeeded = needed / (1 - effTax);
                if (availJoint >= grossNeeded) { updateComponents(state, 'joint', -grossNeeded); state.joint -= grossNeeded; monthlyBreakdown.waterfall.jointGrossUsed += grossNeeded; monthlyBreakdown.waterfall.jointNetCovered += needed; needed = 0; }
                else { const net = availJoint * (1 - effTax); updateComponents(state, 'joint', -availJoint); state.joint = 0; monthlyBreakdown.waterfall.jointGrossUsed += availJoint; monthlyBreakdown.waterfall.jointNetCovered += net; needed -= net; }
            }

            if (needed > 0 && state.inherited > 0) {
                const grossNeeded = needed / (1 - taxRate);
                const withdrawal = Math.min(state.inherited, grossNeeded);
                const net = withdrawal * (1 - taxRate);
                updateComponents(state, 'inherited', -withdrawal);
                state.inherited -= withdrawal;
                const cashCovered = Math.min(net, needed);
                if (cashCovered > 0) {
                    updateComponents(state, 'cash', cashCovered);
                    state.cash += cashCovered;
                    monthlyBreakdown.waterfall.inheritedGrossUsed += withdrawal;
                    monthlyBreakdown.waterfall.inheritedNetCovered += cashCovered;
                    needed -= cashCovered;
                }
                // Any excess net flows to cash buffer per ad-hoc rule
                if (net > cashCovered) {
                    updateComponents(state, 'cash', net - cashCovered);
                    state.cash += (net - cashCovered);
                }
                if (state.inherited <= 0.0001 && !state.iraEvents.depleted) { events.push({ date: dateStr, text: "Inherited IRA Depleted (Deficit)" }); state.iraEvents.depleted = true; }
            }

            if (needed > 0 && state.retirement > 0) {
                const retMin = assumptions.thresholds?.retirementMin || 300000;
                const floor = state.postHousingPhase ? 0 : retMin;
                const availRet = Math.max(0, state.retirement - floor);
                if (availRet > 0) {
                    const grossNeeded = needed / (1 - taxRate);
                    if (availRet >= grossNeeded) { updateComponents(state, 'retirement', -grossNeeded); state.retirement -= grossNeeded; monthlyBreakdown.waterfall.retirementGrossUsed += grossNeeded; monthlyBreakdown.waterfall.retirementNetCovered += needed; needed = 0; }
                    else { const net = availRet * (1 - taxRate); updateComponents(state, 'retirement', -availRet); state.retirement -= availRet; monthlyBreakdown.waterfall.retirementGrossUsed += availRet; monthlyBreakdown.waterfall.retirementNetCovered += net; needed -= net; }
                }
            }

            if (needed > 0) {
                const hasProp = Object.values(state.properties).some(p => p.active);
                if (!state.rmActive && hasProp && !state.postHousingPhase) {
                    state.rmActive = true;
                    state.activeLoans.forEach(lid => {
                        const l = data.loans[lid];
                        if (l && l.type === 'mortgage') {
                             state.closedLoans.add(lid); state.activeLoans.delete(lid);
                             events.push({ date: dateStr, text: `Mortgage Paid Off by Reverse Mortgage: ${l.name}` });
                        }
                    });
                    events.push({ date: dateStr, text: "Reverse Mortgage Activated" });
                }
                if (state.rmActive && !state.postHousingPhase) {
                    state.reverseMortgage += needed;
                    rmCurrentYear.draws += needed;
                    monthlyBreakdown.waterfall.reverseMortgageDraw += needed;
                    needed = 0;
                }
            }
            if (needed > 0) shortfall = needed;
            monthlyBreakdown.waterfall.remainingShortfall = needed;
        }

        // --- GROWTH & RM INTEREST ---
        applyGrowth(dt, primaryAge, assumptions, state);
        if (state.reverseMortgage > 0) {
            const rmRate = assumptions.rates?.reverseMortgage || 0.065;
            const interest = state.reverseMortgage * (rmRate * dt);
            state.reverseMortgage += interest;
            rmCurrentYear.interest += interest;
        }

        // --- PROPERTY VALUATION UPDATE ---
        let currentPropVal = 0;
        Object.keys(propertyTrajectories).forEach(pid => {
            if (state.properties[pid]?.active) {
                state.properties[pid].value = propertyTrajectories[pid][currentYear] || 0;
                currentPropVal += state.properties[pid].value;
            }
        });

        // --- FORCED SALE (LTV TRIGGER) ---
        if (state.rmActive && currentPropVal > 0) {
             const ltv = state.reverseMortgage / currentPropVal;
             const limit = getLtvLimit(primaryAge);
             if (ltv >= limit) {
                 const netEquity = (currentPropVal * 0.94) - (state.reverseMortgage + totalActiveLoanBalance);
                 const deposit = Math.max(0, netEquity);
                 // Spec: forced-sale proceeds go to Joint Investment (not cash)
                 state.joint += deposit;
                 updateComponents(state, 'joint', deposit);
                 state.reverseMortgage = 0;
                 state.rmActive = false;
                 state.activeLoans.clear();
                 state.postHousingPhase = true;
                 events.push({ date: dateStr, text: "Forced Sale (LTV Limit Hit)" });
                 Object.keys(state.properties).forEach(pid => state.properties[pid].active = false);
                 currentPropVal = 0;
                 totalActiveLoanBalance = 0;
             }
        }

        // --- ACCUMULATE ---
        accumulatedYear.income += totalIncome;
        accumulatedYear.expenses += totalExpenses;
        accumulatedYear.netCashFlow += netCashFlow;
        Object.keys(monthlyBreakdown.income).forEach(k => accumulatedYear.breakdown.income[k] += monthlyBreakdown.income[k]);
        ['bills', 'homeMortgage', 'homeImpounds', 'homeOther', 'living', 'otherDebt', 'extra', 'healthcare'].forEach(k => {
            accumulatedYear.breakdown.expenses[k] = (accumulatedYear.breakdown.expenses[k] || 0) + (monthlyBreakdown.expenses[k] || 0);
        });
        accumulatedYear.breakdown.expenses.home += homeTotal;
        accumulatedYear.breakdown.assetFlows.rmd += monthlyBreakdown.assetFlows.rmd;

        state.netWorth = (state.cash + state.joint + state.inherited + state.retirement + currentPropVal) - (state.reverseMortgage + totalActiveLoanBalance);

        timeline.push({
            year: currentYear, month: currentMonth, date: dateStr, age: primaryAge, spouseAge: spouseAge,
            income: totalIncome, expenses: totalExpenses, netCashFlow,
            breakdown: monthlyBreakdown,
            monthlyBurn: monthlyBreakdown.monthlyBurn,
            annualData: JSON.parse(JSON.stringify(accumulatedYear)),
            balances: { ...state, property: currentPropVal, liquid: state.cash + state.joint, totalDebt: totalActiveLoanBalance },
            components: JSON.parse(JSON.stringify(state.components)),
            flows: JSON.parse(JSON.stringify(state.annualFlows)),
            netWorth: state.netWorth, shortfall
        });

        state.date = addMonths(state.date, 1);
    }

    return { timeline, events, reverseMortgageDetails: rmDetails };
};

const updateComponents = (state, type, amount) => {
    if (!state.components[type]) return;
    if (amount > 0) { state.components[type].basis += amount; state.annualFlows[type].deposits += amount; }
    else {
        const abs = Math.abs(amount);
        state.annualFlows[type].withdrawals += abs;
        const bal = state[type];
        if (bal <= 0.01) { state.components[type].basis = 0; state.components[type].growth = 0; }
        else {
            const r = abs / bal;
            state.components[type].basis -= state.components[type].basis * r;
            state.components[type].growth -= state.components[type].growth * r;
        }
    }
};

const applyGrowth = (dt, age, assumptions, state) => {
    const cashRate = assumptions?.rates?.cash ?? 0.02; // default 2% for HYSA
    const grow = (type, rate) => {
        const amt = state[type] * rate;
        if (amt > 0) { state.components[type].growth += amt; state.annualFlows[type].growth += amt; state[type] += amt; }
    };
    grow('cash', cashRate * dt);
    const r = getPortfolioReturn(age, assumptions) * dt;
    grow('joint', r); grow('inherited', r); grow('retirement', r);
};
