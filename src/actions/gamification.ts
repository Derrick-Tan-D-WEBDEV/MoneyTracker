"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { ACHIEVEMENTS, getAchievement, calculateLevel, calculateTransactionXp, XP_INVESTMENT, XP_GOAL_CONTRIBUTION } from "@/lib/achievements";
import { getExchangeRates, convertCurrency } from "@/lib/exchange-rates";
import { getViewUserId } from "@/lib/partner-view";
import { getEncryptionKey, decryptAmount } from "@/lib/encryption";

export async function getUserStats() {
  const userId = await getViewUserId();

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { xp: true, level: true, streak: true, lastActiveDate: true },
  });

  if (!user) throw new Error("User not found");

  const achievements = await db.achievement.findMany({
    where: { userId },
    orderBy: { unlockedAt: "desc" },
  });

  return {
    xp: user.xp,
    level: user.level,
    streak: user.streak,
    lastActiveDate: user.lastActiveDate?.toISOString() || null,
    achievements: achievements.map((a) => ({
      type: a.type,
      unlockedAt: a.unlockedAt.toISOString(),
      ...getAchievement(a.type),
    })),
    totalAchievements: ACHIEVEMENTS.length,
    unlockedCount: achievements.length,
  };
}

export async function updateStreak() {
  const session = await auth();
  if (!session?.user?.id) return;

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { streak: true, lastActiveDate: true },
  });
  if (!user) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastActive = user.lastActiveDate ? new Date(user.lastActiveDate) : null;
  if (lastActive) lastActive.setHours(0, 0, 0, 0);

  if (lastActive && lastActive.getTime() === today.getTime()) return;

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const isConsecutive = lastActive && lastActive.getTime() === yesterday.getTime();
  const newStreak = isConsecutive ? user.streak + 1 : 1;

  await db.user.update({
    where: { id: session.user.id },
    data: { streak: newStreak, lastActiveDate: new Date() },
  });

  const newAchievements: string[] = [];
  if (newStreak >= 3) newAchievements.push(...(await tryUnlock(session.user.id, "STREAK_3")));
  if (newStreak >= 7) newAchievements.push(...(await tryUnlock(session.user.id, "STREAK_7")));
  if (newStreak >= 30) newAchievements.push(...(await tryUnlock(session.user.id, "STREAK_30")));
  if (newStreak >= 100) newAchievements.push(...(await tryUnlock(session.user.id, "STREAK_100")));
  if (newStreak >= 365) newAchievements.push(...(await tryUnlock(session.user.id, "STREAK_365")));

  return { streak: newStreak, newAchievements };
}

async function tryUnlock(userId: string, achievementKey: string): Promise<string[]> {
  const existing = await db.achievement.findUnique({
    where: { userId_type: { userId, type: achievementKey } },
  });
  if (existing) return [];

  const def = getAchievement(achievementKey);
  if (!def) return [];

  await db.achievement.create({
    data: { userId, type: achievementKey },
  });

  // Award achievement XP and recalculate level
  await addXp(userId, def.xp);

  return [achievementKey];
}

/** Unlock an achievement by userId directly (no auth() call). Safe to use in auth callbacks. */
export async function tryUnlockDirect(userId: string, achievementKey: string) {
  return tryUnlock(userId, achievementKey);
}

/** Core function to add/subtract XP. XP cannot go below 0. */
async function addXp(userId: string, amount: number) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { xp: true, level: true },
  });
  const currentXp = user?.xp || 0;
  const newXp = Math.max(currentXp + amount, 0);
  const { level: newLevel } = calculateLevel(newXp);
  const oldLevel = user?.level || 1;

  await db.user.update({
    where: { id: userId },
    data: { xp: newXp, level: newLevel },
  });

  // Check level-up achievements
  if (newLevel >= 5 && oldLevel < 5) await tryUnlock(userId, "LEVEL_5");
  if (newLevel >= 10 && oldLevel < 10) await tryUnlock(userId, "LEVEL_10");
  if (newLevel >= 20 && oldLevel < 20) await tryUnlock(userId, "LEVEL_20");

  return { xp: newXp, level: newLevel };
}

