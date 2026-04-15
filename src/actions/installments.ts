"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewUserId } from "@/lib/partner-view";
import { getEncryptionKey, encrypt, decrypt } from "@/lib/encryption";

const installmentSchema = z.object({
  accountId: z.string().uuid(),
  name: z.string().min(1, "Name is required"),
  type: z.enum(["PURCHASE", "BALANCE_TRANSFER"]),
  merchant: z.string().optional().nullable(),
  totalAmount: z.number().positive("Amount must be positive"),
  totalMonths: z.number().int().min(1, "At least 1 month"),
  paidMonths: z.number().int().min(0).default(0),
  interestRate: z.number().min(0).max(100).default(0),
  startDate: z.string().transform((s) => new Date(s)),
  currency: z.string().default("USD"),
  notes: z.string().optional().nullable(),
});

const paymentSchema = z.object({
  installmentId: z.string().uuid(),
  months: z.number().int().min(1).default(1),
});

export async function getInstallments() {
  const userId = await getViewUserId();
  const encKey = await getEncryptionKey();

  const installments = await db.installment.findMany({
    where: { userId },
    include: { account: { select: { id: true, name: true, type: true, color: true, creditLimit: true, repaymentDay: true } } },
    orderBy: [{ isCompleted: "asc" }, { startDate: "desc" }],
  });

  return installments.map((i) => ({
    id: i.id,
    name: decrypt(i.name, encKey),
    type: i.type,
    merchant: i.merchant ? decrypt(i.merchant, encKey) : i.merchant,
    totalAmount: Number(i.totalAmount),
    monthlyPayment: Number(i.monthlyPayment),
    totalMonths: i.totalMonths,
    paidMonths: i.paidMonths,
    remainingMonths: i.totalMonths - i.paidMonths,
    remainingAmount: Number(i.monthlyPayment) * (i.totalMonths - i.paidMonths),
    paidAmount: Number(i.monthlyPayment) * i.paidMonths,
    interestRate: Number(i.interestRate),
    startDate: i.startDate.toISOString(),
    currency: i.currency,
    isCompleted: i.isCompleted,
    notes: i.notes ? decrypt(i.notes, encKey) : i.notes,
    account: i.account ? { ...i.account, name: decrypt(i.account.name, encKey) } : i.account,
    createdAt: i.createdAt.toISOString(),
  }));
}

export async function createInstallment(data: z.input<typeof installmentSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const encKey = await getEncryptionKey();

  const parsed = installmentSchema.parse(data);

  // Verify account belongs to user and is a credit card
  const account = await db.financialAccount.findFirst({
    where: { id: parsed.accountId, userId: session.user.id },
  });
  if (!account) throw new Error("Account not found");

  // Calculate monthly payment
  const monthlyPayment = parsed.totalAmount / parsed.totalMonths;
  const isCompleted = parsed.paidMonths >= parsed.totalMonths;

  await db.installment.create({
    data: {
      userId: session.user.id,
      accountId: parsed.accountId,
      name: encrypt(parsed.name, encKey),
      type: parsed.type,
      merchant: parsed.merchant ? encrypt(parsed.merchant, encKey) : null,
      totalAmount: parsed.totalAmount,
      monthlyPayment,
      totalMonths: parsed.totalMonths,
      paidMonths: parsed.paidMonths,
      isCompleted,
      interestRate: parsed.interestRate,
      startDate: parsed.startDate,
      currency: parsed.currency,
      notes: parsed.notes ? encrypt(parsed.notes, encKey) : null,
    },
  });

  revalidatePath("/installments");
  revalidatePath("/");
  return { success: true };
}

export async function makeInstallmentPayment(data: z.input<typeof paymentSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = paymentSchema.parse(data);

  const installment = await db.installment.findFirst({
    where: { id: parsed.installmentId, userId: session.user.id },
  });
  if (!installment) throw new Error("Installment not found");
  if (installment.isCompleted) throw new Error("Installment already completed");

  const newPaidMonths = Math.min(installment.paidMonths + parsed.months, installment.totalMonths);
  const isCompleted = newPaidMonths >= installment.totalMonths;

  await db.installment.update({
    where: { id: parsed.installmentId },
    data: {
      paidMonths: newPaidMonths,
      isCompleted,
    },
  });

  revalidatePath("/installments");
  revalidatePath("/");
  return { isCompleted, paidMonths: newPaidMonths };
}

export async function updateInstallment(id: string, data: z.input<typeof installmentSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const encKey = await getEncryptionKey();

  const existing = await db.installment.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) throw new Error("Installment not found");

  const parsed = installmentSchema.parse(data);
  const monthlyPayment = parsed.totalAmount / parsed.totalMonths;
  const paidMonths = Math.min(parsed.paidMonths, parsed.totalMonths);
  const isCompleted = paidMonths >= parsed.totalMonths;

  await db.installment.update({
    where: { id },
    data: {
      accountId: parsed.accountId,
      name: encrypt(parsed.name, encKey),
      type: parsed.type,
      merchant: parsed.merchant ? encrypt(parsed.merchant, encKey) : null,
      totalAmount: parsed.totalAmount,
      monthlyPayment,
      totalMonths: parsed.totalMonths,
      paidMonths,
      isCompleted,
      interestRate: parsed.interestRate,
      startDate: parsed.startDate,
      currency: parsed.currency,
      notes: parsed.notes ? encrypt(parsed.notes, encKey) : null,
    },
  });

  revalidatePath("/installments");
  revalidatePath("/");
  return { success: true };
}

export async function deleteInstallment(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const existing = await db.installment.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) throw new Error("Installment not found");

  await db.installment.delete({ where: { id } });

  revalidatePath("/installments");
  revalidatePath("/");
  return { success: true };
}
