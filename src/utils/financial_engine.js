import { addMonths, addYears, getYear, getMonth, format, isBefore, isAfter, parseISO, startOfMonth } from 'date-fns';
import { calculateRevolvingLoan, calculateFixedLoan } from './loan_math';
import { calculateAssetGrowth } from './asset_math';

// --- HELPERS ---
const getTaxRate = (year, workStatus, assumptions) => {
    const status = workStatus[year] || { brian: 0, andrea: 0 };
    const tiers = assumptions.taxTiers || { bothFull: 0.32, onePart: 0.27, bothPart: 0.25, retired: 0.20 };
    if (status.brian >= 1 && status.andrea >= 1) return tiers.bothFull;
    if ((status.brian > 0 || status.andrea > 0) && (status.brian < 1 || status.andrea < 1)) return tiers.onePart;
    if (status.brian === 0 && status.andrea === 0) return tiers.retired;
    return tiers.onePart;
};

const getIraTaxRate = (amount, baseRate) => {
    if (amount > 600000) return 0.48;
    if (amount > 400000) return 0.40;
    if (amount > 200000) return 0.32;
    return baseRate;
};

const getActiveProfile = (sequence, dateStr, profiles) => {
    if (!sequence || !profiles) return null;
    const activeItem = sequence
        .filter(item => item.isActive && item.startDate <= dateStr)
        .sort((a, b) => a.startDate.localeCompare(b.startDate))
        .pop();
    return activeItem ? (profiles[activeItem.profileId]?.data || null) : null;
};

const getLtvLimit = (age) => {
    if (age < 70) return 0.40;
    if (age <= 80) return 0.50;
    return 0.60;
};

const getPortfolioReturn = (age, assumptions) => {
    const initial = assumptions.market?.initial || 0.07;
    const terminal = assumptions.market?.terminal || 0.035;
    const taperEnd = assumptions.market?.taperEndAge || 80;
    if (age < 60) return initial;
    if (age >= taperEnd) return terminal;
    const slope = (initial - terminal) / (taperEnd - 60);
    const drop = slope * (age - 60);
    return initial - drop;
};

