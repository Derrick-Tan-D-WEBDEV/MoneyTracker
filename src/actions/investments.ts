"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewUserId } from "@/lib/partner-view";

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

  const investments = await db.investment.findMany({
    where: { userId },
    include: { account: true },
    orderBy: { createdAt: "desc" },
  });

  return investments.map((inv) => ({
    id: inv.id,
    symbol: inv.symbol,
    name: inv.name,
    type: inv.type,
    quantity: Number(inv.quantity),
    buyPrice: Number(inv.buyPrice),
    currentPrice: Number(inv.currentPrice),
    totalValue: Number(inv.currentPrice) * Number(inv.quantity),
    totalCost: Number(inv.buyPrice) * Number(inv.quantity),
    pnl: (Number(inv.currentPrice) - Number(inv.buyPrice)) * Number(inv.quantity),
    pnlPercentage: Number(inv.buyPrice) > 0 ? ((Number(inv.currentPrice) - Number(inv.buyPrice)) / Number(inv.buyPrice)) * 100 : 0,
    currency: inv.currency,
    buyDate: inv.buyDate.toISOString(),
    notes: inv.notes,
    account: inv.account ? { id: inv.account.id, name: inv.account.name } : null,
  }));
}

export async function createInvestment(data: z.input<typeof investmentSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = investmentSchema.parse(data);

  const investment = await db.investment.create({
    data: {
      ...parsed,
      userId: session.user.id,
      accountId: parsed.accountId || null,
      symbol: parsed.symbol || null,
      notes: parsed.notes || null,
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
      symbol: parsed.symbol || null,
      notes: parsed.notes || null,
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
