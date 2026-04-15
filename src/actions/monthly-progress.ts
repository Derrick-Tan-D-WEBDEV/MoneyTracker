"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getExchangeRates, convertCurrency } from "@/lib/exchange-rates";
import { getViewUser } from "@/lib/partner-view";
import { getEncryptionKey, decryptAmount } from "@/lib/encryption";

export interface MonthlyProgress {
  // Debts
  activeDebts: number;
  totalDebtRemaining: number;
  debtPaidThisMonth: number;

  // Installments
  activeInstallments: number;
  installmentMonthlyTotal: number;
  installmentsCompletingSoon: number; // within 3 months

  // Goals
  activeGoals: number;
  totalGoalProgress: number; // percentage
  goalContributionsThisMonth: number;

  // Savings
  totalSavingsBalance: number;
  projectedInterestMonthly: number;

  // Assets
  totalAssetValue: number;
  totalAssetCount: number;

  // Overall
  upcomingBills: { name: string; amount: number; dueDay: number; type: string }[];
  monthLabel: string;
}

export async function getMonthlyProgress(): Promise<MonthlyProgress> {
  const { id: userId, currency: userCurrency } = await getViewUser();
  const encKey = await getEncryptionKey();

  const rates = await getExchangeRates(userCurrency);
  const now = new Date();
  const monthLabel = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // Debts
  const debts = await db.debt.findMany({
    where: { userId, isPaidOff: false },
  });

  const totalDebtRemaining = debts.reduce((s, d) => s + convertCurrency(decryptAmount(d.remainingAmount, encKey), d.currency, userCurrency, rates), 0);

  // Estimate debt paid this month: sum of minimum payments
  const debtPaidThisMonth = debts.reduce((s, d) => s + convertCurrency(decryptAmount(d.minimumPayment, encKey), d.currency, userCurrency, rates), 0);

  // Installments
  const installments = await db.installment.findMany({
    where: { userId, isCompleted: false },
    include: { account: true },
  });

  const installmentMonthlyTotal = installments.reduce((s, i) => s + convertCurrency(decryptAmount(i.monthlyPayment, encKey), i.currency, userCurrency, rates), 0);

  const installmentsCompletingSoon = installments.filter((i) => i.totalMonths - i.paidMonths <= 3).length;

  // Goals
  const goals = await db.goal.findMany({
    where: { userId },
  });

  const activeGoals = goals.filter((g) => decryptAmount(g.currentAmount, encKey) < decryptAmount(g.targetAmount, encKey));
  const totalTargetSum = activeGoals.reduce((s, g) => s + convertCurrency(decryptAmount(g.targetAmount, encKey), g.currency || userCurrency, userCurrency, rates), 0);
  const totalCurrentSum = activeGoals.reduce((s, g) => s + convertCurrency(decryptAmount(g.currentAmount, encKey), g.currency || userCurrency, userCurrency, rates), 0);
  const totalGoalProgress = totalTargetSum > 0 ? (totalCurrentSum / totalTargetSum) * 100 : 0;
  const goalContributionsThisMonth = activeGoals.reduce((s, g) => s + convertCurrency(decryptAmount(g.monthlyContribution, encKey), g.currency || userCurrency, userCurrency, rates), 0);

  // Savings accounts
  const savingsAccounts = await db.financialAccount.findMany({
    where: { userId, type: "SAVINGS" },
  });

  const totalSavingsBalance = savingsAccounts.reduce((s, a) => s + convertCurrency(decryptAmount(a.balance, encKey) - decryptAmount(a.reservedAmount, encKey), a.currency, userCurrency, rates), 0);

  // Assets
  const activeAssets = await db.asset.findMany({
    where: { userId, isSold: false },
  });

  const totalAssetValue = activeAssets.reduce((s, a) => s + convertCurrency(decryptAmount(a.currentValue, encKey), a.currency, userCurrency, rates), 0);

  // Project monthly interest from goals with interest rates
  const projectedInterestMonthly = goals.reduce((s, g) => {
    const rate = decryptAmount(g.interestRate, encKey);
    if (rate <= 0) return s;
    const monthlyInterest = decryptAmount(g.currentAmount, encKey) * (rate / 100 / 12);
    return s + convertCurrency(monthlyInterest, g.currency || userCurrency, userCurrency, rates);
  }, 0);

  // Upcoming bills this month (debts by due day, installments)
  const today = now.getDate();
  const upcomingBills: MonthlyProgress["upcomingBills"] = [];

  for (const d of debts) {
    if (d.dueDay && d.dueDay >= today) {
      upcomingBills.push({
        name: d.name,
        amount: convertCurrency(decryptAmount(d.minimumPayment, encKey), d.currency, userCurrency, rates),
        dueDay: d.dueDay,
        type: "debt",
      });
    }
  }

  for (const i of installments) {
    // Assume installment due on start date's day
    const startDay = i.startDate.getDate();
    if (startDay >= today) {
      upcomingBills.push({
        name: i.name,
        amount: convertCurrency(decryptAmount(i.monthlyPayment, encKey), i.currency, userCurrency, rates),
        dueDay: startDay,
        type: "installment",
      });
    }
  }

  upcomingBills.sort((a, b) => a.dueDay - b.dueDay);

  return {
    activeDebts: debts.length,
    totalDebtRemaining: Math.round(totalDebtRemaining * 100) / 100,
    debtPaidThisMonth: Math.round(debtPaidThisMonth * 100) / 100,
    activeInstallments: installments.length,
    installmentMonthlyTotal: Math.round(installmentMonthlyTotal * 100) / 100,
    installmentsCompletingSoon,
    activeGoals: activeGoals.length,
    totalGoalProgress: Math.round(totalGoalProgress * 10) / 10,
    goalContributionsThisMonth: Math.round(goalContributionsThisMonth * 100) / 100,
    totalSavingsBalance: Math.round(totalSavingsBalance * 100) / 100,
    projectedInterestMonthly: Math.round(projectedInterestMonthly * 100) / 100,
    totalAssetValue: Math.round(totalAssetValue * 100) / 100,
    totalAssetCount: activeAssets.length,
    upcomingBills: upcomingBills.slice(0, 5),
    monthLabel,
  };
}
