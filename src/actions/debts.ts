"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewUserId } from "@/lib/partner-view";
import { getEncryptionKey, encrypt, decrypt } from "@/lib/encryption";

const debtSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["PERSONAL_LOAN", "CAR_LOAN", "MORTGAGE", "STUDENT_LOAN", "CREDIT_CARD", "MEDICAL", "OTHER"]),
  lender: z.string().optional().nullable(),
  accountId: z.string().uuid().optional().nullable(),
  originalAmount: z.number().positive("Amount must be positive"),
  remainingAmount: z.number().min(0),
  interestRate: z.number().min(0).max(100).default(0),
  minimumPayment: z.number().min(0).default(0),
  dueDay: z.number().int().min(1).max(31).optional().nullable(),
  startDate: z.string().transform((s) => new Date(s)),
  endDate: z
    .string()
    .optional()
    .nullable()
    .transform((s) => (s ? new Date(s) : null)),
  currency: z.string().default("USD"),
  icon: z.string().default("landmark"),
  color: z.string().default("#EF4444"),
  notes: z.string().optional().nullable(),
});

const paymentSchema = z.object({
  debtId: z.string().uuid(),
  amount: z.number().positive("Payment must be positive"),
});

export async function getDebts() {
  const userId = await getViewUserId();
  const encKey = await getEncryptionKey();

  const debts = await db.debt.findMany({
    where: { userId },
    orderBy: [{ isPaidOff: "asc" }, { remainingAmount: "desc" }],
    include: { account: { select: { id: true, name: true, type: true, color: true, creditLimit: true, repaymentDay: true } } },
  });

  return debts.map((d) => ({
    id: d.id,
    name: decrypt(d.name, encKey),
    type: d.type,
    lender: d.lender ? decrypt(d.lender, encKey) : d.lender,
    accountId: d.accountId,
    accountName: d.account ? decrypt(d.account.name, encKey) : null,
    accountColor: d.account?.color || null,
    accountRepaymentDay: d.account?.repaymentDay || null,
    accountCreditLimit: d.account?.creditLimit ? Number(d.account.creditLimit) : null,
    originalAmount: Number(d.originalAmount),
    remainingAmount: Number(d.remainingAmount),
    interestRate: Number(d.interestRate),
    minimumPayment: Number(d.minimumPayment),
    dueDay: d.dueDay,
    startDate: d.startDate.toISOString(),
    endDate: d.endDate?.toISOString() || null,
    currency: d.currency,
    icon: d.icon,
    color: d.color,
    isPaidOff: d.isPaidOff,
    notes: d.notes ? decrypt(d.notes, encKey) : d.notes,
    createdAt: d.createdAt.toISOString(),
  }));
}

export async function createDebt(data: z.input<typeof debtSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const encKey = await getEncryptionKey();

  const parsed = debtSchema.parse(data);

  const debt = await db.debt.create({
    data: {
      ...parsed,
      name: encrypt(parsed.name, encKey),
      lender: parsed.lender ? encrypt(parsed.lender, encKey) : parsed.lender,
      notes: parsed.notes ? encrypt(parsed.notes, encKey) : parsed.notes,
      userId: session.user.id,
    },
  });

  // Check debt achievements
  const { checkAchievements } = await import("@/actions/gamification");
  await checkAchievements("debt");

  revalidatePath("/debts");
  revalidatePath("/");
  return { id: debt.id };
}

export async function updateDebt(id: string, data: z.input<typeof debtSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const encKey = await getEncryptionKey();

  const existing = await db.debt.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) throw new Error("Debt not found");

  const parsed = debtSchema.parse(data);

  await db.debt.update({
    where: { id },
    data: {
      ...parsed,
      name: encrypt(parsed.name, encKey),
      lender: parsed.lender ? encrypt(parsed.lender, encKey) : parsed.lender,
      notes: parsed.notes ? encrypt(parsed.notes, encKey) : parsed.notes,
    },
  });

  revalidatePath("/debts");
  revalidatePath("/");
  return { success: true };
}

export async function makePayment(data: z.input<typeof paymentSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = paymentSchema.parse(data);

  const debt = await db.debt.findFirst({
    where: { id: parsed.debtId, userId: session.user.id },
  });
  if (!debt) throw new Error("Debt not found");

  const currentRemaining = Number(debt.remainingAmount);
  const paymentAmount = Math.min(parsed.amount, currentRemaining);
  const newRemaining = currentRemaining - paymentAmount;
  const isPaidOff = newRemaining <= 0;

  await db.debt.update({
    where: { id: parsed.debtId },
    data: {
      remainingAmount: Math.max(newRemaining, 0),
      isPaidOff,
    },
  });

  // Check debt achievements
  const { checkAchievements } = await import("@/actions/gamification");
  await checkAchievements("debt_payment");
  if (isPaidOff) {
    await checkAchievements("debt_paid_off");
  }

  revalidatePath("/debts");
  revalidatePath("/");
  return { success: true, isPaidOff, newRemaining: Math.max(newRemaining, 0) };
}

export async function deleteDebt(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const existing = await db.debt.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) throw new Error("Debt not found");

  await db.debt.delete({ where: { id } });

  revalidatePath("/debts");
  revalidatePath("/");
  return { success: true };
}
