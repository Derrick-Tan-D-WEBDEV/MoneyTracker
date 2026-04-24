/**
 * Debt payoff strategy calculator.
 * Supports Avalanche (highest interest first) and Snowball (lowest balance first).
 */

export interface DebtInput {
  id: string;
  name: string;
  type: string;
  remainingAmount: number;
  interestRate: number; // annual %
  minimumPayment: number;
  currency: string;
  color?: string;
}

export interface MonthlySnapshot {
  month: number;
  date: string;
  totalBalance: number;
  totalPaid: number;
  totalInterest: number;
}

export interface DebtPayoffResult {
  strategy: "avalanche" | "snowball" | "custom";
  debtOrder: string[]; // ordered debt IDs
  months: number;
  payoffDate: string;
  totalInterest: number;
  totalPaid: number;
  startingBalance: number;
  monthlySnapshots: MonthlySnapshot[];
  debtSchedules: DebtSchedule[];
}

export interface DebtSchedule {
  debtId: string;
  name: string;
  color?: string;
  monthsToPayoff: number;
  payoffMonth: number;
  totalInterest: number;
  totalPaid: number;
  monthlyBreakdown: {
    month: number;
    startingBalance: number;
    interest: number;
    payment: number;
    principalPaid: number;
    endingBalance: number;
  }[];
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/**
 * Run a payoff simulation.
 * @param debts - User's active debts (all in same base currency)
 * @param extraPayment - Additional monthly payment beyond minimums
 * @param strategy - "avalanche" or "snowball"
 * @param startDate - When payments begin (defaults to today)
 */
export function calculatePayoff(
  debts: DebtInput[],
  extraPayment: number,
  strategy: "avalanche" | "snowball",
  startDate: Date = new Date(),
): DebtPayoffResult {
  if (debts.length === 0) {
    return {
      strategy,
      debtOrder: [],
      months: 0,
      payoffDate: formatMonthYear(startDate),
      totalInterest: 0,
      totalPaid: 0,
      startingBalance: 0,
      monthlySnapshots: [],
      debtSchedules: [],
    };
  }

  // Clone debts for simulation
  let simDebts = debts
    .filter((d) => d.remainingAmount > 0)
    .map((d) => ({
      ...d,
      currentBalance: d.remainingAmount,
      totalInterestPaid: 0,
      totalPaid: 0,
      isPaidOff: false,
      monthlyBreakdown: [] as {
        month: number;
        startingBalance: number;
        interest: number;
        payment: number;
        principalPaid: number;
        endingBalance: number;
      }[],
    }));

  // Sort by strategy priority
  if (strategy === "avalanche") {
    simDebts.sort((a, b) => b.interestRate - a.interestRate);
  } else {
    simDebts.sort((a, b) => a.remainingAmount - b.remainingAmount);
  }

  const debtOrder = simDebts.map((d) => d.id);
  const startingBalance = simDebts.reduce((s, d) => s + d.remainingAmount, 0);

  let month = 0;
  let totalInterest = 0;
  let totalPaid = 0;
  const monthlySnapshots: MonthlySnapshot[] = [];
  const maxMonths = 600; // 50 year safety cap

  while (simDebts.some((d) => !d.isPaidOff) && month < maxMonths) {
    month++;
    let monthTotalBalance = 0;
    let monthTotalPaid = 0;
    let monthTotalInterest = 0;
    let availableExtra = extraPayment;

    // First pass: calculate minimum payments and interest for all debts
    const minPayments = simDebts.map((d) => {
      if (d.isPaidOff) return { debt: d, minPayment: 0, interest: 0 };
      const monthlyRate = d.interestRate / 100 / 12;
      const interest = d.currentBalance * monthlyRate;
      // Minimum payment must at least cover interest, else debt grows forever
      const minPayment = Math.max(d.minimumPayment, interest + 0.01);
      return { debt: d, minPayment, interest };
    });

    // Check if total minimums exceed what user is paying (no extra possible)
    const totalMin = minPayments.reduce((s, m) => s + m.minPayment, 0);
    const totalPayment = totalMin + extraPayment;

    // Apply payments
    for (let i = 0; i < simDebts.length; i++) {
      const d = simDebts[i];
      if (d.isPaidOff) continue;

      const mp = minPayments[i];
      let payment = mp.minPayment;

      // Allocate extra to the first non-paid-off debt in priority order
      if (availableExtra > 0 && !d.isPaidOff) {
        payment += availableExtra;
        availableExtra = 0;
      }

      // Cap payment at balance + interest (can't overpay)
      const maxPayment = d.currentBalance + mp.interest;
      if (payment > maxPayment) {
        // Roll over excess to next debt
        availableExtra += payment - maxPayment;
        payment = maxPayment;
      }

      const principalPaid = payment - mp.interest;
      const newBalance = Math.max(d.currentBalance - principalPaid, 0);

      d.totalInterestPaid += mp.interest;
      d.totalPaid += payment;
      totalInterest += mp.interest;
      totalPaid += payment;
      monthTotalInterest += mp.interest;
      monthTotalPaid += payment;

      d.monthlyBreakdown.push({
        month,
        startingBalance: d.currentBalance,
        interest: mp.interest,
        payment,
        principalPaid,
        endingBalance: newBalance,
      });

      d.currentBalance = newBalance;
      if (newBalance <= 0.005) {
        d.isPaidOff = true;
      }

      monthTotalBalance += d.currentBalance;
    }

    monthlySnapshots.push({
      month,
      date: formatMonthYear(addMonths(startDate, month)),
      totalBalance: monthTotalBalance,
      totalPaid: totalPaid,
      totalInterest: totalInterest,
    });
  }

  // Build debt schedules
  const debtSchedules: DebtSchedule[] = simDebts.map((d) => {
    const payoffEntry = d.monthlyBreakdown.find((m) => m.endingBalance <= 0.005);
    const payoffMonth = payoffEntry ? payoffEntry.month : month;
    return {
      debtId: d.id,
      name: d.name,
      color: d.color,
      monthsToPayoff: payoffMonth,
      payoffMonth,
      totalInterest: d.totalInterestPaid,
      totalPaid: d.totalPaid,
      monthlyBreakdown: d.monthlyBreakdown,
    };
  });

  return {
    strategy,
    debtOrder,
    months: monthlySnapshots.length,
    payoffDate: monthlySnapshots.length > 0 ? monthlySnapshots[monthlySnapshots.length - 1].date : formatMonthYear(startDate),
    totalInterest,
    totalPaid,
    startingBalance,
    monthlySnapshots,
    debtSchedules,
  };
}

/**
 * Compare both strategies side-by-side.
 */
export function compareStrategies(
  debts: DebtInput[],
  extraPayment: number,
  startDate?: Date,
): {
  avalanche: DebtPayoffResult;
  snowball: DebtPayoffResult;
  winner: "avalanche" | "snowball" | "tie";
  interestSaved: number;
  monthsSaved: number;
} {
  const avalanche = calculatePayoff(debts, extraPayment, "avalanche", startDate);
  const snowball = calculatePayoff(debts, extraPayment, "snowball", startDate);

  const interestSaved = snowball.totalInterest - avalanche.totalInterest;
  const monthsSaved = snowball.months - avalanche.months;

  let winner: "avalanche" | "snowball" | "tie" = "tie";
  if (avalanche.totalInterest < snowball.totalInterest && avalanche.months <= snowball.months) {
    winner = "avalanche";
  } else if (snowball.totalInterest < avalanche.totalInterest && snowball.months <= avalanche.months) {
    winner = "snowball";
  } else if (avalanche.months < snowball.months) {
    winner = "avalanche";
  } else if (snowball.months < avalanche.months) {
    winner = "snowball";
  }

  return { avalanche, snowball, winner, interestSaved, monthsSaved };
}

/**
 * Calculate minimum total monthly payment required to avoid growing debt.
 */
export function calculateMinimumTotalPayment(debts: DebtInput[]): number {
  return debts.reduce((sum, d) => {
    if (d.remainingAmount <= 0) return sum;
    const monthlyRate = d.interestRate / 100 / 12;
    const interest = d.remainingAmount * monthlyRate;
    return sum + Math.max(d.minimumPayment, interest + 0.01);
  }, 0);
}


/**
 * Calculate payoff with a custom debt priority order.
 * @param customOrder — array of debt IDs in desired payoff order
 */
export function calculateCustomPayoff(
  debts: DebtInput[],
  extraPayment: number,
  customOrder: string[],
  startDate: Date = new Date(),
): DebtPayoffResult {
  // Validate custom order contains all active debts
  const activeIds = new Set(debts.filter((d) => d.remainingAmount > 0).map((d) => d.id));
  const orderedIds = customOrder.filter((id) => activeIds.has(id));
  const missing = debts.filter((d) => d.remainingAmount > 0 && !orderedIds.includes(d.id));
  const finalOrder = [...orderedIds, ...missing.map((d) => d.id)];

  // Reorder debts according to custom order
  const orderedDebts = finalOrder
    .map((id) => debts.find((d) => d.id === id)!)
    .filter(Boolean);

  return calculatePayoffWithOrder(orderedDebts, extraPayment, startDate, "custom", finalOrder);
}

/** Internal: run simulation with a forced debt order. */
function calculatePayoffWithOrder(
  debts: DebtInput[],
  extraPayment: number,
  startDate: Date,
  strategy: "avalanche" | "snowball" | "custom",
  forcedOrder: string[],
): DebtPayoffResult {
  if (debts.length === 0) {
    return {
      strategy,
      debtOrder: [],
      months: 0,
      payoffDate: formatMonthYear(startDate),
      totalInterest: 0,
      totalPaid: 0,
      startingBalance: 0,
      monthlySnapshots: [],
      debtSchedules: [],
    };
  }

  let simDebts = debts
    .filter((d) => d.remainingAmount > 0)
    .map((d) => ({
      ...d,
      currentBalance: d.remainingAmount,
      totalInterestPaid: 0,
      totalPaid: 0,
      isPaidOff: false,
      monthlyBreakdown: [] as {
        month: number;
        startingBalance: number;
        interest: number;
        payment: number;
        principalPaid: number;
        endingBalance: number;
      }[],
    }));

  // Respect forced order
  const orderMap = new Map(forcedOrder.map((id, i) => [id, i]));
  simDebts.sort((a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999));

  const debtOrder = simDebts.map((d) => d.id);
  const startingBalance = simDebts.reduce((s, d) => s + d.remainingAmount, 0);

  let month = 0;
  let totalInterest = 0;
  let totalPaid = 0;
  const monthlySnapshots: MonthlySnapshot[] = [];
  const maxMonths = 600;

  while (simDebts.some((d) => !d.isPaidOff) && month < maxMonths) {
    month++;
    let monthTotalBalance = 0;
    let monthTotalPaid = 0;
    let monthTotalInterest = 0;
    let availableExtra = extraPayment;

    const minPayments = simDebts.map((d) => {
      if (d.isPaidOff) return { debt: d, minPayment: 0, interest: 0 };
      const monthlyRate = d.interestRate / 100 / 12;
      const interest = d.currentBalance * monthlyRate;
      const minPayment = Math.max(d.minimumPayment, interest + 0.01);
      return { debt: d, minPayment, interest };
    });

    for (let i = 0; i < simDebts.length; i++) {
      const d = simDebts[i];
      if (d.isPaidOff) continue;

      const mp = minPayments[i];
      let payment = mp.minPayment;

      if (availableExtra > 0 && !d.isPaidOff) {
        payment += availableExtra;
        availableExtra = 0;
      }

      const maxPayment = d.currentBalance + mp.interest;
      if (payment > maxPayment) {
        availableExtra += payment - maxPayment;
        payment = maxPayment;
      }

      const principalPaid = payment - mp.interest;
      const newBalance = Math.max(d.currentBalance - principalPaid, 0);

      d.totalInterestPaid += mp.interest;
      d.totalPaid += payment;
      totalInterest += mp.interest;
      totalPaid += payment;
      monthTotalInterest += mp.interest;
      monthTotalPaid += payment;

      d.monthlyBreakdown.push({
        month,
        startingBalance: d.currentBalance,
        interest: mp.interest,
        payment,
        principalPaid,
        endingBalance: newBalance,
      });

      d.currentBalance = newBalance;
      if (newBalance <= 0.005) {
        d.isPaidOff = true;
      }

      monthTotalBalance += d.currentBalance;
    }

    monthlySnapshots.push({
      month,
      date: formatMonthYear(addMonths(startDate, month)),
      totalBalance: monthTotalBalance,
      totalPaid: totalPaid,
      totalInterest: totalInterest,
    });
  }

  const debtSchedules: DebtSchedule[] = simDebts.map((d) => {
    const payoffEntry = d.monthlyBreakdown.find((m) => m.endingBalance <= 0.005);
    const payoffMonth = payoffEntry ? payoffEntry.month : month;
    return {
      debtId: d.id,
      name: d.name,
      color: d.color,
      monthsToPayoff: payoffMonth,
      payoffMonth,
      totalInterest: d.totalInterestPaid,
      totalPaid: d.totalPaid,
      monthlyBreakdown: d.monthlyBreakdown,
    };
  });

  return {
    strategy,
    debtOrder,
    months: monthlySnapshots.length,
    payoffDate: monthlySnapshots.length > 0 ? monthlySnapshots[monthlySnapshots.length - 1].date : formatMonthYear(startDate),
    totalInterest,
    totalPaid,
    startingBalance,
    monthlySnapshots,
    debtSchedules,
  };
}

/**
 * Compare all three strategies side-by-side.
 */
export function compareAllStrategies(
  debts: DebtInput[],
  extraPayment: number,
  customOrder: string[],
  startDate?: Date,
): {
  avalanche: DebtPayoffResult;
  snowball: DebtPayoffResult;
  custom: DebtPayoffResult;
  bestInterest: "avalanche" | "snowball" | "custom";
  bestMonths: "avalanche" | "snowball" | "custom";
} {
  const avalanche = calculatePayoff(debts, extraPayment, "avalanche", startDate);
  const snowball = calculatePayoff(debts, extraPayment, "snowball", startDate);
  const custom = calculateCustomPayoff(debts, extraPayment, customOrder, startDate);

  const results = { avalanche, snowball, custom };

  const bestInterest = (Object.keys(results) as Array<keyof typeof results>).reduce((best, key) =>
    results[key].totalInterest < results[best].totalInterest ? key : best
  , "avalanche" as "avalanche" | "snowball" | "custom");

  const bestMonths = (Object.keys(results) as Array<keyof typeof results>).reduce((best, key) =>
    results[key].months < results[best].months ? key : best
  , "avalanche" as "avalanche" | "snowball" | "custom");

  return { avalanche, snowball, custom, bestInterest, bestMonths };
}
