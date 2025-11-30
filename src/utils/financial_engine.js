{
type: "file",
fileName: "src/utils/financial_engine.js",
fullContent: `import { addMonths, differenceInMonths, getMonth, getYear, format, isAfter, isBefore, parseISO, startOfMonth } from 'date-fns';
import { calculateFixedLoan, calculateRevolvingLoan } from './loan_math';
import { calculateAssetGrowth, projectHomeValue } from './asset_math';

/**
 * CORE FINANCIAL ENGINE
 * Simulates monthly cash flow and net worth over a 35-year horizon.
 */

// --- HELPERS ---

// Resolve the active profile for a given date from a "profileSequence"
const getActiveProfile = (sequence, dateStr, allProfiles) => {
    if (!sequence || !allProfiles) return null;
    // Find the last item where startDate <= current simulation date
    const activeItem = sequence
        .filter(item => item.isActive && item.startDate <= dateStr)
        .sort((a, b) => a.startDate.localeCompare(b.startDate))
        .pop();

    if (!activeItem) return null;
    const profileData = allProfiles[activeItem.profileId];
    return profileData ? profileData.data : null;
};

export const runFinancialSimulation = (scenario, profiles, monthsToProject = 420) => {
    if (!scenario || !scenario.data) return { months: [], events: [] };

    const data = scenario.data;
    const start = new Date(data.globals.timing.startYear, data.globals.timing.startMonth - 1, 1);

    // --- 1. INITIALIZE STATE ---
    let liquidCash = 0; // "Joint" + "Cash" combined for simulation liquidity
    let inheritedBalance = 0;
    let retirementBalance = 0;

    // Map initial asset balances
    const assets = Object.values(data.assets.accounts || {});
    assets.forEach(a => {
        if (!a.active) return;
        if (a.type === 'joint' || a.type === 'cash') liquidCash += a.balance;
        if (a.type === 'inherited') inheritedBalance += a.balance;
        if (a.type === 'retirement') retirementBalance += a.balance;
    });

    // Initialize "Virtual" Reverse Mortgage (if needed)
    let reverseMortgage = { balance: 0, active: false, startYear: null };

    // Output Arrays
    const timeline = [];
    const events = [];

    // --- 2. SIMULATION LOOP ---
    for (let m = 0; m < monthsToProject; m++) {
        const currentDate = addMonths(start, m);
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        const year = getYear(currentDate);
        const monthIndex = getMonth(currentDate) + 1; // 1-12

        // A. RESOLVE PROFILES
        const incomeProfile = getActiveProfile(data.income.profileSequence, dateStr, profiles) || data.income; // Fallback to root if no profiles
        const expenseProfile = getActiveProfile(data.expenses.profileSequence, dateStr, profiles) || data.expenses;

        // B. CALCULATE INCOME
        let monthlyIncome = 0;

        // Brian & Andrea Base Salary
        const brianBase = (incomeProfile.brian?.netSalary || 0) / 12;
        const andreaBase = (incomeProfile.andrea?.netSalary || 0) / 12;

        // Work Status Multiplier (Trajectory)
        const workStatus = data.income.workStatus?.[year] || { brian: 0, andrea: 0 };
        monthlyIncome += (brianBase * workStatus.brian);
        monthlyIncome += (andreaBase * workStatus.andrea);

        // Bonuses (Payout Month Check)
        if (incomeProfile.brian?.bonus?.month === monthIndex) {
            monthlyIncome += (incomeProfile.brian.bonus.amount || 0) * workStatus.brian;
        }
        if (incomeProfile.andrea?.bonus?.month === monthIndex) {
            monthlyIncome += (incomeProfile.andrea.bonus.amount || 0) * workStatus.andrea;
        }

        // C. CALCULATE EXPENSES
        let monthlyExpenses = 0;

        // Recurring Categories
        ['bills', 'home', 'living', 'impounds'].forEach(cat => {
            if (expenseProfile[cat]) {
                monthlyExpenses += expenseProfile[cat].reduce((sum, item) => sum + (item.amount || 0), 0);
            }
        });

        // Inflation adjustment (Annual step for simplicity, or monthly compound)
        // Using simplified annual compounding based on year delta
        const inflationRate = data.globals.inflation.general || 0.025;
        const inflationMult = Math.pow(1 + inflationRate, m / 12);
        monthlyExpenses *= inflationMult;

        // One-Offs (Specific to this month YYYY-MM)
        const currentMonthKey = format(currentDate, 'yyyy-MM');
        const oneOffs = (expenseProfile.oneOffs || []).filter(i => i.date === currentMonthKey);
        const oneOffTotal = oneOffs.reduce((sum, i) => sum + i.amount, 0);
        monthlyExpenses += oneOffTotal;

        // D. DEBT SERVICE (Loans)
        // We need to simulate loans dynamically to track payoffs
        // For v0.8 simplicity, we'll approximate using the loan_math helpers *if* we wanted precise amortization
        // inside the loop. However, calling the full engine 420 times is expensive.
        // OPTIMIZATION: We sum the "scheduled payments" from the Loans Module.
        // NOTE: This assumes loans are static schedules. If we pay them off early via Waterfall, we'd need dynamic tracking.
        // For Phase 4, we will stick to the "Scheduled Payments" unless "Cash to Close" logic intervenes.

        let debtService = 0;
        Object.values(data.loans).forEach(loan => {
            if (!loan.active) return;
            // Simplified: If inside term, add payment.
            // Real implementation would track balance decrement here.
            // For now, we assume standard schedule adds to expenses.
            // TODO: Enhance with dynamic loan tracking in Phase 4.5
            debtService += (loan.inputs.payment || 0);
        });
        monthlyExpenses += debtService;

        // E. CASH FLOW & WATERFALL
        const netCashFlow = monthlyIncome - monthlyExpenses;
        let shortfall = 0;

        if (netCashFlow >= 0) {
            // Surplus -> Add to Liquid Cash
            liquidCash += netCashFlow;
        } else {
            // Deficit -> Waterfall Logic
            let needed = Math.abs(netCashFlow);

            // 1. Joint / Liquid Cash
            if (liquidCash >= needed) {
                liquidCash -= needed;
                needed = 0;
            } else {
                needed -= liquidCash;
                liquidCash = 0;
            }

            // 2. Inherited IRA (Accelerated)
            if (needed > 0 && inheritedBalance > 0) {
                if (inheritedBalance >= needed) {
                    inheritedBalance -= needed;
                    needed = 0;
                } else {
                    needed -= inheritedBalance;
                    inheritedBalance = 0;
                    events.push({ date: dateStr, text: "Inherited IRA Depleted" });
                }
            }

            // 3. Retirement 401k
            if (needed > 0 && retirementBalance > 0) {
                if (retirementBalance >= needed) {
                    retirementBalance -= needed;
                    needed = 0;
                } else {
                    needed -= retirementBalance;
                    retirementBalance = 0;
                    events.push({ date: dateStr, text: "401k/Retirement Depleted" });
                }
            }

            // 4. Reverse Mortgage (The "Safety Net")
            if (needed > 0) {
                // Auto-trigger if not active
                if (!reverseMortgage.active) {
                    reverseMortgage.active = true;
                    reverseMortgage.startYear = year;
                    events.push({ date: dateStr, text: "Cash Threshold Breached: Reverse Mortgage Started" });
                }
                reverseMortgage.balance += needed;
                shortfall = 0; // Covered by debt
            }
        }

        // F. ASSET GROWTH (Monthly)
        // Simple monthly rate approximation
        const marketRate = (data.globals.market.initial || 0.07) / 12;
        liquidCash *= (1 + marketRate);
        inheritedBalance *= (1 + marketRate);
        retirementBalance *= (1 + marketRate);

        // Reverse Mortgage Interest (Negative Compounding)
        if (reverseMortgage.active) {
            const revRate = 0.06 / 12; // 6% fixed assumption from requirements
            reverseMortgage.balance *= (1 + revRate);
        }

        // G. RECORD STATE
        timeline.push({
            date: dateStr,
            year,
            month: monthIndex,
            income: monthlyIncome,
            expenses: monthlyExpenses,
            netCashFlow,
            balances: {
                liquid: liquidCash,
                inherited: inheritedBalance,
                retirement: retirementBalance,
                reverseMortgage: reverseMortgage.balance
            },
            netWorth: (liquidCash + inheritedBalance + retirementBalance) - reverseMortgage.balance
            // Note: Property value should be added to Net Worth, calculated separately via asset_math
        });
    }

    return { timeline, events };
};`
}