"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getExchangeRates, convertCurrency } from "@/lib/exchange-rates";

export async function getReportData(year?: number) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userCurrency = session.user.currency || "MYR";
  const rates = await getExchangeRates(userCurrency);
  const toUser = (amount: number, from: string) => convertCurrency(amount, from, userCurrency, rates);

  const targetYear = year || new Date().getFullYear();
  const startOfYear = new Date(targetYear, 0, 1);
  const endOfYear = new Date(targetYear + 1, 0, 1);

  const transactions = await db.transaction.findMany({
    where: {
      userId: session.user.id,
      isRecurring: false,
      isAdjustment: false,
      date: { gte: startOfYear, lt: endOfYear },
    },
    include: { category: true, account: true },
    orderBy: { date: "asc" },
  });

  // Monthly breakdown
  const monthlyData = Array.from({ length: 12 }, (_, i) => ({
    month: new Date(targetYear, i).toLocaleString("en-US", { month: "short" }),
    monthNum: i,
    income: 0,
    expenses: 0,
    savings: 0,
  }));

  for (const t of transactions) {
    const month = t.date.getMonth();
    const amount = toUser(Number(t.amount), t.account.currency);
    if (t.type === "INCOME") {
      monthlyData[month].income += amount;
    } else if (t.type === "EXPENSE") {
      monthlyData[month].expenses += amount;
    }
  }

  for (const m of monthlyData) {
    m.savings = m.income - m.expenses;
  }

  // Category breakdown
  const categoryMap = new Map<string, { name: string; color: string; income: number; expenses: number }>();
  for (const t of transactions) {
    const catName = t.category?.name || "Uncategorized";
    const catColor = t.category?.color || "#6B7280";
    const existing = categoryMap.get(catName) || { name: catName, color: catColor, income: 0, expenses: 0 };
    const amount = toUser(Number(t.amount), t.account.currency);
    if (t.type === "INCOME") existing.income += amount;
    else if (t.type === "EXPENSE") existing.expenses += amount;
    categoryMap.set(catName, existing);
  }

  const categoryBreakdown = Array.from(categoryMap.values()).sort((a, b) => b.expenses - a.expenses);

  // Summary stats
  const totalIncome = monthlyData.reduce((s, m) => s + m.income, 0);
  const totalExpenses = monthlyData.reduce((s, m) => s + m.expenses, 0);
  const totalSavings = totalIncome - totalExpenses;
  const avgMonthlyIncome = totalIncome / 12;
  const avgMonthlyExpenses = totalExpenses / 12;
  const savingsRate = totalIncome > 0 ? (totalSavings / totalIncome) * 100 : 0;

  // Top spending month
  const topSpendingMonth = monthlyData.reduce((max, m) => (m.expenses > max.expenses ? m : max), monthlyData[0]);

  // Net worth trend (cumulative savings by month)
  let cumulativeSavings = 0;
  const netWorthTrend = monthlyData.map((m) => {
    cumulativeSavings += m.savings;
    return { month: m.month, netWorth: cumulativeSavings };
  });

  // Daily spending heatmap data (for the year)
  const dailySpending: { date: string; amount: number }[] = [];
  const dailyMap = new Map<string, number>();
  for (const t of transactions) {
    if (t.type === "EXPENSE") {
      const key = t.date.toISOString().split("T")[0];
      dailyMap.set(key, (dailyMap.get(key) || 0) + toUser(Number(t.amount), t.account.currency));
    }
  }
  for (const [date, amount] of dailyMap) {
    dailySpending.push({ date, amount });
  }

  return {
    year: targetYear,
    monthlyData,
    categoryBreakdown,
    netWorthTrend,
    dailySpending,
    summary: {
      totalIncome,
      totalExpenses,
      totalSavings,
      avgMonthlyIncome,
      avgMonthlyExpenses,
      savingsRate,
      topSpendingMonth: topSpendingMonth.month,
      topSpendingAmount: topSpendingMonth.expenses,
      transactionCount: transactions.length,
    },
  };
}
