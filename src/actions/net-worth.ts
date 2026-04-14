"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getExchangeRates, convertCurrency } from "@/lib/exchange-rates";

export async function takeNetWorthSnapshot() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;
  const userCurrency = session.user.currency || "USD";
  const rates = await getExchangeRates(userCurrency);

  const accounts = await db.financialAccount.findMany({
    where: { userId, isArchived: false },
  });

  const netWorth = accounts.reduce((sum, acc) => sum + convertCurrency(Number(acc.balance), acc.currency, userCurrency, rates), 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await db.netWorthSnapshot.upsert({
    where: { userId_date: { userId, date: today } },
    update: { netWorth },
    create: { userId, date: today, netWorth },
  });

  return netWorth;
}

export async function getNetWorthHistory(months = 12) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const since = new Date();
  since.setMonth(since.getMonth() - months);

  const snapshots = await db.netWorthSnapshot.findMany({
    where: {
      userId: session.user.id,
      date: { gte: since },
    },
    orderBy: { date: "asc" },
  });

  return snapshots.map((s) => ({
    date: s.date.toISOString(),
    netWorth: Number(s.netWorth),
  }));
}
