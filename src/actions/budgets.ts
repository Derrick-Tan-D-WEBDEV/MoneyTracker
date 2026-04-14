"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getExchangeRates, convertCurrency } from "@/lib/exchange-rates";

const budgetSchema = z.object({
  categoryId: z.string().uuid(),
  amount: z.number().positive("Amount must be positive"),
  period: z.enum(["WEEKLY", "MONTHLY", "YEARLY"]).default("MONTHLY"),
  alertThreshold: z.number().min(1).max(100).default(80),
  startDate: z.string().transform((s) => new Date(s)),
  endDate: z
    .string()
    .optional()
    .nullable()
    .transform((s) => (s ? new Date(s) : null)),
});

export async function getBudgets() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userCurrency = session.user.currency || "MYR";
  const rates = await getExchangeRates(userCurrency);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const budgets = await db.budget.findMany({
    where: { userId: session.user.id },
    include: { category: true },
    orderBy: { createdAt: "desc" },
  });

  const budgetData = await Promise.all(
    budgets.map(async (budget) => {
      const transactions = await db.transaction.findMany({
        where: {
          userId: session.user.id,
          categoryId: budget.categoryId,
          type: "EXPENSE",
          date: { gte: startOfMonth, lte: now },
        },
        include: { account: true },
      });

      const spent = transactions.reduce((sum, t) => sum + convertCurrency(Number(t.amount), t.account.currency, userCurrency, rates), 0);

      return {
        id: budget.id,
        categoryId: budget.categoryId,
        category: budget.category.name,
        categoryColor: budget.category.color,
        categoryIcon: budget.category.icon,
        amount: Number(budget.amount),
        period: budget.period,
        alertThreshold: budget.alertThreshold,
        spent,
        remaining: Math.max(Number(budget.amount) - spent, 0),
        percentage: Number(budget.amount) > 0 ? (spent / Number(budget.amount)) * 100 : 0,
        isOverBudget: spent > Number(budget.amount),
        isNearLimit: Number(budget.amount) > 0 && (spent / Number(budget.amount)) * 100 >= budget.alertThreshold && spent <= Number(budget.amount),
      };
    }),
  );

  return budgetData;
}

export async function createBudget(data: z.input<typeof budgetSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = budgetSchema.parse(data);

  const budget = await db.budget.create({
    data: {
      ...parsed,
      userId: session.user.id,
    },
  });

  revalidatePath("/");
  revalidatePath("/budgets");
  return { id: budget.id };
}

export async function checkBudgetAchievements() {
  const { checkAchievements } = await import("@/actions/gamification");
  return checkAchievements("budget");
}

export async function updateBudget(id: string, data: z.input<typeof budgetSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const existing = await db.budget.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) throw new Error("Budget not found");

  const parsed = budgetSchema.parse(data);

  await db.budget.update({
    where: { id },
    data: parsed,
  });

  revalidatePath("/");
  revalidatePath("/budgets");
}

export async function deleteBudget(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const budget = await db.budget.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!budget) throw new Error("Budget not found");

  await db.budget.delete({ where: { id } });

  revalidatePath("/");
  revalidatePath("/budgets");
}
