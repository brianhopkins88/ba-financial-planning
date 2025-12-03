import { addYears, getYear, parseISO, differenceInYears, isAfter, format, isValid } from 'date-fns';
import { calculateFixedLoan, calculateRevolvingLoan } from './loan_math';

/**
 * HELPER: Safe Number Extraction
 * Handles strings ("0.02"), numbers (0.02), and missing values (undefined/null).
 */
const safeNum = (val, def) => {
    if (val === undefined || val === null || val === '') return def;
    const num = parseFloat(val);
    return isNaN(num) ? def : num;
};

/**
 * ASSET PROJECTION ENGINE
 * Handles specific growth logic for different asset classes.
 */
export const calculateAssetGrowth = (asset, assumptions, allLoans = {}, horizonYears = 35) => {
    if (!asset || !asset.type) return [];

    switch (asset.type) {
        case 'property':
            return projectHomeValue(asset, assumptions, allLoans, horizonYears);
        case 'inherited':
            return projectInheritedIra(asset, assumptions, horizonYears);
        default:
            return projectSimpleGrowth(asset, assumptions, horizonYears);
    }
};

/**
 * INHERITED IRA PROJECTION
 * Models the 10-year depletion rule with scheduled withdrawals based on specific calendar years.
 */
export const projectInheritedIra = (asset, assumptions, horizonYears) => {
    const simStartYear = safeNum(assumptions.timing?.startYear, new Date().getFullYear());
    const rate = safeNum(assumptions.market?.initial, 0.07);

    // 1. Determine Key Dates
    const startDateStr = asset.inputs?.startDate;
    const startDate = startDateStr ? parseISO(startDateStr) : new Date(simStartYear, 0, 1);
    const startYearIra = isValid(startDate) ? getYear(startDate) : simStartYear;
    const finalYear = startYearIra + 10;

    const schedule = asset.inputs?.withdrawalSchedule || {};

    let currentBalance = safeNum(asset.balance, 0);
    const projection = [];
    let cumulativeWithdrawals = 0;

    for (let t = 0; t <= horizonYears; t++) {
        const currentYear = simStartYear + t;
        let withdrawalAmount = 0;
        let taxRate = 0;
        let netAmount = 0;
        let janBalance = currentBalance;
        let isActive = false;

        // Logic: Withdrawal happens in January if balance > 0
        if (currentYear >= startYearIra && currentYear <= finalYear && currentBalance > 0) {
            isActive = true;
            let withdrawalPct = 0;

            if (currentYear === finalYear) {
                withdrawalPct = 1.0; // Force empty
            } else {
                withdrawalPct = schedule[currentYear] !== undefined ? safeNum(schedule[currentYear], 0.20) : 0.20;
            }

            withdrawalAmount = janBalance * withdrawalPct;
            if (withdrawalAmount > janBalance) withdrawalAmount = janBalance;

            // Tax Logic
            if (withdrawalAmount > 600000) taxRate = 0.48;
            else if (withdrawalAmount > 400000) taxRate = 0.40;
            else if (withdrawalAmount > 200000) taxRate = 0.32;
            else taxRate = 0.25;

            netAmount = withdrawalAmount * (1 - taxRate);
            currentBalance -= withdrawalAmount;
            cumulativeWithdrawals += withdrawalAmount;
        }

        // Apply Growth (remaining balance grows)
        if (currentBalance > 0) {
            currentBalance = currentBalance * (1 + rate);
        }

        projection.push({
            year: currentYear,
            value: currentBalance,
            equity: currentBalance, // Main Bar
            debt: 0,
            cumulativeWithdrawals: cumulativeWithdrawals, // Stacked Bar
            totalValue: currentBalance + cumulativeWithdrawals,
            janValue: janBalance,
            withdrawal: withdrawalAmount,
            netProceeds: netAmount,
            taxRate: taxRate,
            isActive: isActive
        });
    }

    return projection;
};

/**
 * HOME VALUE PROJECTION ALGORITHM
 * Projects nominal home value using age-sensitive appreciation phases.
 * ALSO: Calculates Linked Loan Balances for "Net Equity" view.
 */
