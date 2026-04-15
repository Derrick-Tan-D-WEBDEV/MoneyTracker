"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getExchangeRates, convertCurrency } from "@/lib/exchange-rates";
import { getViewUser } from "@/lib/partner-view";
import { getEncryptionKey, decrypt, decryptAmount } from "@/lib/encryption";

export async function getExportData(options: { startDate?: string; endDate?: string; type?: string }) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const { id: userId, currency: userCurrency } = await getViewUser();
  const encKey = await getEncryptionKey();
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
      description: decrypt(t.description, encKey),
      type: t.type,
      category: t.category?.name || "",
      account: decrypt(t.account.name, encKey),
      accountCurrency: t.account.currency,
      amount: decryptAmount(t.amount, encKey),
      amountInUserCurrency: convertCurrency(decryptAmount(t.amount, encKey), t.account.currency, userCurrency, rates),
      tags: t.tags.map((tag) => decrypt(tag.name, encKey)).join(", "),
      notes: t.notes ? decrypt(t.notes, encKey) : "",
    })),
    accounts: accounts.map((a) => ({
      name: decrypt(a.name, encKey),
      type: a.type,
      balance: decryptAmount(a.balance, encKey),
      reservedAmount: decryptAmount(a.reservedAmount, encKey),
      currency: a.currency,
    })),
    budgets: budgets.map((b) => ({
      category: b.category.name,
      limit: decryptAmount(b.amount, encKey),
      period: b.period,
    })),
    userCurrency,
    exportDate: new Date().toISOString(),
  };
}