export async function checkAchievements(
  trigger: "transaction" | "account" | "budget" | "investment" | "goal" | "goal_complete" | "goal_contribution" | "profile" | "debt" | "debt_payment" | "debt_paid_off",
  meta?: { type?: string; amount?: number },
): Promise<string[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const userId = session.user.id;
  const newAchievements: string[] = [];

  switch (trigger) {
    case "transaction": {
      const count = await db.transaction.count({ where: { userId, isRecurring: false, isAdjustment: false } });
      if (count >= 1) newAchievements.push(...(await tryUnlock(userId, "FIRST_TRANSACTION")));
      if (count >= 10) newAchievements.push(...(await tryUnlock(userId, "TEN_TRANSACTIONS")));
      if (count >= 50) newAchievements.push(...(await tryUnlock(userId, "FIFTY_TRANSACTIONS")));
      if (count >= 100) newAchievements.push(...(await tryUnlock(userId, "HUNDRED_TRANSACTIONS")));
      if (count >= 500) newAchievements.push(...(await tryUnlock(userId, "FIVE_HUNDRED_TRANSACTIONS")));

      // Transaction-type XP: income earns, expense loses
      const txType = (meta?.type || "EXPENSE") as "INCOME" | "EXPENSE" | "TRANSFER";
      const txAmount = meta?.amount || 0;
      const xpDelta = calculateTransactionXp(txType, txAmount);
      await addXp(userId, xpDelta);

      // Type-specific achievements
      if (txType === "INCOME") {
        newAchievements.push(...(await tryUnlock(userId, "FIRST_INCOME")));
        if (txAmount >= 10000) newAchievements.push(...(await tryUnlock(userId, "BIG_EARNER")));
      }

      // Check category diversity
      const catCount = await db.transaction.findMany({
        where: { userId, categoryId: { not: null } },
        select: { categoryId: true },
        distinct: ["categoryId"],
      });
      if (catCount.length >= 5) newAchievements.push(...(await tryUnlock(userId, "ALL_CATEGORIES")));

      // Check total balance for savings achievements
      await checkBalanceAchievements(userId, newAchievements);
      break;
    }

    case "account": {
      const count = await db.financialAccount.count({ where: { userId, isArchived: false } });
      if (count >= 1) newAchievements.push(...(await tryUnlock(userId, "FIRST_ACCOUNT")));
      if (count >= 3) newAchievements.push(...(await tryUnlock(userId, "THREE_ACCOUNTS")));
      break;
    }

    case "budget": {
      const count = await db.budget.count({ where: { userId } });
      if (count >= 1) newAchievements.push(...(await tryUnlock(userId, "FIRST_BUDGET")));
      if (count >= 5) newAchievements.push(...(await tryUnlock(userId, "FIVE_BUDGETS")));
      break;
    }

    case "investment": {
      const count = await db.investment.count({ where: { userId } });
      if (count >= 1) newAchievements.push(...(await tryUnlock(userId, "FIRST_INVESTMENT")));
      if (count >= 5) newAchievements.push(...(await tryUnlock(userId, "FIVE_INVESTMENTS")));
      if (count >= 10) newAchievements.push(...(await tryUnlock(userId, "TEN_INVESTMENTS")));

      const types = await db.investment.findMany({
        where: { userId },
        select: { type: true },
        distinct: ["type"],
      });
      if (types.length >= 3) newAchievements.push(...(await tryUnlock(userId, "DIVERSIFIED")));

      // Award investment XP
      await addXp(userId, XP_INVESTMENT);
      break;
    }

    case "goal": {
      const count = await db.goal.count({ where: { userId } });
      if (count >= 1) newAchievements.push(...(await tryUnlock(userId, "FIRST_GOAL")));
      if (count >= 3) newAchievements.push(...(await tryUnlock(userId, "THREE_GOALS")));
      break;
    }

    case "goal_complete": {
      newAchievements.push(...(await tryUnlock(userId, "GOAL_CRUSHER")));

      // Check how many goals completed
      const completedGoals = await db.goal.findMany({ where: { userId } });
      const encKeyGoal = await getEncryptionKey();
      const doneCount = completedGoals.filter((g) => decryptAmount(g.currentAmount, encKeyGoal) >= decryptAmount(g.targetAmount, encKeyGoal)).length;
      if (doneCount >= 5) newAchievements.push(...(await tryUnlock(userId, "FIVE_GOALS_COMPLETE")));
      break;
    }

    case "goal_contribution": {
      await addXp(userId, XP_GOAL_CONTRIBUTION);

      // Check 50% milestone
      const goals = await db.goal.findMany({ where: { userId } });
      const encKeyGoalC = await getEncryptionKey();
      const has50 = goals.some((g) => decryptAmount(g.targetAmount, encKeyGoalC) > 0 && decryptAmount(g.currentAmount, encKeyGoalC) / decryptAmount(g.targetAmount, encKeyGoalC) >= 0.5);
      if (has50) newAchievements.push(...(await tryUnlock(userId, "GOAL_50_PERCENT")));
      break;
    }

    case "profile": {
      newAchievements.push(...(await tryUnlock(userId, "PROFILE_COMPLETE")));
      break;
    }

    case "debt": {
      const debtCount = await db.debt.count({ where: { userId } });
      if (debtCount >= 1) newAchievements.push(...(await tryUnlock(userId, "FIRST_DEBT")));
      break;
    }

    case "debt_payment": {
      newAchievements.push(...(await tryUnlock(userId, "FIRST_PAYMENT")));
      break;
    }

    case "debt_paid_off": {
      newAchievements.push(...(await tryUnlock(userId, "DEBT_FREE")));
      const paidOff = await db.debt.count({ where: { userId, isPaidOff: true } });
      if (paidOff >= 3) newAchievements.push(...(await tryUnlock(userId, "THREE_DEBTS_PAID")));
      const totalDebts = await db.debt.count({ where: { userId } });
      const activeDebts = await db.debt.count({ where: { userId, isPaidOff: false } });
      if (totalDebts > 0 && activeDebts === 0) newAchievements.push(...(await tryUnlock(userId, "ALL_DEBTS_PAID")));
      break;
    }
  }

  if (newAchievements.length > 0) {
    revalidatePath("/");
  }

  return newAchievements;
}

