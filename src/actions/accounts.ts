"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewUserId } from "@/lib/partner-view";
import { getEncryptionKey, encrypt, decrypt, encryptAmount, decryptAmount } from "@/lib/encryption";

const accountSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["CHECKING", "SAVINGS", "CREDIT_CARD", "CASH", "INVESTMENT", "CRYPTO", "LOAN"]),
  balance: z.number(),
  reservedAmount: z.number().min(0).default(0),
  currency: z.string().default("USD"),
  color: z.string().default("#3B82F6"),
  icon: z.string().default("wallet"),
  creditLimit: z.number().min(0).optional().nullable(),
  repaymentDay: z.number().int().min(1).max(31).optional().nullable(),
});

export async function getAccounts() {
  const userId = await getViewUserId();
  const encKey = await getEncryptionKey();

  const accounts = await db.financialAccount.findMany({
    where: { userId, isArchived: false },
    orderBy: { createdAt: "desc" },
  });

  return accounts.map((a) => ({
    id: a.id,
    name: decrypt(a.name, encKey),
    type: a.type,
    balance: decryptAmount(a.balance, encKey),
    reservedAmount: decryptAmount(a.reservedAmount, encKey),
    currency: a.currency,
    color: a.color,
    icon: a.icon,
    creditLimit: a.creditLimit ? decryptAmount(a.creditLimit, encKey) : null,
    repaymentDay: a.repaymentDay,
  }));
}

export async function createAccount(data: z.infer<typeof accountSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const encKey = await getEncryptionKey();

  const parsed = accountSchema.parse(data);

  const account = await db.financialAccount.create({
    data: {
      ...parsed,
      balance: encryptAmount(parsed.balance, encKey),
      reservedAmount: encryptAmount(parsed.reservedAmount, encKey),
      creditLimit: parsed.creditLimit != null ? encryptAmount(parsed.creditLimit, encKey) : null,
      name: encrypt(parsed.name, encKey),
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
  const encKey = await getEncryptionKey();

  const existing = await db.financialAccount.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) throw new Error("Account not found");

  const parsed = accountSchema.parse(data);

  const oldBalance = decryptAmount(existing.balance, encKey);
  const newBalance = parsed.balance;
  const diff = newBalance - oldBalance;

  // Create adjustment transaction if balance changed
  if (Math.abs(diff) >= 0.01) {
    await db.transaction.create({
      data: {
        userId: session.user.id,
        accountId: id,
        type: diff > 0 ? "INCOME" : "EXPENSE",
        amount: encryptAmount(Math.abs(diff), encKey),
        description: encrypt("Balance adjustment", encKey),
        date: new Date(),
        notes: encrypt(`Adjusted from ${oldBalance.toFixed(2)} to ${newBalance.toFixed(2)}`, encKey),
        isAdjustment: true,
      },
    });
  }

  await db.financialAccount.update({
    where: { id },
    data: {
      ...parsed,
      balance: encryptAmount(parsed.balance, encKey),
      reservedAmount: encryptAmount(parsed.reservedAmount, encKey),
      creditLimit: parsed.creditLimit != null ? encryptAmount(parsed.creditLimit, encKey) : null,
      name: encrypt(parsed.name, encKey),
    },
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
