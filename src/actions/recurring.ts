"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

function getNextDueDate(current: Date, frequency: string): Date {
  const next = new Date(current);
  switch (frequency) {
    case "DAILY":
      next.setDate(next.getDate() + 1);
      break;
    case "WEEKLY":
      next.setDate(next.getDate() + 7);
      break;
    case "MONTHLY":
      next.setMonth(next.getMonth() + 1);
      break;
    case "YEARLY":
      next.setFullYear(next.getFullYear() + 1);
      break;
  }
  return next;
}

const recurringSchema = z.object({
  accountId: z.string().uuid(),
  categoryId: z.string().uuid().optional().nullable(),
  type: z.enum(["EXPENSE", "INCOME", "TRANSFER"]),
  amount: z.number().positive("Amount must be positive"),
  description: z.string().min(1, "Description is required"),
  notes: z.string().optional().nullable(),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
  nextDue: z.string().transform((s) => new Date(s)),
});

export async function createRecurringRule(data: z.input<typeof recurringSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = recurringSchema.parse(data);

  // Verify account belongs to user
  const account = await db.financialAccount.findFirst({
    where: { id: parsed.accountId, userId: session.user.id },
  });
  if (!account) throw new Error("Account not found");

  // Create a template transaction (not an actual transaction, just a blueprint)
  const template = await db.transaction.create({
    data: {
      userId: session.user.id,
      accountId: parsed.accountId,
      categoryId: parsed.categoryId || null,
      type: parsed.type,
      amount: parsed.amount,
      description: parsed.description,
      date: parsed.nextDue,
      notes: parsed.notes || null,
      isRecurring: true,
    },
  });

  // Create the recurring rule linked to the template
  const rule = await db.recurringRule.create({
    data: {
      transactionId: template.id,
      frequency: parsed.frequency,
      nextDue: parsed.nextDue,
    },
  });

  revalidatePath("/recurring");
  revalidatePath("/");
  return { id: rule.id };
}

export async function processRecurringTransactions() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const now = new Date();

  const dueRules = await db.recurringRule.findMany({
    where: {
      isActive: true,
      nextDue: { lte: now },
      transaction: { userId: session.user.id },
    },
    include: {
      transaction: true,
    },
  });

  let created = 0;

  for (const rule of dueRules) {
    const t = rule.transaction;

    // Create a new transaction based on the template
    await db.transaction.create({
      data: {
        userId: t.userId,
        accountId: t.accountId,
        categoryId: t.categoryId,
        type: t.type,
        amount: t.amount,
        description: t.description,
        date: rule.nextDue,
        notes: t.notes ? `[Recurring] ${t.notes}` : "[Recurring]",
      },
    });

    // Update account balance
    const balanceChange = t.type === "INCOME" ? Number(t.amount) : -Number(t.amount);
    await db.financialAccount.update({
      where: { id: t.accountId },
      data: { balance: { increment: balanceChange } },
    });

    // Advance the next due date
    await db.recurringRule.update({
      where: { id: rule.id },
      data: { nextDue: getNextDueDate(rule.nextDue, rule.frequency) },
    });

    created++;
  }

  if (created > 0) {
    revalidatePath("/transactions");
    revalidatePath("/recurring");
    revalidatePath("/");
  }

  return { created };
}

export async function getRecurringRules() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const rules = await db.recurringRule.findMany({
    where: {
      transaction: { userId: session.user.id },
    },
    include: {
      transaction: {
        include: { category: true, account: true },
      },
    },
    orderBy: { nextDue: "asc" },
  });

  return rules.map((r) => ({
    id: r.id,
    frequency: r.frequency,
    nextDue: r.nextDue.toISOString(),
    isActive: r.isActive,
    transaction: {
      id: r.transaction.id,
      description: r.transaction.description,
      amount: Number(r.transaction.amount),
      type: r.transaction.type,
      notes: r.transaction.notes,
      category: r.transaction.category ? { id: r.transaction.category.id, name: r.transaction.category.name, color: r.transaction.category.color, icon: r.transaction.category.icon } : null,
      account: { id: r.transaction.account.id, name: r.transaction.account.name, currency: r.transaction.account.currency },
    },
  }));
}

export async function toggleRecurringRule(id: string, isActive: boolean) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  // Verify ownership
  const rule = await db.recurringRule.findFirst({
    where: { id, transaction: { userId: session.user.id } },
  });
  if (!rule) throw new Error("Rule not found");

  await db.recurringRule.update({
    where: { id },
    data: { isActive },
  });

  revalidatePath("/recurring");
  return { success: true };
}

export async function updateRecurringRule(id: string, data: z.input<typeof recurringSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const rule = await db.recurringRule.findFirst({
    where: { id, transaction: { userId: session.user.id } },
    include: { transaction: true },
  });
  if (!rule) throw new Error("Rule not found");

  const parsed = recurringSchema.parse(data);

  // Verify account belongs to user
  const account = await db.financialAccount.findFirst({
    where: { id: parsed.accountId, userId: session.user.id },
  });
  if (!account) throw new Error("Account not found");

  // Update the template transaction
  await db.transaction.update({
    where: { id: rule.transactionId },
    data: {
      accountId: parsed.accountId,
      categoryId: parsed.categoryId || null,
      type: parsed.type,
      amount: parsed.amount,
      description: parsed.description,
      notes: parsed.notes || null,
    },
  });

  // Update the rule
  await db.recurringRule.update({
    where: { id },
    data: {
      frequency: parsed.frequency,
      nextDue: parsed.nextDue,
    },
  });

  revalidatePath("/recurring");
  revalidatePath("/");
  return { success: true };
}

export async function deleteRecurringRule(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const rule = await db.recurringRule.findFirst({
    where: { id, transaction: { userId: session.user.id } },
    select: { id: true, transactionId: true },
  });
  if (!rule) throw new Error("Rule not found");

  // Delete the rule (cascade will handle it) and the template transaction
  await db.recurringRule.delete({ where: { id } });
  await db.transaction.delete({ where: { id: rule.transactionId } });

  revalidatePath("/recurring");
  revalidatePath("/");
  return { success: true };
}
