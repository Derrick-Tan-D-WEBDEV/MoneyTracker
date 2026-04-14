"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const accountSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["CHECKING", "SAVINGS", "CREDIT_CARD", "CASH", "INVESTMENT", "CRYPTO", "LOAN"]),
  balance: z.number(),
  currency: z.string().default("USD"),
  color: z.string().default("#3B82F6"),
  icon: z.string().default("wallet"),
  creditLimit: z.number().min(0).optional().nullable(),
  repaymentDay: z.number().int().min(1).max(31).optional().nullable(),
});

export async function getAccounts() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const accounts = await db.financialAccount.findMany({
    where: { userId: session.user.id, isArchived: false },
    orderBy: { createdAt: "desc" },
  });

  return accounts.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    balance: Number(a.balance),
    currency: a.currency,
    color: a.color,
    icon: a.icon,
    creditLimit: a.creditLimit ? Number(a.creditLimit) : null,
    repaymentDay: a.repaymentDay,
  }));
}

export async function createAccount(data: z.infer<typeof accountSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = accountSchema.parse(data);

  const account = await db.financialAccount.create({
    data: {
      ...parsed,
      userId: session.user.id,
    },
  });

  // Trigger account-related achievements
  const { checkAchievements } = await import("@/actions/gamification");
  await checkAchievements("account");

  revalidatePath("/");
  revalidatePath("/accounts");
  return { id: account.id };
}

export async function checkAccountAchievements() {
  const { checkAchievements } = await import("@/actions/gamification");
  return checkAchievements("account");
}

export async function updateAccount(id: string, data: z.infer<typeof accountSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const existing = await db.financialAccount.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) throw new Error("Account not found");

  const parsed = accountSchema.parse(data);

  const oldBalance = Number(existing.balance);
  const newBalance = parsed.balance;
  const diff = newBalance - oldBalance;

  // Create adjustment transaction if balance changed
  if (Math.abs(diff) >= 0.01) {
    await db.transaction.create({
      data: {
        userId: session.user.id,
        accountId: id,
        type: diff > 0 ? "INCOME" : "EXPENSE",
        amount: Math.abs(diff),
        description: "Balance adjustment",
        date: new Date(),
        notes: `Adjusted from ${oldBalance.toFixed(2)} to ${newBalance.toFixed(2)}`,
        isAdjustment: true,
      },
    });
  }

  await db.financialAccount.update({
    where: { id },
    data: parsed,
  });

  revalidatePath("/");
  revalidatePath("/accounts");
}

export async function deleteAccount(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const account = await db.financialAccount.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!account) throw new Error("Account not found");

  // Soft delete - archive instead
  await db.financialAccount.update({
    where: { id },
    data: { isArchived: true },
  });

  revalidatePath("/");
  revalidatePath("/accounts");
}
