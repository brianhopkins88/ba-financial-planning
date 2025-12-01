import { addMonths, addYears, getYear, getMonth, format, isBefore, isAfter, parseISO, startOfMonth, isValid } from 'date-fns';
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
    if (!scenario || !scenario.data) return { timeline: [], events: [], reverseMortgageDetails: [] };

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
        components: {
            cash: { basis: 0, growth: 0 },
            joint: { basis: 0, growth: 0 },
            inherited: { basis: 0, growth: 0 },
            retirement: { basis: 0, growth: 0 }
        },
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
        activeLoans: new Set(),
        ssLogged: { brian: false, andrea: false },
        pensionLogged: { andrea: false },
        iraEvents: {},
        forcedSaleOccurred: false,
        postHousingPhase: false
    };

    Object.values(data.loans || {}).forEach(l => { if(l.active) state.activeLoans.add(l.id); });

    const rmDetails = [];
    const rmCurrentYear = { draws: 0, interest: 0 };

    const updateComponents = (type, amount, isGrowth = false) => {
        if (!state.components[type]) return;
        const comp = state.components[type];
        const flow = state.annualFlows[type];
        const balance = state[type];

        if (amount > 0) {
            if (isGrowth) { comp.growth += amount; flow.growth += amount; }
            else { comp.basis += amount; flow.deposits += amount; }
        } else {
            const absAmt = Math.abs(amount);
            flow.withdrawals += absAmt;
            if (balance <= 0.01) { comp.basis = 0; comp.growth = 0; return; }
            const ratio = absAmt / balance;
            const safeRatio = Math.min(ratio, 1.0);
            comp.basis -= comp.basis * safeRatio;
            comp.growth -= comp.growth * safeRatio;
        }
    };

    // --- ASSET INITIALIZATION ---
    const assets = Object.values(data.assets.accounts || {});
    const futureAssets = [];

    assets.forEach(a => {
        if (!a.active) return;
        if (a.type === 'property') {
            const pStart = a.inputs?.startDate ? parseISO(a.inputs.startDate) : startDate;
            if (!isAfter(pStart, startDate)) state.properties[a.id] = { active: true, value: a.balance };
            else state.properties[a.id] = { active: false, value: 0 };
        }
        else if (['cash', 'joint', 'inherited', 'retirement'].includes(a.type)) {
            const aStartStr = a.inputs?.startDate;
            const aStart = aStartStr ? parseISO(aStartStr) : startDate;
            if (isAfter(aStart, startDate)) {
                futureAssets.push({
                    id: a.id, type: a.type, name: a.name, balance: a.balance,
                    startDateStr: aStartStr.substring(0, 7)
                });
            } else {
                state[a.type] += a.balance;
                state.components[a.type].basis += a.balance;
            }
        }
    });

    // INHERITED IRA SETUP (Year-based)
    const iraAccount = assets.find(a => a.type === 'inherited');
    const iraStartStr = iraAccount?.inputs?.startDate;
    const iraStart = iraStartStr ? parseISO(iraStartStr) : startDate;
    const iraStartYear = isValid(iraStart) ? getYear(iraStart) : startYear;
    const iraFinalWithdrawalYear = iraStartYear + 10;
    const iraSchedule = iraAccount?.inputs?.withdrawalSchedule || {};

    const timeline = [];
    const events = [];

    const steps = [];
    for (let i = 0; i < 60; i++) steps.push({ type: 'month', index: i });
    for (let i = 1; i <= 30; i++) steps.push({ type: 'year', index: i });

    let initialDebt = 0;
    let initialPropVal = 0;
    const startMonthKey = format(startDate, 'yyyy-MM');
    state.activeLoans.forEach(lid => {
        const sched = loanScheduleMap[lid];
        if (sched && sched[startMonthKey]) initialDebt += sched[startMonthKey].balance;
        else {
            const l = data.loans[lid];
            const lStart = l.inputs.startDate ? parseISO(l.inputs.startDate) : startDate;
            if(!isAfter(lStart, startDate)) initialDebt += (l.inputs.balance || l.inputs.principal);
        }
    });
    Object.values(state.properties).forEach(p => { if(p.active) initialPropVal += p.value; });

    timeline.push({
        year: startYear, month: 0, date: format(startDate, 'yyyy-MM-dd'),
        age: startYear - (data.income.brian.birthYear || 1966),
        andreaAge: startYear - (data.income.andrea.birthYear || 1965),
        income: 0, expenses: 0, netCashFlow: 0,
        balances: { ...state, property: initialPropVal, liquid: state.cash + state.joint, totalDebt: initialDebt },
        components: JSON.parse(JSON.stringify(state.components)),
        flows: { ...state.annualFlows },
        netWorth: (state.cash + state.joint + state.inherited + state.retirement + initialPropVal) - (state.reverseMortgage + initialDebt),
        shortfall: 0
    });

    // --- HELPER: DISTRIBUTE SALE PROCEEDS ---
    const distributeSaleProceeds = (netCash) => {
        if (netCash <= 0) return;
        const cashMax = assumptions.thresholds?.cashMax || 30000;
        const cashNeed = Math.max(0, cashMax - state.cash);

        // 1. Top off Cash
        const toCash = Math.min(netCash, cashNeed);
        if (toCash > 0) {
            state.cash += toCash;
            updateComponents('cash', toCash);
        }

        // 2. Remainder to Joint
        const remainder = netCash - toCash;
        if (remainder > 0) {
            state.joint += remainder;
            updateComponents('joint', remainder);
        }
    };

    // --- MAIN LOOP ---
    steps.forEach(step => {
        const isMonthly = step.type === 'month';
        const currentDate = state.date;
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        const monthKey = format(currentDate, 'yyyy-MM');
        const year = getYear(currentDate);
        const monthIndex = getMonth(currentDate) + 1;
        const dt = isMonthly ? 1 / 12 : 1.0;

        if (monthIndex === 1) {
            ['cash', 'joint', 'inherited', 'retirement'].forEach(k => {
                state.annualFlows[k] = { deposits: 0, withdrawals: 0, growth: 0 };
            });
            rmCurrentYear.draws = 0;
            rmCurrentYear.interest = 0;
        }

        // Future Assets
        futureAssets.forEach((fa, idx) => {
            if (fa.activated) return;
            let isTime = false;
            if (isMonthly) { if (fa.startDateStr === monthKey) isTime = true; }
            else { if (fa.startDateStr.startsWith(year.toString())) isTime = true; }
            if (isTime) {
                updateComponents(fa.type, fa.balance);
                state[fa.type] += fa.balance;
                events.push({ date: dateStr, text: `Asset Activated: ${fa.name} ($${Math.round(fa.balance).toLocaleString()})` });
                futureAssets[idx].activated = true;
            }
        });

        const brianBirthYear = data.income.brian.birthYear || 1966;
        const andreaBirthYear = data.income.andrea.birthYear || 1965;
        const brianAge = year - brianBirthYear;
        const andreaAge = year - andreaBirthYear;
        const inflationRate = assumptions.inflation.general || 0.025;
        const yearsElapsed = step.type === 'month' ? step.index / 12 : (5 + step.index);
        const inflationMult = Math.pow(1 + inflationRate, yearsElapsed);

        const workStatus = data.income.workStatus?.[year] || { brian: 0, andrea: 0 };
        const taxRate = getTaxRate(year, workStatus, assumptions);

        // Income & Contributions
        const brianGross = (data.income.brian.grossForContrib || 0) * inflationMult;
        const andreaGross = (data.income.andrea.grossForContrib || 0) * inflationMult;
        const brianContribPct = data.income.brian.contribPercent || 0;
        const andreaContribPct = data.income.andrea.contribPercent || 0;
        const brianMatchRate = Math.min(brianContribPct, 0.06) * 0.5;
        const andreaMatchRate = 0;
        const brianEmployeeContrib = (brianGross * workStatus.brian * brianContribPct) * dt;
        const brianEmployerMatch = (brianGross * workStatus.brian * brianMatchRate) * dt;
        const andreaEmployeeContrib = (andreaGross * workStatus.andrea * andreaContribPct) * dt;
        const andreaEmployerMatch = (andreaGross * workStatus.andrea * andreaMatchRate) * dt;
        const totalContrib = brianEmployeeContrib + brianEmployerMatch + andreaEmployeeContrib + andreaEmployerMatch;

        if (totalContrib > 0) {
            updateComponents('retirement', totalContrib);
            state.retirement += totalContrib;
        }

        // Inherited IRA RMDs
        if (state.inherited > 0) {
            let mandatoryWithdrawal = 0;
            const isJanuary = monthIndex === 1;
            if (isJanuary && year <= iraFinalWithdrawalYear) {
                let pct = 0;
                if (year === iraFinalWithdrawalYear) {
                    pct = 1.0;
                } else {
                    // FIXED: Default to 0.20 (20%) for empty years to ensure population
                    pct = iraSchedule[year] !== undefined ? iraSchedule[year] : 0.20;
                }
                mandatoryWithdrawal = state.inherited * pct;
            }

            if (mandatoryWithdrawal > 0) {
                if (mandatoryWithdrawal > state.inherited) mandatoryWithdrawal = state.inherited;
                updateComponents('inherited', -mandatoryWithdrawal);
                state.inherited -= mandatoryWithdrawal;
                if(state.inherited < 1) state.inherited = 0;
                const effectiveTaxRate = getIraTaxRate(mandatoryWithdrawal, taxRate);
                const netProceeds = mandatoryWithdrawal * (1 - effectiveTaxRate);
                updateComponents('joint', netProceeds);
                state.joint += netProceeds;
                if (year === iraFinalWithdrawalYear && !state.iraEvents.depleted) {
                    events.push({ date: dateStr, text: "Inherited IRA Final Year: Fully Withdrawn" });
                    state.iraEvents.depleted = true;
                }
            }
        }

        // --- PROPERTY LOGIC (Sale & Values) ---
        let totalActivePropValue = 0;
        Object.keys(propertyTrajectories).forEach(pId => {
             if (!state.properties[pId]?.active) {
                const prop = propertyAssets.find(p=>p.id===pId);
                const startStr = prop.inputs?.startDate ? prop.inputs.startDate.slice(0, 7) : '9999-99';
                if (startStr === monthKey) {
                    state.properties[pId] = { active: true, value: 0 };
                    events.push({ date: dateStr, text: `Asset Acquired: ${prop.name}` });
                    if (prop.inputs.purchasePlan?.funding) {
                        prop.inputs.purchasePlan.funding.forEach(fund => {
                            if (!fund.amount || !fund.sourceId) return;
                            updateComponents(data.assets.accounts[fund.sourceId].type, -fund.amount);
                            state[data.assets.accounts[fund.sourceId].type] -= fund.amount;
                        });
                    }
                }
            }

            // PLANNED SALE LOGIC
            if (state.properties[pId]?.active) {
                 const prop = propertyAssets.find(p=>p.id===pId);
                 const sellStr = prop.inputs?.sellDate ? prop.inputs.sellDate.slice(0, 7) : null;
                 if (sellStr === monthKey) {
                     const saleValue = propertyTrajectories[pId][year] || 0;
                     const netProceedsBeforeLoan = saleValue * 0.94;
                     let totalLoanPayoff = 0;
                     const linkedIds = prop.inputs?.linkedLoanIds || (prop.inputs?.linkedLoanId ? [prop.inputs.linkedLoanId] : []);
                     linkedIds.forEach(lid => {
                         const sched = loanScheduleMap[lid];
                         if (sched) {
                             const currentInfo = sched[monthKey] || { balance: 0 };
                             totalLoanPayoff += currentInfo.balance;
                             state.closedLoans.add(lid);
                             state.activeLoans.delete(lid);
                         }
                     });

                     let rmPayoff = 0;
                     if (state.reverseMortgage > 0) {
                         rmPayoff = state.reverseMortgage;
                         state.reverseMortgage = 0;
                         state.rmActive = false;
                     }

                     const finalCash = netProceedsBeforeLoan - totalLoanPayoff - rmPayoff;
                     distributeSaleProceeds(finalCash);

                     state.properties[pId].active = false;
                     state.properties[pId].value = 0;
                     state.postHousingPhase = true;
                     events.push({ date: dateStr, text: `Sold ${prop.name}. Net Equity: $${Math.round(finalCash).toLocaleString()}` });
                 }
            }
             if (state.properties[pId]?.active) {
                 state.properties[pId].value = propertyTrajectories[pId][year] || 0;
                 totalActivePropValue += state.properties[pId].value;
             }
        });

        // --- NEW: LTV CHECK FOR FORCED SALE ---
        if (state.rmActive && totalActivePropValue > 0) {
            const currentLTV = state.reverseMortgage / totalActivePropValue;
            const limit = getLtvLimit(brianAge);

            if (currentLTV >= limit) {
                const saleValue = totalActivePropValue;
                const netProceedsBeforeLoan = saleValue * 0.94;

                let totalNormalLoanPayoff = 0;
                state.activeLoans.forEach(lid => {
                    const sched = loanScheduleMap[lid];
                    if (sched) {
                         const currentInfo = isMonthly ? sched[monthKey] : sched[`${year}-12-31`];
                         if(currentInfo) {
                             totalNormalLoanPayoff += currentInfo.balance;
                             state.closedLoans.add(lid);
                             state.activeLoans.delete(lid);
                         }
                    }
                });

                const rmPayoff = state.reverseMortgage;
                state.reverseMortgage = 0;
                state.rmActive = false;

                const finalCash = netProceedsBeforeLoan - totalNormalLoanPayoff - rmPayoff;
                distributeSaleProceeds(finalCash);

                Object.keys(state.properties).forEach(pid => {
                     state.properties[pid].active = false;
                     state.properties[pid].value = 0;
                });
                totalActivePropValue = 0;

                state.forcedSaleOccurred = true;
                state.postHousingPhase = true;
                events.push({ date: dateStr, text: `FORCED SALE (LTV Limit ${Math.round(limit*100)}% Hit). Net Equity: $${Math.round(finalCash).toLocaleString()}` });
            }
        }

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
            const sched = loanScheduleMap[loan.id];
            if (!sched) return;
            if (isMonthly) {
                const info = sched[monthKey];
                if (info) {
                    if (info.payment > 0) {
                        periodExpenses += info.payment;
                        totalActiveLoanBalance += info.balance;
                    }
                    if (info.balance <= 0.01 && state.activeLoans.has(loan.id)) {
                        events.push({ date: dateStr, text: `Liability Paid Off: ${loan.name}` });
                        state.activeLoans.delete(loan.id);
                        state.closedLoans.add(loan.id);
                    }
                }
            } else {
                let annualPayment = 0;
                let lastBalance = 0;
                for (let m=1; m<=12; m++) {
                    const mKey = `${year}-${String(m).padStart(2,'0')}`;
                    const info = sched[mKey];
                    if (info) { annualPayment += info.payment; lastBalance = info.balance; }
                }
                periodExpenses += annualPayment;
                totalActiveLoanBalance += lastBalance;
                if (lastBalance <= 0.01 && state.activeLoans.has(loan.id)) {
                     events.push({ date: `${year}-12-31`, text: `Liability Paid Off: ${loan.name}` });
                     state.activeLoans.delete(loan.id);
                     state.closedLoans.add(loan.id);
                }
            }
        });

        const planningExpenses = data.expenses || {};
        const brackets = planningExpenses.retirementBrackets || {};
        let funMoneyBase = 0;
        Object.keys(brackets).forEach(k => {
            const startAge = parseInt(k);
            if (brianAge >= startAge && brianAge < startAge + 5) funMoneyBase = brackets[k];
        });
        if (funMoneyBase > 0) periodExpenses += (funMoneyBase * dt) * inflationMult;

        const oneOffs = planningExpenses.oneOffs || [];
        oneOffs.forEach(item => {
            let match = false;
            if (isMonthly) { if (item.date === monthKey) match = true; }
            else { if (item.date && item.date.startsWith(year.toString())) match = true; }
            if (match) periodExpenses += (item.amount || 0) * inflationMult;
        });

        const netCashFlow = periodIncome - periodExpenses;
        let shortfall = 0;

        // --- CASH FLOW WATERFALL ---
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

            // BRANCH: POST-HOUSING PHASE WATERFALL
            if (state.postHousingPhase) {
                // 1. Joint
                if (needed > 0 && state.joint > 0) {
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

                // 2. 401k (NO FLOOR)
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
                        events.push({ date: dateStr, text: "401k Fully Depleted (Post-Sale)" });
                    }
                }

                // 3. Cash Last
                if (needed > 0 && state.cash > 0) {
                    const availCash = state.cash;
                    if (availCash >= needed) {
                        updateComponents('cash', -needed);
                        state.cash -= needed;
                        needed = 0;
                    } else {
                        updateComponents('cash', -availCash);
                        state.cash = 0;
                        needed -= availCash;
                    }
                }

                shortfall = needed;
            }
            // BRANCH: STANDARD WATERFALL
            else {
                // 1. Cash (Floor)
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

                // 2. Joint
                if (needed > 0) {
                    const jointMin = assumptions.thresholds?.jointMin || 0;
                    const availJoint = Math.max(0, state.joint - jointMin);
                    const effectiveRate = taxRate * 0.5;
                    const grossNeeded = needed / (1 - effectiveRate);
                    if (availJoint >= grossNeeded) {
                        updateComponents('joint', -grossNeeded);
                        state.joint -= grossNeeded;
                        needed = 0;
                    } else {
                        const net = availJoint * (1 - effectiveRate);
                        updateComponents('joint', -availJoint);
                        state.joint -= availJoint;
                        needed -= net;
                    }
                }

                // 3. Inherited IRA
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

                // 4. Retirement (Floor + RM Trigger)
                if (needed > 0 && state.retirement > 0) {
                    const retirementMin = assumptions.thresholds?.retirementMin || 300000;

                    const availRetirement = Math.max(0, state.retirement - retirementMin);

                    if (!state.rmActive && availRetirement > 0) {
                         const grossNeeded = needed / (1 - taxRate);
                         if (availRetirement >= grossNeeded) {
                             updateComponents('retirement', -grossNeeded);
                             state.retirement -= grossNeeded;
                             needed = 0;
                         } else {
                             const net = availRetirement * (1 - taxRate);
                             updateComponents('retirement', -availRetirement);
                             state.retirement -= availRetirement;
                             needed -= net;
                         }
                    }
                }

                // 5. Reverse Mortgage
                if (needed > 0) {
                    const hasProperty = Object.values(state.properties).some(p => p.active);

                    // ACTIVATE RM
                    if (!state.rmActive && hasProperty) {
                        state.rmActive = true;

                        // PAYOFF EXISTING MORTGAGES
                        let existingMortgageBalance = 0;
                        state.activeLoans.forEach(lid => {
                             const loan = data.loans[lid];
                             if (loan.type === 'mortgage') {
                                 const sched = loanScheduleMap[lid];
                                 const currentInfo = isMonthly ? sched[monthKey] : sched[`${year}-12-31`];
                                 if (currentInfo) {
                                     existingMortgageBalance += currentInfo.balance;
                                     state.closedLoans.add(lid);
                                     state.activeLoans.delete(lid);
                                 }
                             }
                        });

                        if (existingMortgageBalance > 0) {
                            state.reverseMortgage += existingMortgageBalance;
                            events.push({ date: dateStr, text: `Reverse Mortgage Activated. Paid off $${Math.round(existingMortgageBalance).toLocaleString()} existing debt.` });
                        } else {
                            events.push({ date: dateStr, text: "Reverse Mortgage Activated" });
                        }
                    }

                    if (state.rmActive && hasProperty) {
                        state.reverseMortgage += needed;
                        rmCurrentYear.draws += needed;
                        needed = 0;
                    } else {
                        shortfall = needed;
                    }
                }
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

        if (state.reverseMortgage > 0) {
            const rmRate = assumptions.rates?.reverseMortgage || 0.065;
            const interest = state.reverseMortgage * (rmRate * dt);
            state.reverseMortgage += interest;
            rmCurrentYear.interest += interest;
        }

        if (state.rmActive && (monthIndex === 12 || !isMonthly)) {
            rmDetails.push({
                year: year,
                draws: rmCurrentYear.draws,
                interest: rmCurrentYear.interest,
                balance: state.reverseMortgage,
                homeValue: totalActivePropValue,
                ltv: totalActivePropValue > 0 ? (state.reverseMortgage / totalActivePropValue) : 0
            });
        }

        state.netWorth = (state.cash + state.joint + state.inherited + state.retirement + totalActivePropValue) - (state.reverseMortgage + totalActiveLoanBalance);

        timeline.push({
            year, month: isMonthly ? monthIndex : 12, date: dateStr,
            age: brianAge, andreaAge,
            income: periodIncome, expenses: periodExpenses, netCashFlow,
            balances: { ...state, property: totalActivePropValue, liquid: state.cash + state.joint, totalDebt: totalActiveLoanBalance },
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

    return { timeline, events, reverseMortgageDetails: rmDetails };
};