// --- MAIN SIMULATION ---
export const runFinancialSimulation = (scenario, profiles) => {
    if (!scenario || !scenario.data) return { timeline: [], events: [] };

    const data = scenario.data;
    const assumptions = data.assumptions || data.globals;
    const startYear = assumptions.timing.startYear;
    const startMonth = assumptions.timing.startMonth;
    const startDate = new Date(startYear, startMonth - 1, 1);
    const horizonYears = 35;

    // --- 0. PRE-CALCULATION ---
    const propertyTrajectories = {};
    const propertyAssets = Object.values(data.assets.accounts || {}).filter(a => a.type === 'property');
    propertyAssets.forEach(prop => {
        const growth = calculateAssetGrowth(prop, assumptions, data.loans, horizonYears);
        propertyTrajectories[prop.id] = {};
        growth.forEach(pt => { propertyTrajectories[prop.id][pt.year] = pt.value; });
    });

    const loanBalances = {};
    Object.values(data.loans || {}).forEach(loan => {
        if (!loan.active) return;
        const stratId = loan.activeStrategyId || 'base';
        const strategy = loan.strategies?.[stratId] || { extraPayments: {} };
        let res;
        if (loan.type === 'revolving') res = calculateRevolvingLoan(loan.inputs, strategy.extraPayments);
        else res = calculateFixedLoan(loan.inputs, strategy.extraPayments);
        loanBalances[loan.id] = {};
        res.schedule.forEach(row => { loanBalances[loan.id][row.date] = row.endingBalance; });
    });

    let andreaPensionStartYear = 9999;
    const sortedWorkYears = Object.keys(data.income.workStatus || {}).map(Number).sort((a,b)=>a-b);
    for(const y of sortedWorkYears) {
        if (data.income.workStatus[y]?.andrea === 0) {
            andreaPensionStartYear = y;
            break;
        }
    }

    // --- 1. INITIALIZE STATE ---
    const state = {
        cash: 0, joint: 0, inherited: 0, retirement: 0, reverseMortgage: 0,
        // Component Tracking (Basis vs Growth) - Lifetime
        components: {
            cash: { basis: 0, growth: 0 },
            joint: { basis: 0, growth: 0 },
            inherited: { basis: 0, growth: 0 },
            retirement: { basis: 0, growth: 0 }
        },
        // Annual Flow Tracking (Reset yearly)
        annualFlows: {
            cash: { deposits: 0, withdrawals: 0, growth: 0 },
            joint: { deposits: 0, withdrawals: 0, growth: 0 },
            inherited: { deposits: 0, withdrawals: 0, growth: 0 },
            retirement: { deposits: 0, withdrawals: 0, growth: 0 }
        },
        rmActive: false, netWorth: 0, date: startDate,
        insolvencyLogged: false,
        properties: {},
        closedLoans: new Set(),
        ssLogged: { brian: false, andrea: false },
        pensionLogged: { andrea: false },
        iraEvents: {}
    };

    // Helper to manage components and flows
    const updateComponents = (type, amount, isGrowth = false) => {
        if (!state.components[type]) return;

        const comp = state.components[type];
        const flow = state.annualFlows[type];
        const balance = state[type];

        if (amount > 0) {
            // Deposit / Growth
            if (isGrowth) {
                comp.growth += amount;
                flow.growth += amount;
            } else {
                comp.basis += amount;
                flow.deposits += amount;
            }
        } else {
            // Withdrawal (reduce proportionally for Basis/Growth tracking)
            const absAmt = Math.abs(amount);

            // Log Flow (Store as positive magnitude here, negate in UI)
            flow.withdrawals += absAmt;

            if (balance <= 0.01) {
                comp.basis = 0;
                comp.growth = 0;
                return;
            }
            const ratio = absAmt / balance;
            const safeRatio = Math.min(ratio, 1.0);

            comp.basis -= comp.basis * safeRatio;
            comp.growth -= comp.growth * safeRatio;
        }
    };

    const assets = Object.values(data.assets.accounts || {});
    assets.forEach(a => {
        if (!a.active) return;
        if (['cash', 'joint', 'inherited', 'retirement'].includes(a.type)) {
            state[a.type] += a.balance;
            state.components[a.type].basis += a.balance;
        }
        if (a.type === 'property') {
            const pStart = a.inputs?.startDate ? parseISO(a.inputs.startDate) : startDate;
            if (!isAfter(pStart, startDate)) state.properties[a.id] = { active: true, value: a.balance };
            else state.properties[a.id] = { active: false, value: 0 };
        }
    });

    const iraAccount = assets.find(a => a.type === 'inherited');
    const iraStart = iraAccount?.inputs?.startDate ? parseISO(iraAccount.inputs.startDate) : startDate;
    const iraStartYear = getYear(iraStart);
    const cutoffDate = new Date(iraStartYear, 0, 15);
    const iraFirstWithdrawalYear = isAfter(iraStart, cutoffDate) ? iraStartYear + 1 : iraStartYear;
    const iraFinalWithdrawalYear = iraFirstWithdrawalYear + 9;
    const iraSchedule = iraAccount?.inputs?.withdrawalSchedule || Array(10).fill(0.10);

    const timeline = [];
    const events = [];

    const steps = [];
    for (let i = 0; i < 60; i++) steps.push({ type: 'month', index: i });
    for (let i = 1; i <= 30; i++) steps.push({ type: 'year', index: i });

    // --- 3. LOOP ---
    steps.forEach(step => {
        const isMonthly = step.type === 'month';
        const currentDate = state.date;
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        const monthKey = format(currentDate, 'yyyy-MM');
        const year = getYear(currentDate);
        const monthIndex = getMonth(currentDate) + 1;
        const dt = isMonthly ? 1 / 12 : 1.0;

        // Reset Annual Flows in January
        if (monthIndex === 1) {
            ['cash', 'joint', 'inherited', 'retirement'].forEach(k => {
                state.annualFlows[k] = { deposits: 0, withdrawals: 0, growth: 0 };
            });
        }

        const brianBirthYear = data.income.brian.birthYear || 1966;
        const andreaBirthYear = data.income.andrea.birthYear || 1965;
        const brianAge = year - brianBirthYear;
        const andreaAge = year - andreaBirthYear;

        const inflationRate = assumptions.inflation.general || 0.025;
        const yearsElapsed = step.type === 'month' ? step.index / 12 : (5 + step.index);
        const inflationMult = Math.pow(1 + inflationRate, yearsElapsed);

        const taxRate = getTaxRate(year, data.income.workStatus || {}, assumptions);

        // --- INHERITED IRA MANDATORY EVENTS ---
        if (state.inherited > 0) {
            let mandatoryWithdrawal = 0;
            const isJanuary = monthIndex === 1;

            if (isJanuary && year >= iraFirstWithdrawalYear && year <= iraFinalWithdrawalYear) {
                const idx = year - iraFirstWithdrawalYear;
                let pct = iraSchedule[idx] !== undefined ? iraSchedule[idx] : 0.1;
                if (year === iraFinalWithdrawalYear) {
                    pct = 1.0;
                    if (!state.iraEvents.depleted) {
                        events.push({ date: dateStr, text: "Inherited IRA Final Year: Fully Withdrawn" });
                        state.iraEvents.depleted = true;
                    }
                }
                mandatoryWithdrawal = state.inherited * pct;
            }

            if (mandatoryWithdrawal > 0) {
                if (mandatoryWithdrawal > state.inherited) mandatoryWithdrawal = state.inherited;

                updateComponents('inherited', -mandatoryWithdrawal);
                state.inherited -= mandatoryWithdrawal;

                const effectiveTaxRate = getIraTaxRate(mandatoryWithdrawal, taxRate);
                const netProceeds = mandatoryWithdrawal * (1 - effectiveTaxRate);

                updateComponents('joint', netProceeds);
                state.joint += netProceeds;
            }
        }

        // --- PROPERTY LOGIC ---
        let totalActivePropValue = 0;
        Object.keys(propertyTrajectories).forEach(pId => {
             if (!state.properties[pId]?.active) {
                const prop = propertyAssets.find(p=>p.id===pId);
                const startStr = prop.inputs?.startDate ? prop.inputs.startDate.slice(0, 7) : '9999-99';
                if (startStr === monthKey) {
                    state.properties[pId] = { active: true, value: 0 };
                    events.push({ date: dateStr, text: `Purchased Property: ${prop.name}` });
                    if (prop.inputs.purchasePlan?.funding) {
                        prop.inputs.purchasePlan.funding.forEach(fund => {
                            if (!fund.amount || !fund.sourceId) return;
                            const amt = fund.amount;
                            const sourceAcct = data.assets.accounts[fund.sourceId];
                            if (sourceAcct && ['cash','joint','inherited','retirement'].includes(sourceAcct.type)) {
                                updateComponents(sourceAcct.type, -amt);
                                state[sourceAcct.type] -= amt;
                            }
                        });
                    }
                }
            }
            if (state.properties[pId]?.active) {
                 const prop = propertyAssets.find(p=>p.id===pId);
                 const sellStr = prop.inputs?.sellDate ? prop.inputs.sellDate.slice(0, 7) : null;
                 if (sellStr === monthKey) {
                     const saleValue = propertyTrajectories[pId][year] || 0;
                     const netProceedsBeforeLoan = saleValue * 0.94;
                     let totalLoanPayoff = 0;
                     const linkedIds = prop.inputs?.linkedLoanIds || (prop.inputs?.linkedLoanId ? [prop.inputs.linkedLoanId] : []);
                     linkedIds.forEach(lid => {
                         if (loanBalances[lid]) {
                             totalLoanPayoff += (loanBalances[lid][monthKey] || 0);
                             state.closedLoans.add(lid);
                         }
                     });
                     let rmPayoff = 0;
                     if (state.reverseMortgage > 0) {
                         rmPayoff = state.reverseMortgage;
                         state.reverseMortgage = 0;
                         state.rmActive = false;
                     }
                     const finalCash = netProceedsBeforeLoan - totalLoanPayoff - rmPayoff;

                     if (finalCash > 0) {
                         updateComponents('joint', finalCash);
                         state.joint += finalCash;
                     }
                     state.properties[pId].active = false;
                     state.properties[pId].value = 0;
                     events.push({ date: dateStr, text: `Sold ${prop.name}. Net: $${Math.round(finalCash).toLocaleString()}` });
                 }
            }

             if (state.properties[pId]?.active) {
                 state.properties[pId].value = propertyTrajectories[pId][year] || 0;
                 totalActivePropValue += state.properties[pId].value;
             }
        });

        // --- INCOME & EXPENSES ---
        const workStatus = data.income.workStatus?.[year] || { brian: 0, andrea: 0 };
        const incomeProfile = getActiveProfile(data.income.profileSequence, dateStr, profiles) || data.income;

        let periodIncome = 0;
        const brianSalary = ((incomeProfile.brian?.netSalary || 0) * inflationMult) * workStatus.brian;
        const andreaSalary = ((incomeProfile.andrea?.netSalary || 0) * inflationMult) * workStatus.andrea;
        periodIncome += (brianSalary + andreaSalary) * dt;

        if (isMonthly) {
            if (incomeProfile.brian?.bonus?.month === monthIndex) periodIncome += ((incomeProfile.brian.bonus.amount || 0) * inflationMult) * workStatus.brian;
            if (incomeProfile.andrea?.bonus?.month === monthIndex) periodIncome += ((incomeProfile.andrea.bonus.amount || 0) * inflationMult) * workStatus.andrea;
        } else {
            periodIncome += ((incomeProfile.brian?.bonus?.amount || 0) * inflationMult) * workStatus.brian;
            periodIncome += ((incomeProfile.andrea?.bonus?.amount || 0) * inflationMult) * workStatus.andrea;
        }

        const processSS = (personKey, age, birthMonth) => {
            const ssConfig = data.income[personKey]?.socialSecurity || {};
            const startAge = ssConfig.startAge || 70;
            if (age < startAge) return 0;
            const monthlyVal = (ssConfig.monthlyAmount || 0) * inflationMult;
            let annualVal = monthlyVal * 12;
            if (age === startAge) {
               const fraction = Math.max(0, (12 - (birthMonth || 1))) / 12;
               annualVal = annualVal * fraction;
               if (!state.ssLogged[personKey]) {
                   events.push({ date: dateStr, text: `${personKey.charAt(0).toUpperCase() + personKey.slice(1)} Social Security Started` });
                   state.ssLogged[personKey] = true;
               }
            }
            return annualVal * dt;
        };
        periodIncome += processSS('brian', brianAge, data.income.brian.birthMonth);
        periodIncome += processSS('andrea', andreaAge, data.income.andrea.birthMonth);

        if (year >= andreaPensionStartYear) {
            const penConfig = data.income.andrea.pension || {};
            let monthlyPen = penConfig.monthlyAmount || 0;
            if (penConfig.inflationAdjusted) monthlyPen *= inflationMult;
            periodIncome += (monthlyPen * 12) * dt;
            if (!state.pensionLogged.andrea) { events.push({ date: dateStr, text: "Andrea Pension Started" }); state.pensionLogged.andrea = true; }
        }

        const expenseProfile = getActiveProfile(data.expenses.profileSequence, dateStr, profiles) || data.expenses;
        let periodExpenses = 0;
        ['bills', 'home', 'living', 'impounds'].forEach(cat => {
            if (expenseProfile[cat]) {
                const baseAnnual = expenseProfile[cat].reduce((sum, item) => sum + (item.amount || 0), 0) * 12;
                periodExpenses += (baseAnnual * dt) * inflationMult;
            }
        });

        let totalActiveLoanBalance = 0;
        Object.values(data.loans).forEach(loan => {
            if (!loan.active) return;
            if (state.closedLoans.has(loan.id)) return;
            const bal = loanBalances[loan.id]?.[monthKey];
            if (bal !== undefined && bal > 0) totalActiveLoanBalance += bal;
            periodExpenses += (loan.inputs.payment || 0) * (isMonthly ? 1 : 12);
        });

        const netCashFlow = periodIncome - periodExpenses;
        let shortfall = 0;

        if (netCashFlow >= 0) {
            const cashMax = assumptions.thresholds?.cashMax || 30000;
            const cashRoom = cashMax - state.cash;
            if (netCashFlow <= cashRoom) {
                updateComponents('cash', netCashFlow);
                state.cash += netCashFlow;
            } else {
                updateComponents('cash', cashRoom);
                state.cash += cashRoom;
                updateComponents('joint', netCashFlow - cashRoom);
                state.joint += (netCashFlow - cashRoom);
            }
        }
        else {
            let needed = Math.abs(netCashFlow);
            const cashMin = assumptions.thresholds?.cashMin || 15000;

            const availCash = Math.max(0, state.cash - cashMin);
            if (availCash >= needed) {
                updateComponents('cash', -needed);
                state.cash -= needed;
                needed = 0;
            } else {
                updateComponents('cash', -availCash);
                state.cash -= availCash;
                needed -= availCash;
            }

            if (needed > 0) {
                const effectiveRate = taxRate * 0.5;
                const grossNeeded = needed / (1 - effectiveRate);
                if (state.joint >= grossNeeded) {
                    updateComponents('joint', -grossNeeded);
                    state.joint -= grossNeeded;
                    needed = 0;
                } else {
                    const net = state.joint * (1 - effectiveRate);
                    updateComponents('joint', -state.joint);
                    state.joint = 0;
                    needed -= net;
                }
            }

            if (needed > 0 && state.inherited > 0) {
                const grossNeeded = needed / (1 - taxRate);
                if (state.inherited >= grossNeeded) {
                    updateComponents('inherited', -grossNeeded);
                    state.inherited -= grossNeeded;
                    needed = 0;
                } else {
                    const net = state.inherited * (1 - taxRate);
                    updateComponents('inherited', -state.inherited);
                    state.inherited = 0;
                    needed -= net;
                    if (!state.iraEvents.depleted) { events.push({ date: dateStr, text: "Inherited IRA Depleted (Waterfall)" }); state.iraEvents.depleted = true; }
                }
            }

            if (needed > 0 && state.retirement > 0) {
                const grossNeeded = needed / (1 - taxRate);
                if (state.retirement >= grossNeeded) {
                    updateComponents('retirement', -grossNeeded);
                    state.retirement -= grossNeeded;
                    needed = 0;
                } else {
                    const net = state.retirement * (1 - taxRate);
                    updateComponents('retirement', -state.retirement);
                    state.retirement = 0;
                    needed -= net;
                    events.push({ date: dateStr, text: "401k Fully Depleted" });
                }
            }

            if (needed > 0) {
                const hasProperty = Object.values(state.properties).some(p => p.active);
                if (!state.rmActive && hasProperty) {
                    state.rmActive = true;
                    events.push({ date: dateStr, text: "Reverse Mortgage Activated" });
                }
                if (state.rmActive && hasProperty) {
                    state.reverseMortgage += needed;
                    needed = 0;
                }
                else shortfall = needed;
            }
        }

        const applyGrowth = (type, rate) => {
            const growthAmt = state[type] * rate;
            if (growthAmt > 0) {
                updateComponents(type, growthAmt, true);
                state[type] += growthAmt;
            }
        };

        applyGrowth('cash', 0.01 * dt);
        const portRate = getPortfolioReturn(brianAge, assumptions) * dt;
        applyGrowth('joint', portRate);
        applyGrowth('inherited', portRate);
        applyGrowth('retirement', portRate);

        if (state.reverseMortgage > 0) state.reverseMortgage *= (1 + (0.065 * dt));

        state.netWorth = (state.cash + state.joint + state.inherited + state.retirement + totalActivePropValue) - (state.reverseMortgage + totalActiveLoanBalance);

        timeline.push({
            year, month: isMonthly ? monthIndex : 12, date: dateStr,
            age: brianAge, andreaAge,
            income: periodIncome, expenses: periodExpenses, netCashFlow,
            balances: { ...state, property: totalActivePropValue },
            components: JSON.parse(JSON.stringify(state.components)),
            flows: JSON.parse(JSON.stringify(state.annualFlows)),
            netWorth: state.netWorth, shortfall
        });

        if (shortfall > 0 && !state.insolvencyLogged) {
            events.push({ date: dateStr, text: "Out of Money" });
            state.insolvencyLogged = true;
        }

        if (isMonthly) state.date = addMonths(state.date, 1);
        else state.date = addYears(state.date, 1);
    });

    return { timeline, events };
};