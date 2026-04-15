"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getExchangeRates, convertCurrency } from "@/lib/exchange-rates";
import { getViewUserId } from "@/lib/partner-view";
import { getEncryptionKey, encryptAmount, decryptAmount } from "@/lib/encryption";

export async function takeNetWorthSnapshot() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;
  const userCurrency = session.user.currency || "USD";
  const encKey = await getEncryptionKey();
  const rates = await getExchangeRates(userCurrency);

  const accounts = await db.financialAccount.findMany({
    where: { userId, isArchived: false },
  });

  const debts = await db.debt.findMany({
    where: { userId, isPaidOff: false },
  });

  const assets = await db.asset.findMany({
    where: { userId, isSold: false },
  });

  const accountBalance = accounts.reduce((sum, acc) => {
    const effectiveBalance = decryptAmount(acc.balance, encKey) - decryptAmount(acc.reservedAmount, encKey);
    const converted = convertCurrency(effectiveBalance, acc.currency, userCurrency, rates);
    if (acc.type === "CREDIT_CARD") {
      // Balance = available credit; liability = creditLimit - balance
      const limit = acc.creditLimit ? convertCurrency(decryptAmount(acc.creditLimit, encKey), acc.currency, userCurrency, rates) : 0;
      return sum - (limit - converted);
    }
    return sum + converted;
  }, 0);

  const totalDebt = debts.reduce((sum, d) => {
    return sum + convertCurrency(decryptAmount(d.remainingAmount, encKey), d.currency, userCurrency, rates);
  }, 0);

  const totalAssets = assets.reduce((sum, a) => {
    return sum + convertCurrency(decryptAmount(a.currentValue, encKey), a.currency, userCurrency, rates);
  }, 0);

  const netWorth = accountBalance + totalAssets - totalDebt;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await db.netWorthSnapshot.upsert({
    where: { userId_date: { userId, date: today } },
    update: { netWorth: encryptAmount(netWorth, encKey) },
    create: { userId, date: today, netWorth: encryptAmount(netWorth, encKey) },
  });

  return netWorth;
}

export async function getNetWorthHistory(months = 12) {
  const userId = await getViewUserId();
  const encKey = await getEncryptionKey();

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
    netWorth: decryptAmount(s.netWorth, encKey),
  }));
}