export const projectHomeValue = (asset, assumptions, allLoans, horizonYears) => {
    const startYear = safeNum(assumptions.timing?.startYear, new Date().getFullYear());

    // Defensive access to assumptions.property
    const props = (assumptions && assumptions.property) ? assumptions.property : {};

    // Robust defaults using safeNum
    const baseline = safeNum(props.baselineGrowth, 0.02);
    const newYears = safeNum(props.newHomeYears, 5);
    const midYears = safeNum(props.midHomeYears, 15);

    const newAddon = safeNum(props.newHomeAddon, 0.015);
    const midAddon = safeNum(props.midHomeAddon, 0.007);
    const matureAddon = safeNum(props.matureHomeAddon, 0.0);

    const maxGrowth = safeNum(props.maxGrowth, 0.04);
    const minGrowth = 0.0;

    const currentValue = safeNum(asset.balance, 0);
    const buildYear = safeNum(asset.inputs?.buildYear, startYear - 10);
    const locationFactor = safeNum(asset.inputs?.locationFactor, 0.0);

    // Identify Linked Loans
    const linkedIds = asset.inputs?.linkedLoanIds || (asset.inputs?.linkedLoanId ? [asset.inputs.linkedLoanId] : []);
    const linkedLoans = linkedIds.map(id => allLoans[id]).filter(Boolean);

    // Check for Sell Date
    const sellDateStr = asset.inputs?.sellDate; // "YYYY-MM-DD"
    const sellYear = sellDateStr ? parseInt(sellDateStr.substring(0, 4)) : 9999;

    // Pre-calculate loan schedules if any
    const loanSchedules = {};
    linkedLoans.forEach(loan => {
        const strategy = loan.strategies?.[loan.activeStrategyId || 'base'] || { extraPayments: {} };
        let res;
        if (loan.type === 'revolving') res = calculateRevolvingLoan(loan.inputs, strategy.extraPayments);
        else res = calculateFixedLoan(loan.inputs, strategy.extraPayments);

        // Map date (YYYY-MM) to ending balance
        loanSchedules[loan.id] = {};
        res.schedule.forEach(row => {
            loanSchedules[loan.id][row.date] = row.endingBalance;
        });
    });

    const projection = [];
    let currentVal = currentValue;
    const initialAge = startYear - buildYear;

    for (let t = 0; t <= horizonYears; t++) {
        const year = startYear + t;
        const ageAtYearT = initialAge + t;
        const monthKey = `${year}-01`; // Snapshot at January of each year

        // If sold, value is 0
        if (year > sellYear) {
             projection.push({
                year, age: ageAtYearT,
                value: 0, debt: 0, equity: 0, growthRate: 0, bucket: 'sold'
             });
             continue;
        }

        // 1. Calculate Growth
        let bucket = 'mature';
        let growthRate = baseline + matureAddon;

        if (ageAtYearT <= newYears) {
            bucket = 'new';
            growthRate = baseline + newAddon;
        } else if (ageAtYearT <= (newYears + midYears)) {
            bucket = 'mid';
            growthRate = baseline + midAddon;
        }

        growthRate += locationFactor;

        // Clamp growth rate
        if (growthRate < minGrowth) growthRate = minGrowth;
        if (growthRate > maxGrowth) growthRate = maxGrowth;

        // 2. Calculate Debt Load (Sum of linked loans at this year)
        let totalDebt = 0;
        linkedLoans.forEach(loan => {
             // Look for balance in Jan of this year, or fallback to 0 if paid off
             const bal = loanSchedules[loan.id]?.[monthKey] || 0;
             totalDebt += bal;
        });

        // 3. Net Equity
        const netEquity = Math.max(0, currentVal - totalDebt);

        projection.push({
            year,
            age: ageAtYearT,
            value: currentVal, // Total Market Value
            debt: totalDebt,   // Linked Debt
            equity: netEquity, // Net Value
            growthRate: growthRate,
            bucket
        });

        // Apply Growth for NEXT year
        currentVal = currentVal * (1 + growthRate);
    }

    return projection;
};

/**
 * SIMPLE COMPOUND GROWTH
 * Used for Investment Accounts for visualization purposes.
 */
export const projectSimpleGrowth = (asset, assumptions, horizonYears) => {
    const startYear = safeNum(assumptions.timing?.startYear, new Date().getFullYear());
    const rate = asset.growthType === 'fixed' ? safeNum(asset.fixedRate, 0) : safeNum(assumptions.market?.initial, 0.07);

    let balance = safeNum(asset.balance, 0);
    const projection = [];

    for (let t = 0; t <= horizonYears; t++) {
        projection.push({
            year: startYear + t,
            value: balance,
            debt: 0,
            equity: balance,
            cumulativeWithdrawals: 0,
            growthRate: rate
        });
        balance = balance * (1 + rate);
    }
    return projection;
};