"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { calculateSGTax, type TaxInput, type TaxResult } from "@/lib/sg-tax";
import { getExchangeRates, convertCurrency } from "@/lib/exchange-rates";
import { getEncryptionKey, decryptAmount } from "@/lib/encryption";

export interface TaxPredictionData {
  incomeYTD: number;
  projectedAnnualIncome: number;
  monthsElapsed: number;
  currency: string;
  incomeSources: { category: string; amount: number }[];
}

export async function getTaxPredictionData(): Promise<TaxPredictionData> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userCurrency = session.user.currency || "SGD";
  const encKey = await getEncryptionKey();
  const rates = await getExchangeRates(userCurrency);

  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  // Get all income transactions this year
  const incomeTransactions = await db.transaction.findMany({
    where: {
      userId: session.user.id,
      type: "INCOME",
      date: { gte: startOfYear, lte: now },
    },
    include: { account: true, category: true },
  });

  // Sum income in user's currency
  const incomeYTD = incomeTransactions.reduce((sum, t) => sum + convertCurrency(decryptAmount(t.amount, encKey), t.account.currency, userCurrency, rates), 0);

  // Group by category
  const byCat: Record<string, number> = {};
  for (const t of incomeTransactions) {
    const catName = t.category?.name || "Uncategorized";
    const converted = convertCurrency(decryptAmount(t.amount, encKey), t.account.currency, userCurrency, rates);
    byCat[catName] = (byCat[catName] || 0) + converted;
  }
  const incomeSources = Object.entries(byCat)
    .map(([category, amount]) => ({ category, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount);

  // Project annual income based on months elapsed
  const monthsElapsed = now.getMonth() + now.getDate() / 30;
  const projectedAnnualIncome = monthsElapsed > 0 ? (incomeYTD / monthsElapsed) * 12 : 0;

  return {
    incomeYTD: Math.round(incomeYTD * 100) / 100,
    projectedAnnualIncome: Math.round(projectedAnnualIncome * 100) / 100,
    monthsElapsed: Math.round(monthsElapsed * 10) / 10,
    currency: userCurrency,
    incomeSources,
  };
}

export async function computeTax(input: TaxInput): Promise<TaxResult> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  return calculateSGTax(input);
}
