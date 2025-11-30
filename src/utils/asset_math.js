import { addYears, getYear, parseISO, differenceInYears, isAfter, format } from 'date-fns';
import { calculateFixedLoan, calculateRevolvingLoan } from './loan_math';

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
 * Models the 10-year depletion rule with scheduled withdrawals.
 */
export const projectInheritedIra = (asset, assumptions, horizonYears) => {
    const startYear = assumptions.timing?.startYear || new Date().getFullYear();
    const rate = assumptions.market?.initial || 0.07;

    // IRA Specifics
    const startDateStr = asset.inputs?.startDate || `${startYear}-01-01`;
    const startDate = parseISO(startDateStr);
    const startYearIra = getYear(startDate);

    // Determine First Withdrawal Year
    // If started after Jan 15, first withdrawal is next year
    const cutoffDate = new Date(startYearIra, 0, 15); // Jan 15
    const firstWithdrawalYear = isAfter(startDate, cutoffDate) ? startYearIra + 1 : startYearIra;
    const finalWithdrawalYear = firstWithdrawalYear + 9; // 10 years total (0 to 9)

    const schedule = asset.inputs?.withdrawalSchedule || [0.1, 0.1, 0.1, 0.1, 0.1, 0.25, 0.25, 0.25, 0.25, 1.0];

    let currentBalance = asset.balance || 0;
    const projection = [];
    let cumulativeWithdrawals = 0;

    for (let t = 0; t <= horizonYears; t++) {
        const currentYear = startYear + t;

        let withdrawalPct = 0;
        let withdrawalAmount = 0;
        let taxRate = 0;
        let netAmount = 0;
        let janBalance = currentBalance;
        let isActive = false;

        // Logic: Withdrawal happens Jan 15
        // Check if this year is within the withdrawal window
        if (currentYear >= firstWithdrawalYear && currentYear <= finalWithdrawalYear) {
            isActive = true;
            // Map current year to schedule index (0-9)
            const scheduleIdx = currentYear - firstWithdrawalYear;

            // Force 100% on final year, otherwise use schedule
            withdrawalPct = (currentYear === finalWithdrawalYear)
                ? 1.0
                : (schedule[scheduleIdx] !== undefined ? schedule[scheduleIdx] : 0.1);

            withdrawalAmount = janBalance * withdrawalPct;

            // Safety cap
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
        else if (currentYear > finalWithdrawalYear) {
            // Should be empty
            currentBalance = 0;
            janBalance = 0;
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
            isActive: isActive || (currentYear === startYearIra)
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
    const startYear = assumptions.timing?.startYear || new Date().getFullYear();
    const props = assumptions.property || {};

    const baseline = props.baselineGrowth !== undefined ? props.baselineGrowth : 0.02;
    const newYears = props.newHomeYears || 5;
    const midYears = props.midHomeYears || 15;

    const newAddon = props.newHomeAddon !== undefined ? props.newHomeAddon : 0.015;
    const midAddon = props.midHomeAddon !== undefined ? props.midHomeAddon : 0.007;
    const matureAddon = props.matureHomeAddon !== undefined ? props.matureHomeAddon : 0.0;

    const maxGrowth = props.maxGrowth !== undefined ? props.maxGrowth : 0.04;
    const minGrowth = 0.0;

    const currentValue = asset.balance || 0;
    const buildYear = asset.inputs?.buildYear || (startYear - 10);
    const locationFactor = asset.inputs?.locationFactor || 0.0;

    // Identify Linked Loans
    const linkedIds = asset.inputs?.linkedLoanIds || (asset.inputs?.linkedLoanId ? [asset.inputs.linkedLoanId] : []);
    const linkedLoans = linkedIds.map(id => allLoans[id]).filter(Boolean);

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

        currentVal = currentVal * (1 + growthRate);
    }

    return projection;
};

/**
 * SIMPLE COMPOUND GROWTH
 * Used for Investment Accounts for visualization purposes.
 */
export const projectSimpleGrowth = (asset, assumptions, horizonYears) => {
    const startYear = assumptions.timing?.startYear || new Date().getFullYear();
    const rate = asset.growthType === 'fixed' ? (asset.fixedRate || 0) : (assumptions.market?.initial || 0.07);

    let balance = asset.balance || 0;
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