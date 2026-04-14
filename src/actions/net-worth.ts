"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getExchangeRates, convertCurrency } from "@/lib/exchange-rates";
import { getViewUserId } from "@/lib/partner-view";

export async function takeNetWorthSnapshot() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;
  const userCurrency = session.user.currency || "USD";
  const rates = await getExchangeRates(userCurrency);

  const accounts = await db.financialAccount.findMany({
    where: { userId, isArchived: false },
  });

  const netWorth = accounts.reduce((sum, acc) => {
    const converted = convertCurrency(Number(acc.balance), acc.currency, userCurrency, rates);
    if (acc.type === "CREDIT_CARD") {
      // Balance = available credit; liability = creditLimit - balance
      const limit = acc.creditLimit ? convertCurrency(Number(acc.creditLimit), acc.currency, userCurrency, rates) : 0;
      return sum - (limit - converted);
    }
    return sum + converted;
  }, 0);

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
  const userId = await getViewUserId();

  const since = new Date();
  since.setMonth(since.getMonth() - months);

  const snapshots = await db.netWorthSnapshot.findMany({
    where: {
      userId,
      date: { gte: since },
    },
    orderBy: { date: "asc" },
  });

  return snapshots.map((s) => ({
    date: s.date.toISOString(),
    netWorth: Number(s.netWorth),
  }));
}
