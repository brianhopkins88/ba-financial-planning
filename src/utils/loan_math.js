import { addMonths, format, parseISO, differenceInMonths } from 'date-fns';

/**
 * CORE AMORTIZATION ENGINE
 * Generates a month-by-month schedule for a fixed-rate loan.
 * * @param {Object} loanInput - { principal, rate (decimal), payment, startDate, termMonths }
 * @param {Object} strategies - { "2026-03": 5000, "2027-01": 2000 } (Key = YYYY-MM, Val = Extra Amount)
 */
export const calculateFixedLoan = (loanInput, strategies = {}) => {
  const schedule = [];

  // 1. Setup Initial State
  let balance = loanInput.principal;
  let currentDate = parseISO(loanInput.startDate);
  const monthlyRate = loanInput.rate / 12;
  const minPayment = loanInput.payment;

  // Safety break to prevent infinite loops in bad calculations
  let safeGuard = 0;
  const MAX_MONTHS = 600; // 50 years

  // 2. Iterate until paid off
  while (balance > 0.01 && safeGuard < MAX_MONTHS) {
    const monthKey = format(currentDate, 'yyyy-MM');

    // A. Calculate Interest for this month
    const interestPayment = balance * monthlyRate;

    // B. Determine Total Payment (Min + Strategy)
    const extraPayment = strategies[monthKey] || 0;
    let totalPayment = minPayment + extraPayment;

    // C. Handle Final Month Logic
    if (totalPayment > (balance + interestPayment)) {
      totalPayment = balance + interestPayment;
    }

    // D. Apply to Principal
    const principalPayment = totalPayment - interestPayment;
    const beginningBalance = balance;
    balance -= principalPayment;

    // E. Push to Schedule
    schedule.push({
      date: monthKey,
      displayDate: format(currentDate, 'MMM yyyy'),
      beginningBalance: beginningBalance,
      payment: totalPayment,
      principal: principalPayment,
      interest: interestPayment,
      extraApplied: extraPayment,
      endingBalance: balance < 0.01 ? 0 : balance,
      isPayoff: balance < 0.01
    });

    // F. Advance Month
    currentDate = addMonths(currentDate, 1);
    safeGuard++;
  }

  // 3. Summarize Results
  const totalInterest = schedule.reduce((sum, row) => sum + row.interest, 0);
  const payoffDate = schedule[schedule.length - 1]?.date;

  return {
    schedule,
    summary: {
      totalInterest,
      payoffDate,
      totalMonths: schedule.length,
      finalPayment: schedule[schedule.length - 1]?.payment
    }
  };
};

/**
 * REVOLVING LOAN ENGINE (HELOC)
 * Simulates interest-only or custom payoff strategies.
 */
export const calculateRevolvingLoan = (loanInput, strategies = {}) => {
  const schedule = [];

  // HELOC inputs usually have current balance, not original
  let balance = loanInput.balance;
  // Default start date to "now" if not provided, or a fixed anchor
  let currentDate = loanInput.startDate ? parseISO(loanInput.startDate) : new Date();

  const monthlyRate = loanInput.rate / 12;
  const plannedPayment = loanInput.payment; // User's planned monthly payment

  let safeGuard = 0;
  const MAX_MONTHS = 600;

  while (balance > 0.01 && safeGuard < MAX_MONTHS) {
    const monthKey = format(currentDate, 'yyyy-MM');

    // A. Calculate Interest
    const interestPayment = balance * monthlyRate;

    // B. Determine Payment
    // For HELOCs, payment logic is often: "Interest Only" OR "Fixed Amount"
    // We assume the user inputs a "Planned Payment".
    // If Planned < Interest, we force payment = interest (negative amortization protection)
    let basePayment = Math.max(plannedPayment, interestPayment);

    const extraPayment = strategies[monthKey] || 0;
    let totalPayment = basePayment + extraPayment;

    if (totalPayment > (balance + interestPayment)) {
      totalPayment = balance + interestPayment;
    }

    const principalPayment = totalPayment - interestPayment;
    const beginningBalance = balance;
    balance -= principalPayment;

    schedule.push({
      date: monthKey,
      displayDate: format(currentDate, 'MMM yyyy'),
      beginningBalance: beginningBalance,
      payment: totalPayment,
      principal: principalPayment,
      interest: interestPayment,
      extraApplied: extraPayment,
      endingBalance: balance < 0.01 ? 0 : balance
    });

    currentDate = addMonths(currentDate, 1);
    safeGuard++;
  }

  return {
    schedule,
    summary: {
      totalInterest: schedule.reduce((sum, row) => sum + row.interest, 0),
      payoffDate: schedule[schedule.length - 1]?.date
    }
  };
};