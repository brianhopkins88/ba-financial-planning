import { addMonths, getYear, getMonth, format, isAfter, parseISO, isValid, differenceInMonths } from 'date-fns';
import { calculateRevolvingLoan, calculateFixedLoan } from './loan_math';
import { calculateAssetGrowth } from './asset_math';

// --- HELPERS ---

const getProfileForDate = (sequence, dateStr, profiles) => {
    if (!sequence || !profiles) return null;
    const activeItems = sequence.filter(item => item.isActive);
    const candidates = activeItems.filter(item => item.startDate <= dateStr);
    candidates.sort((a, b) => b.startDate.localeCompare(a.startDate));
    const match = candidates[0];
    return match ? (profiles[match.profileId]?.data || null) : null;
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
export const runFinancialSimulation = (scenario, profiles) => {
    if (!scenario || !scenario.data) return { timeline: [], events: [], reverseMortgageDetails: [] };

    const data = scenario.data;
    const assumptions = data.assumptions || data.globals;
    const startYear = parseInt(assumptions.timing.startYear);
    const startMonth = parseInt(assumptions.timing.startMonth);
    const startDate = new Date(startYear, startMonth - 1, 1);
    const horizonYears = 35;
    const totalMonths = horizonYears * 12;

    // --- PRE-CALCULATION ---
    const propertyTrajectories = {};
    const propertyAssets = Object.values(data.assets.accounts || {}).filter(a => a.type === 'property');
    propertyAssets.forEach(prop => {
        const growth = calculateAssetGrowth(prop, assumptions, data.loans, horizonYears);
        propertyTrajectories[prop.id] = {};
        growth.forEach(pt => { propertyTrajectories[prop.id][pt.year] = pt.value; });
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
    const futureAssets = [];
    assets.forEach(a => {
        if (!a.active) return;
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
            expenses: { bills: 0, impounds: 0, home: 0, living: 0, otherDebt: 0, extra: 0 },
            assetFlows: { rmd: 0 }
        }
    });

    let accumulatedYear = emptyAnnualData();

    // --- MAIN MONTHLY LOOP ---
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

        // --- PROPERTY TRANSACTIONS ---
        futureAssets.forEach((fa, idx) => {
            if (fa.activated) return;
            if (fa.startDateStr === monthKey) {
                if (fa.type === 'property') {
                    state.properties[fa.id] = { active: true, value: fa.balance, inputs: fa.inputs, name: fa.name };
                    events.push({ date: dateStr, text: `Property Purchased: ${fa.name}` });
                    if (fa.inputs && fa.inputs.purchasePlan && fa.inputs.purchasePlan.funding) {
                        fa.inputs.purchasePlan.funding.forEach(fund => {
                            if (fund.amount > 0 && fund.sourceId) {
                                const sourceAcct = assets.find(a => a.id === fund.sourceId);
                                if (sourceAcct && state[sourceAcct.type] !== undefined) {
                                    updateComponents(state, sourceAcct.type, -fund.amount);
                                    state[sourceAcct.type] -= fund.amount;
                                    events.push({ date: dateStr, text: `Purchase Funding: -$${Math.round(fund.amount).toLocaleString()} from ${sourceAcct.name}` });
                                }
                            }
                        });
                    }
                } else {
                    updateComponents(state, fa.type, fa.balance);
                    state[fa.type] += fa.balance;
                    events.push({ date: dateStr, text: `Asset Activated: ${fa.name}` });
                }
                futureAssets[idx].activated = true;
            }
        });

        Object.keys(state.properties).forEach(pid => {
            const prop = state.properties[pid];
            if (!prop.active) return;
            if (prop.inputs && prop.inputs.sellDate && prop.inputs.sellDate.startsWith(monthKey)) {
                const salePrice = prop.value;
                const costOfSale = salePrice * 0.06;
                let debtPaid = 0;
                const linkedIds = prop.inputs.linkedLoanIds || (prop.inputs.linkedLoanId ? [prop.inputs.linkedLoanId] : []);
                linkedIds.forEach(lid => {
                    if (state.activeLoans.has(lid)) {
                         const sched = loanScheduleMap[lid];
                         const info = sched ? sched[monthKey] : null;
                         const balanceToPay = info ? info.balance : 0;
                         if (balanceToPay > 0) {
                             debtPaid += balanceToPay;
                             state.activeLoans.delete(lid);
                             state.closedLoans.add(lid);
                             events.push({ date: dateStr, text: `Loan Paid Off (Sale): ${data.loans[lid]?.name || lid}` });
                         }
                    }
                });
                const netProceeds = Math.max(0, salePrice - costOfSale - debtPaid);
                updateComponents(state, 'joint', netProceeds);
                state.joint += netProceeds;
                prop.active = false;
                events.push({ date: dateStr, text: `Sold ${prop.name} for $${Math.round(salePrice/1000)}k. Net: $${Math.round(netProceeds/1000)}k` });
            }
        });

        // Parameters
        const incomeProfile = getProfileForDate(data.income.profileSequence, dateStr, profiles) || data.income;
        const expenseProfile = getProfileForDate(data.expenses.profileSequence, dateStr, profiles) || data.expenses;
        const workStatus = getWorkStatus(currentYear, incomeProfile, data.income.workStatus);
        const taxRate = getTaxRate(workStatus, assumptions);

        // Inflation
        const inflationRate = assumptions.inflation.general || 0.025;
        const elapsedMonths = differenceInMonths(currentDate, startDate);
        const elapsedYears = elapsedMonths / 12;
        const inflationMult = Math.pow(1 + inflationRate, elapsedYears);
        const propTaxMult = Math.pow(1 + (assumptions.inflation.propertyTax || 0.02), elapsedYears);
        const propInsMult = Math.pow(1 + (assumptions.inflation.propertyInsurance || inflationRate), elapsedYears);

        const primaryAge = currentYear - (data.income.primary.birthYear || 1968);
        const spouseAge = currentYear - (data.income.spouse.birthYear || 1968);

        const monthlyBreakdown = {
            income: { employment: 0, socialSecurity: 0, pension: 0 },
            expenses: { bills: 0, impounds: 0, home: 0, living: 0, otherDebt: 0, extra: 0 },
            assetFlows: { rmd: 0 }
        };

        // --- INCOME ---
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
        const primaryMatchRate = Math.min(primaryContribPct, 0.06) * 0.5;
        const totalContrib = ((primaryGross * workStatus.primary * (primaryContribPct + primaryMatchRate)) + (spouseGross * workStatus.spouse * spouseContribPct)) * dt;
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
                updateComponents(state, 'cash', net);
                state.cash += net;
                monthlyBreakdown.assetFlows.rmd += net;

                if (currentYear === iraFinalWithdrawalYear && !state.iraEvents.depleted) {
                    events.push({ date: dateStr, text: "Inherited IRA Final Year: Fully Withdrawn" });
                    state.iraEvents.depleted = true;
                }
            }
        }

        const totalIncome = Object.values(monthlyBreakdown.income).reduce((a, b) => a + b, 0);

        // --- EXPENSES ---
        (expenseProfile.bills || []).forEach(i => monthlyBreakdown.expenses.bills += (i.amount || 0) * inflationMult);
        (expenseProfile.home || []).forEach(i => monthlyBreakdown.expenses.home += (i.amount || 0) * inflationMult);
        (expenseProfile.living || []).forEach(i => monthlyBreakdown.expenses.living += (i.amount || 0) * inflationMult);

        (expenseProfile.impounds || []).forEach(i => {
            let m = inflationMult;
            const n = i.name.toLowerCase();
            if (n.includes('property tax')) m = propTaxMult;
            else if (n.includes('insurance')) m = propInsMult;
            monthlyBreakdown.expenses.impounds += (i.amount || 0) * m;
        });

        // Debt Service
        let totalActiveLoanBalance = 0;
        state.activeLoans.forEach(lid => {
            const sched = loanScheduleMap[lid];
            const info = sched ? sched[monthKey] : null;
            if (info) {
                 if (info.payment > 0) {
                    const isLinked = !expenseProfile.linkedLoanIds || expenseProfile.linkedLoanIds.includes(lid);
                    if (isLinked) {
                        if (data.loans[lid].type === 'mortgage') monthlyBreakdown.expenses.impounds += info.payment;
                        else monthlyBreakdown.expenses.otherDebt += info.payment;
                    }
                 }
                 totalActiveLoanBalance += info.balance;

                 if (info.balance <= 0.01 && !state.closedLoans.has(lid)) {
                    events.push({ date: dateStr, text: `Liability Paid Off: ${data.loans[lid].name}` });
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

        // --- CHECK INFLATION TOGGLE FOR FUN MONEY ---
        // Default to TRUE if undefined (safe default), check explicit false
        const shouldInflateFunMoney = data.expenses.adjustFunMoney !== false;

        if (funMoneyAnnual > 0) {
            const modifier = shouldInflateFunMoney ? inflationMult : 1.0;
            monthlyBreakdown.expenses.extra += (funMoneyAnnual * dt) * modifier;
        }

        const totalExpenses = Object.values(monthlyBreakdown.expenses).reduce((a, b) => a + b, 0);

        // --- WATERFALL ---
        let netCashFlow = totalIncome - totalExpenses;
        let shortfall = 0;

        if (netCashFlow >= 0) {
            const cashMax = assumptions.thresholds?.cashMax || 30000;
            const cashRoom = cashMax - state.cash;
            if (netCashFlow <= cashRoom) { updateComponents(state, 'cash', netCashFlow); state.cash += netCashFlow; }
            else {
                updateComponents(state, 'cash', cashRoom); state.cash += cashRoom;
                updateComponents(state, 'joint', netCashFlow - cashRoom); state.joint += (netCashFlow - cashRoom);
            }
        } else {
            let needed = Math.abs(netCashFlow);
            const cashMin = assumptions.thresholds?.cashMin || 15000;

            const availCash = Math.max(0, state.cash - cashMin);
            if (availCash >= needed) { updateComponents(state, 'cash', -needed); state.cash -= needed; needed = 0; }
            else { updateComponents(state, 'cash', -availCash); state.cash -= availCash; needed -= availCash; }

            if (needed > 0 && state.joint > 0) {
                const jointMin = assumptions.thresholds?.jointMin || 0;
                const availJoint = Math.max(0, state.joint - jointMin);
                const effTax = taxRate * 0.5;
                const grossNeeded = needed / (1 - effTax);
                if (availJoint >= grossNeeded) { updateComponents(state, 'joint', -grossNeeded); state.joint -= grossNeeded; needed = 0; }
                else { const net = availJoint * (1 - effTax); updateComponents(state, 'joint', -availJoint); state.joint = 0; needed -= net; }
            }

            if (needed > 0 && state.inherited > 0) {
                const grossNeeded = needed / (1 - taxRate);
                if (state.inherited >= grossNeeded) { updateComponents(state, 'inherited', -grossNeeded); state.inherited -= grossNeeded; needed = 0; }
                else {
                    const net = state.inherited * (1 - taxRate);
                    updateComponents(state, 'inherited', -state.inherited); state.inherited = 0; needed -= net;
                    if (!state.iraEvents.depleted) { events.push({ date: dateStr, text: "Inherited IRA Depleted (Deficit)" }); state.iraEvents.depleted = true; }
                }
            }

            if (needed > 0 && state.retirement > 0) {
                const retMin = assumptions.thresholds?.retirementMin || 300000;
                const floor = state.postHousingPhase ? 0 : retMin;
                const availRet = Math.max(0, state.retirement - floor);
                if (availRet > 0) {
                    const grossNeeded = needed / (1 - taxRate);
                    if (availRet >= grossNeeded) { updateComponents(state, 'retirement', -grossNeeded); state.retirement -= grossNeeded; needed = 0; }
                    else { const net = availRet * (1 - taxRate); updateComponents(state, 'retirement', -availRet); state.retirement -= availRet; needed -= net; }
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
                    needed = 0;
                }
            }
            if (needed > 0) shortfall = needed;
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
                 state.cash += Math.max(0, netEquity);
                 updateComponents(state, 'cash', Math.max(0, netEquity));
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
        Object.keys(monthlyBreakdown.expenses).forEach(k => accumulatedYear.breakdown.expenses[k] += monthlyBreakdown.expenses[k]);
        accumulatedYear.breakdown.assetFlows.rmd += monthlyBreakdown.assetFlows.rmd;

        state.netWorth = (state.cash + state.joint + state.inherited + state.retirement + currentPropVal) - (state.reverseMortgage + totalActiveLoanBalance);

        timeline.push({
            year: currentYear, month: currentMonth, date: dateStr, age: primaryAge, spouseAge: spouseAge,
            income: totalIncome, expenses: totalExpenses, netCashFlow,
            breakdown: monthlyBreakdown,
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
    const grow = (type, rate) => {
        const amt = state[type] * rate;
        if (amt > 0) { state.components[type].growth += amt; state.annualFlows[type].growth += amt; state[type] += amt; }
    };
    grow('cash', 0.01 * dt);
    const r = getPortfolioReturn(age, assumptions) * dt;
    grow('joint', r); grow('inherited', r); grow('retirement', r);
};