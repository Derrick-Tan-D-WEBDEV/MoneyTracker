"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getExchangeRates, convertCurrency } from "@/lib/exchange-rates";
import { getViewUserId } from "@/lib/partner-view";

export interface CalendarEvent {
  id: string;
  name: string;
  amount: number;
  currency: string;
  date: string;
  type: "debt" | "installment" | "recurring" | "subscription";
  color: string;
}

export async function getBillCalendarData(month?: number, year?: number) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = await getViewUserId();
  const now = new Date();
  const targetMonth = month ?? now.getMonth();
  const targetYear = year ?? now.getFullYear();

  const events: CalendarEvent[] = [];

  // Debts with dueDay
  const debts = await db.debt.findMany({
    where: { userId, isPaidOff: false, dueDay: { not: null } },
  });
  for (const debt of debts) {
    if (debt.dueDay) {
      const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
      const day = Math.min(debt.dueDay, daysInMonth);
      events.push({
        id: `debt-${debt.id}`,
        name: debt.name,
        amount: Number(debt.minimumPayment),
        currency: debt.currency,
        date: new Date(targetYear, targetMonth, day).toISOString(),
        type: "debt",
        color: "#EF4444",
      });
    }
  }

  // Active installments (monthly payment)
  const installments = await db.installment.findMany({
    where: { userId, isCompleted: false },
  });
  for (const inst of installments) {
    const startDay = inst.startDate.getDate();
    const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const day = Math.min(startDay, daysInMonth);
    events.push({
      id: `inst-${inst.id}`,
      name: inst.name,
      amount: Number(inst.monthlyPayment),
      currency: inst.currency,
      date: new Date(targetYear, targetMonth, day).toISOString(),
      type: "installment",
      color: "#F59E0B",
    });
  }

  // Recurring rules
  const recurringRules = await db.recurringRule.findMany({
    where: { isActive: true, transaction: { userId } },
    include: { transaction: { include: { account: true } } },
  });
  for (const rule of recurringRules) {
    const tx = rule.transaction;
    if (tx.type !== "EXPENSE") continue;
    // Check if nextDue falls in target month
    const nextDue = rule.nextDue;
    if (nextDue.getMonth() === targetMonth && nextDue.getFullYear() === targetYear) {
      events.push({
        id: `rec-${rule.id}`,
        name: tx.description,
        amount: Number(tx.amount),
        currency: tx.account.currency,
        date: nextDue.toISOString(),
        type: "recurring",
        color: "#8B5CF6",
      });
    }
  }

  // Subscriptions
  const subscriptions = await db.subscription.findMany({
    where: { userId, isActive: true },
  });
  for (const sub of subscriptions) {
    const billingDay = sub.nextBillingDate.getDate();
    const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const day = Math.min(billingDay, daysInMonth);
    if (sub.frequency === "MONTHLY" || sub.frequency === "WEEKLY") {
      events.push({
        id: `sub-${sub.id}`,
        name: sub.name,
        amount: Number(sub.amount),
        currency: sub.currency,
        date: new Date(targetYear, targetMonth, day).toISOString(),
        type: "subscription",
        color: sub.color,
      });
    }
  }

  // Sort by date
  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Fetch exchange rates for currency conversion in totals
  const userCurrency = session.user.currency || "SGD";
  const rates = await getExchangeRates(userCurrency);

  return { events, month: targetMonth, year: targetYear, userCurrency, rates };
}
