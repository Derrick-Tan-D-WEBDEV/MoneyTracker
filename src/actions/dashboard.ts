"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getExchangeRates, convertCurrency } from "@/lib/exchange-rates";
import { getViewUser, isPartnerView } from "@/lib/partner-view";

export async function getDashboardData() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const { id: userId, currency: userCurrency } = await getViewUser();
  const rates = await getExchangeRates(userCurrency);
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  // Helper: convert amount from account currency to user currency
  const toUser = (amount: number, fromCurrency: string) => convertCurrency(amount, fromCurrency, userCurrency, rates);

  // Get all financial accounts for net worth
  const accounts = await db.financialAccount.findMany({
    where: { userId, isArchived: false },
  });

  // Get active debts for net worth
  const debts = await db.debt.findMany({
    where: { userId, isPaidOff: false },
  });

  const accountBalance = accounts.reduce((sum, acc) => {
    const converted = toUser(Number(acc.balance), acc.currency);
    if (acc.type === "CREDIT_CARD") {
      // Balance = available credit; liability = creditLimit - balance
      const limit = acc.creditLimit ? toUser(Number(acc.creditLimit), acc.currency) : 0;
      return sum - (limit - converted);
    }
    return sum + converted;
  }, 0);

  const totalDebt = debts.reduce((sum, d) => {
    return sum + toUser(Number(d.remainingAmount), d.currency);
  }, 0);

  const totalBalance = accountBalance - totalDebt;

  // Auto-record daily net worth snapshot (only for own data, not partner view)
  if (!(await isPartnerView())) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    db.netWorthSnapshot
      .upsert({
        where: { userId_date: { userId, date: today } },
        update: { netWorth: totalBalance },
        create: { userId, date: today, netWorth: totalBalance },
      })
      .catch(() => {});
  }

  // Current month transactions
  const currentMonthTransactions = await db.transaction.findMany({
    where: {
      userId,
      isRecurring: false,
      isAdjustment: false,
      date: { gte: startOfMonth, lte: now },
    },
    include: { category: true, account: true },
  });

  // Last month transactions
  const lastMonthTransactions = await db.transaction.findMany({
    where: {
      userId,
      isRecurring: false,
      isAdjustment: false,
      date: { gte: startOfLastMonth, lte: endOfLastMonth },
    },
    include: { account: true },
  });

  const currentIncome = currentMonthTransactions.filter((t) => t.type === "INCOME").reduce((sum, t) => sum + toUser(Number(t.amount), t.account.currency), 0);

  const currentExpenses = currentMonthTransactions.filter((t) => t.type === "EXPENSE").reduce((sum, t) => sum + toUser(Number(t.amount), t.account.currency), 0);

  const lastIncome = lastMonthTransactions.filter((t) => t.type === "INCOME").reduce((sum, t) => sum + toUser(Number(t.amount), t.account.currency), 0);

  const lastExpenses = lastMonthTransactions.filter((t) => t.type === "EXPENSE").reduce((sum, t) => sum + toUser(Number(t.amount), t.account.currency), 0);

  // Spending by category
  const spendingByCategory = currentMonthTransactions
    .filter((t) => t.type === "EXPENSE" && t.category)
    .reduce(
      (acc, t) => {
        const catName = t.category!.name;
        const catColor = t.category!.color;
        if (!acc[catName]) acc[catName] = { amount: 0, color: catColor };
        acc[catName].amount += toUser(Number(t.amount), t.account.currency);
        return acc;
      },
      {} as Record<string, { amount: number; color: string }>,
    );

  const topCategories = Object.entries(spendingByCategory)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  // Budgets with spending
  const budgets = await db.budget.findMany({
    where: { userId },
    include: { category: true },
  });

  const budgetProgress = await Promise.all(
    budgets.map(async (budget) => {
      const spent = currentMonthTransactions.filter((t) => t.type === "EXPENSE" && t.categoryId === budget.categoryId).reduce((sum, t) => sum + toUser(Number(t.amount), t.account.currency), 0);
      const limit = toUser(Number(budget.amount), budget.currency || userCurrency);
      return {
        id: budget.id,
        category: budget.category.name,
        categoryColor: budget.category.color,
        limit,
        spent,
        percentage: limit > 0 ? (spent / limit) * 100 : 0,
      };
    }),
  );

  // Investments
  const investments = await db.investment.findMany({
    where: { userId },
  });

  const totalInvested = investments.reduce((sum, inv) => sum + toUser(Number(inv.buyPrice) * Number(inv.quantity), inv.currency), 0);

  const totalCurrentValue = investments.reduce((sum, inv) => sum + toUser(Number(inv.currentPrice) * Number(inv.quantity), inv.currency), 0);

  const investmentByType = investments.reduce(
    (acc, inv) => {
      const type = inv.type;
      if (!acc[type]) acc[type] = 0;
      acc[type] += toUser(Number(inv.currentPrice) * Number(inv.quantity), inv.currency);
      return acc;
    },
    {} as Record<string, number>,
  );

  // Goals
  const goals = await db.goal.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const goalsData = goals.map((g) => {
    const goalCurrency = g.currency || userCurrency;
    const targetAmount = toUser(Number(g.targetAmount), goalCurrency);
    const currentAmount = toUser(Number(g.currentAmount), goalCurrency);
    return {
      id: g.id,
      name: g.name,
      targetAmount,
      currentAmount,
      type: g.type,
      deadline: g.deadline?.toISOString() || null,
      color: g.color,
      percentage: targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0,
    };
  });

  // Monthly trend (last 12 months)
  const monthlyTrend = [];
  for (let i = 11; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    const monthName = monthStart.toLocaleDateString("en", { month: "short" });

    const monthTransactions = await db.transaction.findMany({
      where: {
        userId,
        isRecurring: false,
        isAdjustment: false,
        date: { gte: monthStart, lte: monthEnd },
      },
      include: { account: true },
    });

    const income = monthTransactions.filter((t) => t.type === "INCOME").reduce((sum, t) => sum + toUser(Number(t.amount), t.account.currency), 0);

    const expenses = monthTransactions.filter((t) => t.type === "EXPENSE").reduce((sum, t) => sum + toUser(Number(t.amount), t.account.currency), 0);

    monthlyTrend.push({
      month: monthName,
      income,
      expenses,
      savings: income - expenses,
    });
  }

  // Debts (all, for dashboard section)
  const allDebts = await db.debt.findMany({
    where: { userId },
  });

  const totalDebtAll = allDebts.reduce((sum, d) => sum + toUser(Number(d.remainingAmount), d.currency), 0);
  const totalDebtPaid = allDebts.reduce((sum, d) => sum + toUser(Number(d.originalAmount) - Number(d.remainingAmount), d.currency), 0);
  const activeDebts = allDebts.filter((d) => Number(d.remainingAmount) > 0);

  // Installments
  const installments = await db.installment.findMany({
    where: { userId, isCompleted: false },
  });
  const totalInstallmentRemaining = installments.reduce((sum, i) => {
    const monthlyPayment = Number(i.monthlyPayment);
    const remaining = monthlyPayment * (i.totalMonths - i.paidMonths);
    return sum + toUser(remaining, i.currency);
  }, 0);
  const totalInstallmentMonthly = installments.reduce((sum, i) => sum + toUser(Number(i.monthlyPayment), i.currency), 0);

  // Recent transactions
  const recentTransactions = await db.transaction.findMany({
    where: { userId, isRecurring: false, isAdjustment: false },
    include: { category: true, account: true },
    orderBy: { date: "desc" },
    take: 5,
  });

  return {
    netWorth: totalBalance,
    netWorthChange: lastExpenses + lastIncome > 0 ? ((currentIncome - currentExpenses - (lastIncome - lastExpenses)) / Math.max(lastIncome - lastExpenses, 1)) * 100 : 0,
    currentMonth: {
      income: currentIncome,
      expenses: currentExpenses,
      savings: currentIncome - currentExpenses,
    },
    budgetProgress,
    investments: {
      totalInvested,
      totalCurrentValue,
      totalReturn: totalCurrentValue - totalInvested,
      returnPercentage: totalInvested > 0 ? ((totalCurrentValue - totalInvested) / totalInvested) * 100 : 0,
      byType: Object.entries(investmentByType).map(([type, value]) => ({
        type,
        value,
      })),
    },
    goals: goalsData,
    topCategories,
    monthlyTrend,
    recentTransactions: recentTransactions.map((t) => ({
      id: t.id,
      description: t.description,
      amount: Number(t.amount),
      type: t.type,
      date: t.date.toISOString(),
      category: t.category?.name || "Uncategorized",
      categoryColor: t.category?.color || "#6B7280",
      account: t.account.name,
      currency: t.account.currency,
    })),
    accounts: accounts.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      balance: Number(a.balance),
      currency: a.currency,
      color: a.color,
    })),
    debts: {
      totalDebt: totalDebtAll,
      totalDebtPaid,
      activeCount: activeDebts.length,
      items: activeDebts.slice(0, 3).map((d) => ({
        id: d.id,
        name: d.name,
        type: d.type,
        remainingAmount: Number(d.remainingAmount),
        originalAmount: Number(d.originalAmount),
        percentage: Number(d.originalAmount) > 0 ? ((Number(d.originalAmount) - Number(d.remainingAmount)) / Number(d.originalAmount)) * 100 : 0,
      })),
    },
    installments: {
      totalRemaining: totalInstallmentRemaining,
      monthlyTotal: totalInstallmentMonthly,
      activeCount: installments.length,
    },
  };
}
