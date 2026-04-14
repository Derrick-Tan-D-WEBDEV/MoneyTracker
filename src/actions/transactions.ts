"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewUserId } from "@/lib/partner-view";

const transactionSchema = z.object({
  accountId: z.string().uuid(),
  categoryId: z.string().uuid().optional().nullable(),
  type: z.enum(["EXPENSE", "INCOME", "TRANSFER"]),
  amount: z.number().positive("Amount must be positive"),
  description: z.string().min(1, "Description is required"),
  date: z.string().transform((s) => new Date(s)),
  notes: z.string().optional().nullable(),
  transferToAccountId: z.string().uuid().optional().nullable(),
});

export async function getTransactions(filters?: { type?: string; accountId?: string; categoryId?: string; startDate?: string; endDate?: string }) {
  const userId = await getViewUserId();

  const where: Record<string, unknown> = { userId, isRecurring: false, isAdjustment: false };

  if (filters?.type && filters.type !== "ALL") {
    where.type = filters.type;
  }
  if (filters?.accountId) {
    where.accountId = filters.accountId;
  }
  if (filters?.categoryId) {
    where.categoryId = filters.categoryId;
  }
  if (filters?.startDate || filters?.endDate) {
    where.date = {};
    if (filters.startDate) (where.date as Record<string, Date>).gte = new Date(filters.startDate);
    if (filters.endDate) (where.date as Record<string, Date>).lte = new Date(filters.endDate);
  }

  const transactions = await db.transaction.findMany({
    where,
    include: { category: true, account: true, tags: true },
    orderBy: { date: "desc" },
  });

  return transactions.map((t) => ({
    id: t.id,
    type: t.type,
    amount: Number(t.amount),
    description: t.description,
    date: t.date.toISOString(),
    notes: t.notes,
    transferId: t.transferId,
    category: t.category ? { id: t.category.id, name: t.category.name, color: t.category.color, icon: t.category.icon } : null,
    account: { id: t.account.id, name: t.account.name, type: t.account.type, currency: t.account.currency },
    tags: t.tags.map((tag) => ({ id: tag.id, name: tag.name, color: tag.color })),
  }));
}

export async function createTransaction(data: z.input<typeof transactionSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = transactionSchema.parse(data);

  // Verify account belongs to user
  const account = await db.financialAccount.findFirst({
    where: { id: parsed.accountId, userId: session.user.id },
  });
  if (!account) throw new Error("Account not found");

  // Handle TRANSFER type
  if (parsed.type === "TRANSFER") {
    if (!parsed.transferToAccountId) throw new Error("Destination account required for transfers");
    const toAccount = await db.financialAccount.findFirst({
      where: { id: parsed.transferToAccountId, userId: session.user.id },
    });
    if (!toAccount) throw new Error("Destination account not found");

    const transferId = crypto.randomUUID();

    // Create outgoing transaction (from source)
    await db.transaction.create({
      data: {
        userId: session.user.id,
        accountId: parsed.accountId,
        type: "TRANSFER",
        amount: parsed.amount,
        description: parsed.description || `Transfer to ${toAccount.name}`,
        date: parsed.date,
        notes: parsed.notes || null,
        transferId,
      },
    });

    // Create incoming transaction (to destination)
    await db.transaction.create({
      data: {
        userId: session.user.id,
        accountId: parsed.transferToAccountId,
        type: "TRANSFER",
        amount: parsed.amount,
        description: parsed.description || `Transfer from ${account.name}`,
        date: parsed.date,
        notes: parsed.notes || null,
        transferId,
      },
    });

    // Update balances
    await db.financialAccount.update({
      where: { id: parsed.accountId },
      data: { balance: { decrement: parsed.amount } },
    });
    await db.financialAccount.update({
      where: { id: parsed.transferToAccountId },
      data: { balance: { increment: parsed.amount } },
    });

    revalidatePath("/");
    revalidatePath("/transactions");
    return { id: transferId };
  }

  const { transferToAccountId, ...transactionData } = parsed;

  const transaction = await db.transaction.create({
    data: {
      ...transactionData,
      userId: session.user.id,
      categoryId: transactionData.categoryId || null,
    },
  });

  // Update account balance
  const balanceChange = parsed.type === "INCOME" ? parsed.amount : -parsed.amount;
  await db.financialAccount.update({
    where: { id: parsed.accountId },
    data: { balance: { increment: balanceChange } },
  });

  // Auto-contribute to linked goals when adding income to savings/investment accounts
  if (parsed.type === "INCOME" && (account.type === "SAVINGS" || account.type === "INVESTMENT")) {
    const linkedGoals = await db.goal.findMany({
      where: {
        accountId: parsed.accountId,
        userId: session.user.id,
      },
    });

    for (const goal of linkedGoals) {
      const remaining = Math.max(Number(goal.targetAmount) - Number(goal.currentAmount), 0);
      if (remaining > 0) {
        const contribution = Math.min(parsed.amount, remaining);
        const updated = await db.goal.update({
          where: { id: goal.id },
          data: { currentAmount: { increment: contribution } },
        });

        if (Number(updated.currentAmount) >= Number(updated.targetAmount)) {
          const { checkAchievements } = await import("@/actions/gamification");
          await checkAchievements("goal_complete");
        }
      }
    }
  }

  revalidatePath("/");
  revalidatePath("/transactions");
  return { id: transaction.id };
}

