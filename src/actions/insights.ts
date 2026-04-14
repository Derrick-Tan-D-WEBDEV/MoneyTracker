"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getExchangeRates, convertCurrency } from "@/lib/exchange-rates";

export async function getSpendingInsights() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;
  const userCurrency = session.user.currency || "USD";
  const rates = await getExchangeRates(userCurrency);
  const toUser = (amount: number, from: string) => convertCurrency(amount, from, userCurrency, rates);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
  const startOfTwoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const endOfTwoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 1, 0);

  // Current month expenses
  const currentExpenses = await db.transaction.findMany({
    where: { userId, isRecurring: false, isAdjustment: false, type: "EXPENSE", date: { gte: startOfMonth, lte: now } },
    include: { category: true, account: true },
  });

  // Last month expenses
  const lastExpenses = await db.transaction.findMany({
    where: { userId, isRecurring: false, isAdjustment: false, type: "EXPENSE", date: { gte: startOfLastMonth, lte: endOfLastMonth } },
    include: { category: true, account: true },
  });

  // Two months ago expenses
  const twoMonthsAgoExpenses = await db.transaction.findMany({
    where: { userId, isRecurring: false, isAdjustment: false, type: "EXPENSE", date: { gte: startOfTwoMonthsAgo, lte: endOfTwoMonthsAgo } },
    include: { category: true, account: true },
  });

  // Current month total
  const currentTotal = currentExpenses.reduce((s, t) => s + toUser(Number(t.amount), t.account.currency), 0);
  const lastTotal = lastExpenses.reduce((s, t) => s + toUser(Number(t.amount), t.account.currency), 0);
  const twoMonthsTotal = twoMonthsAgoExpenses.reduce((s, t) => s + toUser(Number(t.amount), t.account.currency), 0);

  // Daily spending rate
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dailyAvg = currentTotal / Math.max(dayOfMonth, 1);
  const projectedMonthly = dailyAvg * daysInMonth;

  // Category comparison with last month
  const currentByCat = new Map<string, { amount: number; name: string; color: string }>();
  for (const t of currentExpenses) {
    const key = t.category?.name || "Uncategorized";
    const existing = currentByCat.get(key) || { amount: 0, name: key, color: t.category?.color || "#6B7280" };
    existing.amount += toUser(Number(t.amount), t.account.currency);
    currentByCat.set(key, existing);
  }

  const lastByCat = new Map<string, number>();
  for (const t of lastExpenses) {
    const key = t.category?.name || "Uncategorized";
    lastByCat.set(key, (lastByCat.get(key) || 0) + toUser(Number(t.amount), t.account.currency));
  }

  // Categories that increased most
  const categoryChanges = Array.from(currentByCat.entries())
    .map(([key, cur]) => {
      const lastAmount = lastByCat.get(key) || 0;
      const change = lastAmount > 0 ? ((cur.amount - lastAmount) / lastAmount) * 100 : 100;
      return { name: cur.name, color: cur.color, current: cur.amount, previous: lastAmount, changePercent: change };
    })
    .sort((a, b) => b.changePercent - a.changePercent);

  // Spending insights messages
  const insights: { type: "warning" | "success" | "info"; message: string }[] = [];

  if (lastTotal > 0 && projectedMonthly > lastTotal * 1.2) {
    insights.push({ type: "warning", message: `At your current pace, you'll spend ${((projectedMonthly / lastTotal - 1) * 100).toFixed(0)}% more than last month.` });
  } else if (lastTotal > 0 && projectedMonthly < lastTotal * 0.8) {
    insights.push({ type: "success", message: `You're on track to spend ${((1 - projectedMonthly / lastTotal) * 100).toFixed(0)}% less than last month.` });
  }

  const biggestIncrease = categoryChanges.find((c) => c.changePercent > 50 && c.current > 10);
  if (biggestIncrease) {
    insights.push({ type: "warning", message: `${biggestIncrease.name} spending up ${biggestIncrease.changePercent.toFixed(0)}% vs last month.` });
  }

  const biggestDecrease = categoryChanges.filter((c) => c.changePercent < -30 && c.previous > 10).sort((a, b) => a.changePercent - b.changePercent)[0];
  if (biggestDecrease) {
    insights.push({ type: "success", message: `${biggestDecrease.name} spending down ${Math.abs(biggestDecrease.changePercent).toFixed(0)}% vs last month.` });
  }

  // 3-month trend
  const threeMonthAvg = (lastTotal + twoMonthsTotal) / 2;
  if (threeMonthAvg > 0 && currentTotal > threeMonthAvg * 1.3 && dayOfMonth > 15) {
    insights.push({ type: "warning", message: "Spending is above your 3-month average." });
  }

  if (insights.length === 0) {
    insights.push({ type: "info", message: "Spending looks normal this month." });
  }

  return {
    currentTotal,
    lastTotal,
    projectedMonthly,
    dailyAvg,
    daysRemaining: daysInMonth - dayOfMonth,
    categoryChanges: categoryChanges.slice(0, 5),
    insights,
  };
}
