"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewUserId } from "@/lib/partner-view";
import { getEncryptionKey, encrypt, decrypt, encryptAmount, decryptAmount } from "@/lib/encryption";

const investmentSchema = z.object({
  accountId: z.string().uuid().optional().nullable(),
  symbol: z.string().optional().nullable(),
  name: z.string().min(1, "Name is required"),
  type: z.enum(["STOCK", "CRYPTO", "MUTUAL_FUND", "BOND", "ETF", "REAL_ESTATE", "OTHER"]),
  quantity: z.number().positive("Quantity must be positive"),
  buyPrice: z.number().positive("Buy price must be positive"),
  currentPrice: z.number().min(0, "Current price must be non-negative"),
  currency: z.string().default("USD"),
  buyDate: z.string().transform((s) => new Date(s)),
  notes: z.string().optional().nullable(),
});

export async function getInvestments() {
  const userId = await getViewUserId();
  const encKey = await getEncryptionKey();

  const investments = await db.investment.findMany({
    where: { userId },
    include: { account: true },
    orderBy: { createdAt: "desc" },
  });

  return investments.map((inv) => ({
    id: inv.id,
    symbol: inv.symbol ? decrypt(inv.symbol, encKey) : inv.symbol,
    name: decrypt(inv.name, encKey),
    type: inv.type,
    quantity: decryptAmount(inv.quantity, encKey),
    buyPrice: decryptAmount(inv.buyPrice, encKey),
    currentPrice: decryptAmount(inv.currentPrice, encKey),
    totalValue: decryptAmount(inv.currentPrice, encKey) * decryptAmount(inv.quantity, encKey),
    totalCost: decryptAmount(inv.buyPrice, encKey) * decryptAmount(inv.quantity, encKey),
    pnl: (decryptAmount(inv.currentPrice, encKey) - decryptAmount(inv.buyPrice, encKey)) * decryptAmount(inv.quantity, encKey),
    pnlPercentage: decryptAmount(inv.buyPrice, encKey) > 0 ? ((decryptAmount(inv.currentPrice, encKey) - decryptAmount(inv.buyPrice, encKey)) / decryptAmount(inv.buyPrice, encKey)) * 100 : 0,
    currency: inv.currency,
    buyDate: inv.buyDate.toISOString(),
    notes: inv.notes ? decrypt(inv.notes, encKey) : inv.notes,
    account: inv.account ? { id: inv.account.id, name: decrypt(inv.account.name, encKey) } : null,
  }));
}

export async function createInvestment(data: z.input<typeof investmentSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const encKey = await getEncryptionKey();

  const parsed = investmentSchema.parse(data);

  const investment = await db.investment.create({
    data: {
      ...parsed,
      userId: session.user.id,
      accountId: parsed.accountId || null,
      symbol: parsed.symbol ? encrypt(parsed.symbol, encKey) : null,
      name: encrypt(parsed.name, encKey),
      notes: parsed.notes ? encrypt(parsed.notes, encKey) : null,
      quantity: encryptAmount(parsed.quantity, encKey),
      buyPrice: encryptAmount(parsed.buyPrice, encKey),
      currentPrice: encryptAmount(parsed.currentPrice, encKey),
    },
  });

  revalidatePath("/");
  revalidatePath("/investments");
  return { id: investment.id };
}

export async function checkInvestmentAchievements() {
  const { checkAchievements } = await import("@/actions/gamification");
  return checkAchievements("investment");
}

export async function updateInvestment(id: string, data: z.input<typeof investmentSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const encKey = await getEncryptionKey();

  const existing = await db.investment.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) throw new Error("Investment not found");

  const parsed = investmentSchema.parse(data);

  await db.investment.update({
    where: { id },
    data: {
      ...parsed,
      accountId: parsed.accountId || null,
      symbol: parsed.symbol ? encrypt(parsed.symbol, encKey) : null,
      name: encrypt(parsed.name, encKey),
      notes: parsed.notes ? encrypt(parsed.notes, encKey) : null,
      quantity: encryptAmount(parsed.quantity, encKey),
      buyPrice: encryptAmount(parsed.buyPrice, encKey),
      currentPrice: encryptAmount(parsed.currentPrice, encKey),
    },
  });

  revalidatePath("/");
  revalidatePath("/investments");
}

export async function deleteInvestment(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const investment = await db.investment.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!investment) throw new Error("Investment not found");

  await db.investment.delete({ where: { id } });

  revalidatePath("/");
  revalidatePath("/investments");
}