/** Check balance milestones */
async function checkBalanceAchievements(userId: string, results: string[]) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { currency: true } });
  const userCurrency = user?.currency || "MYR";
  const rates = await getExchangeRates("USD");

  const accounts = await db.financialAccount.findMany({
    where: { userId, isArchived: false },
    select: { balance: true, reservedAmount: true, currency: true, type: true, creditLimit: true },
  });
  // Convert all balances to USD for consistent achievement thresholds
  const encKeyBal = await getEncryptionKey();
  const totalBalanceUSD = accounts.reduce((sum, a) => {
    const effectiveBalance = decryptAmount(a.balance, encKeyBal) - decryptAmount(a.reservedAmount, encKeyBal);
    const converted = convertCurrency(effectiveBalance, a.currency, "USD", rates);
    if (a.type === "CREDIT_CARD") {
      // Balance = available credit; liability = creditLimit - balance
      const limit = a.creditLimit ? convertCurrency(decryptAmount(a.creditLimit, encKeyBal), a.currency, "USD", rates) : 0;
      return sum - (limit - converted);
    }
    return sum + converted;
  }, 0);

  if (totalBalanceUSD >= 1000) results.push(...(await tryUnlock(userId, "SAVINGS_1K")));
  if (totalBalanceUSD >= 10000) results.push(...(await tryUnlock(userId, "SAVINGS_10K")));
  if (totalBalanceUSD >= 100000) results.push(...(await tryUnlock(userId, "SAVINGS_100K")));
  if (totalBalanceUSD >= 1000000) results.push(...(await tryUnlock(userId, "SAVINGS_1M")));
}

/** Check net worth milestones (balance minus debts) */
export async function checkNetWorthAchievements(): Promise<string[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const userId = session.user.id;

  const user = await db.user.findUnique({ where: { id: userId }, select: { currency: true } });
  const rates = await getExchangeRates("USD");
  const encKey = await getEncryptionKey();

  const accounts = await db.financialAccount.findMany({
    where: { userId, isArchived: false },
    select: { balance: true, reservedAmount: true, currency: true, type: true, creditLimit: true },
  });

  const debts = await db.debt.findMany({
    where: { userId, isPaidOff: false },
    select: { remainingAmount: true, currency: true },
  });

  let netWorthUSD = accounts.reduce((sum, a) => {
    const effectiveBalance = decryptAmount(a.balance, encKey) - decryptAmount(a.reservedAmount, encKey);
    const converted = convertCurrency(effectiveBalance, a.currency, "USD", rates);
    if (a.type === "CREDIT_CARD") {
      const limit = a.creditLimit ? convertCurrency(decryptAmount(a.creditLimit, encKey), a.currency, "USD", rates) : 0;
      return sum - (limit - converted);
    }
    return sum + converted;
  }, 0);

  netWorthUSD -= debts.reduce((sum, d) => sum + convertCurrency(decryptAmount(d.remainingAmount, encKey), d.currency, "USD", rates), 0);

  const results: string[] = [];
  if (netWorthUSD >= 10000) results.push(...(await tryUnlock(userId, "NET_WORTH_10K")));
  if (netWorthUSD >= 50000) results.push(...(await tryUnlock(userId, "NET_WORTH_50K")));
  if (netWorthUSD >= 100000) results.push(...(await tryUnlock(userId, "NET_WORTH_100K")));
  if (netWorthUSD >= 500000) results.push(...(await tryUnlock(userId, "NET_WORTH_500K")));
  if (netWorthUSD >= 1000000) results.push(...(await tryUnlock(userId, "NET_WORTH_1M")));

  if (results.length > 0) revalidatePath("/");
  return results;
}
