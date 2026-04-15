"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewUserId } from "@/lib/partner-view";
import { getEncryptionKey, encrypt, decrypt, encryptAmount, decryptAmount } from "@/lib/encryption";

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
  const encKey = await getEncryptionKey();

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
    amount: decryptAmount(t.amount, encKey),
    description: decrypt(t.description, encKey),
    date: t.date.toISOString(),
    notes: t.notes ? decrypt(t.notes, encKey) : t.notes,
    transferId: t.transferId,
    category: t.category ? { id: t.category.id, name: t.category.name, color: t.category.color, icon: t.category.icon } : null,
    account: { id: t.account.id, name: decrypt(t.account.name, encKey), type: t.account.type, currency: t.account.currency },
    tags: t.tags.map((tag) => ({ id: tag.id, name: decrypt(tag.name, encKey), color: tag.color })),
  }));
}

export async function createTransaction(data: z.input<typeof transactionSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const encKey = await getEncryptionKey();

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
        amount: encryptAmount(parsed.amount, encKey),
        description: encrypt(parsed.description || `Transfer to ${decrypt(toAccount.name, encKey)}`, encKey),
        date: parsed.date,
        notes: parsed.notes ? encrypt(parsed.notes, encKey) : null,
        transferId,
      },
    });

    // Create incoming transaction (to destination)
    await db.transaction.create({
      data: {
        userId: session.user.id,
        accountId: parsed.transferToAccountId,
        type: "TRANSFER",
        amount: encryptAmount(parsed.amount, encKey),
        description: encrypt(parsed.description || `Transfer from ${decrypt(account.name, encKey)}`, encKey),
        date: parsed.date,
        notes: parsed.notes ? encrypt(parsed.notes, encKey) : null,
        transferId,
      },
    });

    // Update balances
    const srcBalance = decryptAmount(account.balance, encKey);
    await db.financialAccount.update({
      where: { id: parsed.accountId },
      data: { balance: encryptAmount(srcBalance - parsed.amount, encKey) },
    });
    const destBalance = decryptAmount(toAccount.balance, encKey);
    await db.financialAccount.update({
      where: { id: parsed.transferToAccountId },
      data: { balance: encryptAmount(destBalance + parsed.amount, encKey) },
    });

    revalidatePath("/");
    revalidatePath("/transactions");
    return { id: transferId };
  }

  const { transferToAccountId, ...transactionData } = parsed;

  const transaction = await db.transaction.create({
    data: {
      ...transactionData,
      amount: encryptAmount(transactionData.amount, encKey),
      description: encrypt(transactionData.description, encKey),
      notes: transactionData.notes ? encrypt(transactionData.notes, encKey) : null,
      userId: session.user.id,
      categoryId: transactionData.categoryId || null,
    },
  });

  // Update account balance
  const currentBalance = decryptAmount(account.balance, encKey);
  const balanceChange = parsed.type === "INCOME" ? parsed.amount : -parsed.amount;
  await db.financialAccount.update({
    where: { id: parsed.accountId },
    data: { balance: encryptAmount(currentBalance + balanceChange, encKey) },
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
      const remaining = Math.max(decryptAmount(goal.targetAmount, encKey) - decryptAmount(goal.currentAmount, encKey), 0);
      if (remaining > 0) {
        const contribution = Math.min(parsed.amount, remaining);
        const newAmount = decryptAmount(goal.currentAmount, encKey) + contribution;
        const updated = await db.goal.update({
          where: { id: goal.id },
          data: { currentAmount: encryptAmount(newAmount, encKey) },
        });

        if (decryptAmount(updated.currentAmount, encKey) >= decryptAmount(updated.targetAmount, encKey)) {
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
  const encKey = await getEncryptionKey();

  const existing = await db.transaction.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) throw new Error("Transaction not found");

  const parsed = transactionSchema.parse(data);

  // Reverse old balance change
  const oldAccount = await db.financialAccount.findUnique({ where: { id: existing.accountId } });
  const oldAccountBalance = decryptAmount(oldAccount!.balance, encKey);
  const oldAmount = decryptAmount(existing.amount, encKey);
  const oldBalanceChange = existing.type === "INCOME" ? -oldAmount : oldAmount;
  await db.financialAccount.update({
    where: { id: existing.accountId },
    data: { balance: encryptAmount(oldAccountBalance + oldBalanceChange, encKey) },
  });

  // Apply new balance change
  const newAccount =
    parsed.accountId === existing.accountId ? await db.financialAccount.findUnique({ where: { id: parsed.accountId } }) : await db.financialAccount.findUnique({ where: { id: parsed.accountId } });
  const newAccountBalance = decryptAmount(newAccount!.balance, encKey);
  const newBalanceChange = parsed.type === "INCOME" ? parsed.amount : -parsed.amount;
  await db.financialAccount.update({
    where: { id: parsed.accountId },
    data: { balance: encryptAmount(newAccountBalance + newBalanceChange, encKey) },
  });

  await db.transaction.update({
    where: { id },
    data: {
      ...parsed,
      amount: encryptAmount(parsed.amount, encKey),
      description: encrypt(parsed.description, encKey),
      notes: parsed.notes ? encrypt(parsed.notes, encKey) : null,
      categoryId: parsed.categoryId || null,
    },
  });

  revalidatePath("/");
  revalidatePath("/transactions");
}

export async function deleteTransaction(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const encKey = await getEncryptionKey();

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
      const acct = await db.financialAccount.findUnique({ where: { id: t.accountId } });
      const acctBalance = decryptAmount(acct!.balance, encKey);
      const txAmount = decryptAmount(t.amount, encKey);
      if (t.id === id) {
        // This is source - add balance back
        await db.financialAccount.update({
          where: { id: t.accountId },
          data: { balance: encryptAmount(acctBalance + txAmount, encKey) },
        });
      } else {
        // This is destination - subtract balance
        await db.financialAccount.update({
          where: { id: t.accountId },
          data: { balance: encryptAmount(acctBalance - txAmount, encKey) },
        });
      }
    }
    await db.transaction.deleteMany({ where: { transferId: transaction.transferId, userId: session.user.id } });
  } else {
    // Reverse balance change
    const acct = await db.financialAccount.findUnique({ where: { id: transaction.accountId } });
    const acctBalance = decryptAmount(acct!.balance, encKey);
    const txAmount = decryptAmount(transaction.amount, encKey);
    const balanceChange = transaction.type === "INCOME" ? -txAmount : txAmount;
    await db.financialAccount.update({
      where: { id: transaction.accountId },
      data: { balance: encryptAmount(acctBalance + balanceChange, encKey) },
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
  const encKey = await getEncryptionKey();

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
          amount: encryptAmount(parsed.amount, encKey),
          description: encrypt(parsed.description, encKey),
          date: new Date(parsed.date),
          notes: parsed.notes ? encrypt(parsed.notes, encKey) : null,
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
    const acct = await db.financialAccount.findUnique({ where: { id: accountId } });
    const currentBalance = decryptAmount(acct!.balance, encKey);
    await db.financialAccount.update({
      where: { id: accountId },
      data: { balance: encryptAmount(currentBalance + change, encKey) },
    });
  }

  revalidatePath("/");
  revalidatePath("/transactions");

  return { imported, skipped, total: rows.length };
}