export async function checkTransactionAchievements(meta?: { type?: string; amount?: number }) {
  const { checkAchievements, updateStreak } = await import("@/actions/gamification");
  await updateStreak();
  return checkAchievements("transaction", meta);
}

export async function updateTransaction(id: string, data: z.input<typeof transactionSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const existing = await db.transaction.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) throw new Error("Transaction not found");

  const parsed = transactionSchema.parse(data);

  // Reverse old balance change
  const oldBalanceChange = existing.type === "INCOME" ? -Number(existing.amount) : Number(existing.amount);
  await db.financialAccount.update({
    where: { id: existing.accountId },
    data: { balance: { increment: oldBalanceChange } },
  });

  // Apply new balance change
  const newBalanceChange = parsed.type === "INCOME" ? parsed.amount : -parsed.amount;
  await db.financialAccount.update({
    where: { id: parsed.accountId },
    data: { balance: { increment: newBalanceChange } },
  });

  await db.transaction.update({
    where: { id },
    data: {
      ...parsed,
      categoryId: parsed.categoryId || null,
    },
  });

  revalidatePath("/");
  revalidatePath("/transactions");
}

export async function deleteTransaction(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const transaction = await db.transaction.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!transaction) throw new Error("Transaction not found");

  // If this is a transfer, delete the paired transaction too
  if (transaction.type === "TRANSFER" && transaction.transferId) {
    const paired = await db.transaction.findMany({
      where: { transferId: transaction.transferId, userId: session.user.id },
    });
    for (const t of paired) {
      // For the source (first in pair), add back; for dest (second), subtract
      // We identify by: if t.id === id, this is the one user clicked delete on
      // The paired one is the other
      if (t.id === id) {
        // This is source - add balance back
        await db.financialAccount.update({
          where: { id: t.accountId },
          data: { balance: { increment: Number(t.amount) } },
        });
      } else {
        // This is destination - subtract balance
        await db.financialAccount.update({
          where: { id: t.accountId },
          data: { balance: { decrement: Number(t.amount) } },
        });
      }
    }
    await db.transaction.deleteMany({ where: { transferId: transaction.transferId, userId: session.user.id } });
  } else {
    // Reverse balance change
    const balanceChange = transaction.type === "INCOME" ? -Number(transaction.amount) : Number(transaction.amount);
    await db.financialAccount.update({
      where: { id: transaction.accountId },
      data: { balance: { increment: balanceChange } },
    });

    await db.transaction.delete({ where: { id } });
  }

  revalidatePath("/");
  revalidatePath("/transactions");
}

const importRowSchema = z.object({
  accountId: z.string().uuid(),
  type: z.enum(["EXPENSE", "INCOME", "TRANSFER"]),
  amount: z.number().positive(),
  description: z.string().min(1),
  date: z.string(),
  notes: z.string().optional().nullable(),
  categoryName: z.string().optional().nullable(),
});

export async function importTransactions(rows: z.input<typeof importRowSchema>[]) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  if (rows.length === 0) throw new Error("No rows to import");
  if (rows.length > 500) throw new Error("Maximum 500 transactions per import");

  // Verify all referenced accounts belong to user
  const accountIds = [...new Set(rows.map((r) => r.accountId))];
  const accounts = await db.financialAccount.findMany({
    where: { id: { in: accountIds }, userId: session.user.id },
  });
  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  for (const aid of accountIds) {
    if (!accountMap.has(aid)) throw new Error(`Account not found: ${aid}`);
  }

  // Load categories for name matching
  const categories = await db.category.findMany({
    where: {
      OR: [{ userId: session.user.id }, { isDefault: true }],
    },
  });
  const categoryByName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));

  let imported = 0;
  let skipped = 0;
  const balanceChanges = new Map<string, number>();

  for (const row of rows) {
    try {
      const parsed = importRowSchema.parse(row);
      const categoryId = parsed.categoryName ? categoryByName.get(parsed.categoryName.toLowerCase()) || null : null;

      await db.transaction.create({
        data: {
          userId: session.user.id,
          accountId: parsed.accountId,
          categoryId,
          type: parsed.type,
          amount: parsed.amount,
          description: parsed.description,
          date: new Date(parsed.date),
          notes: parsed.notes || null,
        },
      });

      const change = parsed.type === "INCOME" ? parsed.amount : -parsed.amount;
      balanceChanges.set(parsed.accountId, (balanceChanges.get(parsed.accountId) || 0) + change);
      imported++;
    } catch {
      skipped++;
    }
  }

  // Batch update account balances
  for (const [accountId, change] of balanceChanges) {
    await db.financialAccount.update({
      where: { id: accountId },
      data: { balance: { increment: change } },
    });
  }

  revalidatePath("/");
  revalidatePath("/transactions");

  return { imported, skipped, total: rows.length };
}
