"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

// Generate a short invite code
function generateInviteCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

/** Create or get an existing invite link */
export async function createInviteLink() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const userId = session.user.id;

  // Check if user already has an active link (as either user or partner)
  const existingActive = await db.coupleLink.findFirst({
    where: {
      OR: [
        { userId, status: "ACCEPTED" },
        { partnerId: userId, status: "ACCEPTED" },
      ],
    },
  });

  if (existingActive) {
    throw new Error("You already have an active couple link");
  }

  // Check if there's already a pending invite from this user
  const existingPending = await db.coupleLink.findFirst({
    where: { userId, status: "PENDING" },
  });

  if (existingPending) {
    return { inviteCode: existingPending.inviteCode };
  }

  // Create new invite
  const inviteCode = generateInviteCode();
  await db.coupleLink.create({
    data: { userId, inviteCode },
  });

  revalidatePath("/settings");
  return { inviteCode };
}

/** Accept an invite link using a code */
export async function acceptInviteLink(inviteCode: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const partnerId = session.user.id;

  const link = await db.coupleLink.findUnique({
    where: { inviteCode },
  });

  if (!link) throw new Error("Invalid invite code");
  if (link.status !== "PENDING") throw new Error("This invite is no longer valid");
  if (link.userId === partnerId) throw new Error("You cannot link with yourself");

  // Check if partner already has an active link
  const partnerActive = await db.coupleLink.findFirst({
    where: {
      OR: [
        { userId: partnerId, status: "ACCEPTED" },
        { partnerId, status: "ACCEPTED" },
      ],
    },
  });

  if (partnerActive) {
    throw new Error("You already have an active couple link");
  }

  await db.coupleLink.update({
    where: { id: link.id },
    data: {
      partnerId,
      status: "ACCEPTED",
      acceptedAt: new Date(),
    },
  });

  revalidatePath("/settings");
  revalidatePath("/");
  return { success: true };
}

/** Get current couple link status */
export async function getCoupleLink() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const userId = session.user.id;

  // Find active or pending link
  const link = await db.coupleLink.findFirst({
    where: {
      OR: [
        { userId, status: { in: ["ACCEPTED", "PENDING"] } },
        { partnerId: userId, status: "ACCEPTED" },
      ],
    },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
      partner: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!link) return null;

  // Determine who the partner is from the current user's perspective
  const isInitiator = link.userId === userId;
  const partner = isInitiator ? link.partner : link.user;

  return {
    id: link.id,
    status: link.status,
    inviteCode: link.status === "PENDING" && isInitiator ? link.inviteCode : null,
    partner: partner
      ? {
          id: partner.id,
          name: partner.name,
          email: partner.email,
          image: partner.image,
        }
      : null,
    isInitiator,
    createdAt: link.createdAt.toISOString(),
    acceptedAt: link.acceptedAt?.toISOString() || null,
  };
}

/** Unlink from partner */
export async function unlinkPartner() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const userId = session.user.id;

  const link = await db.coupleLink.findFirst({
    where: {
      OR: [
        { userId, status: { in: ["ACCEPTED", "PENDING"] } },
        { partnerId: userId, status: "ACCEPTED" },
      ],
    },
  });

  if (!link) throw new Error("No couple link found");

  await db.coupleLink.delete({ where: { id: link.id } });

  revalidatePath("/settings");
  revalidatePath("/");
  return { success: true };
}

/** Get partner's dashboard data (read-only view) */
export async function getPartnerDashboardData() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const userId = session.user.id;

  // Find active couple link
  const link = await db.coupleLink.findFirst({
    where: {
      OR: [
        { userId, status: "ACCEPTED" },
        { partnerId: userId, status: "ACCEPTED" },
      ],
    },
    include: {
      user: { select: { id: true, name: true, email: true, image: true, currency: true } },
      partner: { select: { id: true, name: true, email: true, image: true, currency: true } },
    },
  });

  if (!link || link.status !== "ACCEPTED") return null;

  const isInitiator = link.userId === userId;
  const partner = isInitiator ? link.partner : link.user;
  if (!partner) return null;

  const partnerId = partner.id;
  const partnerCurrency = partner.currency || "USD";

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Fetch partner's data (read-only)
  const [accounts, transactions, budgets, goals, debts] = await Promise.all([
    db.financialAccount.findMany({
      where: { userId: partnerId, isArchived: false },
    }),
    db.transaction.findMany({
      where: { userId: partnerId, date: { gte: startOfMonth } },
      include: { category: true, account: true },
      orderBy: { date: "desc" },
      take: 20,
    }),
    db.budget.findMany({
      where: { userId: partnerId },
      include: { category: true },
    }),
    db.goal.findMany({
      where: { userId: partnerId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.debt.findMany({
      where: { userId: partnerId, isPaidOff: false },
    }),
  ]);

  const totalBalance = accounts.reduce((sum, acc) => sum + Number(acc.balance), 0);
  const monthIncome = transactions.filter((t) => t.type === "INCOME").reduce((sum, t) => sum + Number(t.amount), 0);
  const monthExpenses = transactions.filter((t) => t.type === "EXPENSE").reduce((sum, t) => sum + Number(t.amount), 0);

  return {
    partner: {
      name: partner.name,
      email: partner.email,
      image: partner.image,
      currency: partnerCurrency,
    },
    netWorth: totalBalance,
    currentMonth: {
      income: monthIncome,
      expenses: monthExpenses,
      savings: monthIncome - monthExpenses,
    },
    accounts: accounts.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      balance: Number(a.balance),
      currency: a.currency,
      color: a.color,
      icon: a.icon,
    })),
    recentTransactions: transactions.slice(0, 10).map((t) => ({
      id: t.id,
      type: t.type,
      amount: Number(t.amount),
      description: t.description,
      date: t.date.toISOString(),
      category: t.category?.name || "Uncategorized",
      categoryIcon: t.category?.icon || "tag",
      accountName: t.account.name,
    })),
    goals: goals.map((g) => ({
      id: g.id,
      name: g.name,
      targetAmount: Number(g.targetAmount),
      currentAmount: Number(g.currentAmount),
      type: g.type,
      icon: g.icon,
      color: g.color,
    })),
    debts: debts.map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      originalAmount: Number(d.originalAmount),
      remainingAmount: Number(d.remainingAmount),
    })),
    totalDebt: debts.reduce((sum, d) => sum + Number(d.remainingAmount), 0),
  };
}
