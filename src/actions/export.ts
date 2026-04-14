"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getExchangeRates, convertCurrency } from "@/lib/exchange-rates";

export async function getExportData(options: { startDate?: string; endDate?: string; type?: string }) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;
  const userCurrency = session.user.currency || "USD";
  const rates = await getExchangeRates(userCurrency);

  const where: Record<string, unknown> = {
    userId,
    isRecurring: false,
    isAdjustment: false,
  };

  if (options.type && options.type !== "ALL") where.type = options.type;
  if (options.startDate || options.endDate) {
    where.date = {};
    if (options.startDate) (where.date as Record<string, Date>).gte = new Date(options.startDate);
    if (options.endDate) (where.date as Record<string, Date>).lte = new Date(options.endDate);
  }

  const transactions = await db.transaction.findMany({
    where,
    include: { category: true, account: true, tags: true },
    orderBy: { date: "desc" },
  });

  const accounts = await db.financialAccount.findMany({
    where: { userId, isArchived: false },
  });

  const budgets = await db.budget.findMany({
    where: { userId },
    include: { category: true },
  });

  return {
    transactions: transactions.map((t) => ({
      date: t.date.toISOString(),
      description: t.description,
      type: t.type,
      category: t.category?.name || "",
      account: t.account.name,
      accountCurrency: t.account.currency,
      amount: Number(t.amount),
      amountInUserCurrency: convertCurrency(Number(t.amount), t.account.currency, userCurrency, rates),
      tags: t.tags.map((tag) => tag.name).join(", "),
      notes: t.notes || "",
    })),
    accounts: accounts.map((a) => ({
      name: a.name,
      type: a.type,
      balance: Number(a.balance),
      currency: a.currency,
    })),
    budgets: budgets.map((b) => ({
      category: b.category.name,
      limit: Number(b.amount),
      period: b.period,
    })),
    userCurrency,
    exportDate: new Date().toISOString(),
  };
}
