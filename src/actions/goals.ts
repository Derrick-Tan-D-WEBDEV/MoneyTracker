"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const goalSchema = z.object({
  name: z.string().min(1, "Name is required"),
  targetAmount: z.number().positive("Target amount must be positive"),
  currentAmount: z.number().min(0).default(0),
  type: z.enum(["PROPERTY", "VEHICLE", "EMERGENCY_FUND", "RETIREMENT", "VACATION", "EDUCATION", "CUSTOM"]).default("CUSTOM"),
  accountId: z
    .union([z.string().uuid(), z.literal(""), z.null(), z.undefined()])
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  deadline: z
    .string()
    .optional()
    .nullable()
    .transform((s) => (s ? new Date(s) : null)),
  interestRate: z.number().min(0).max(100).default(0),
  monthlyContribution: z.number().min(0).default(0),
  icon: z.string().default("target"),
  color: z.string().default("#10B981"),
});

export async function getGoals() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const goals = await db.goal.findMany({
    where: { userId: session.user.id },
    include: { account: { select: { id: true, name: true, type: true, currency: true } } },
    orderBy: { createdAt: "desc" },
  });

  return goals.map((g) => {
    const currentAmount = Number(g.currentAmount);
    const targetAmount = Number(g.targetAmount);
    const interestRate = Number(g.interestRate);
    const monthlyContribution = Number(g.monthlyContribution);
    const remaining = Math.max(targetAmount - currentAmount, 0);
    const percentage = targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0;

    // Project months to goal with compound interest
    let monthsToGoal: number | null = null;
    if (remaining > 0 && monthlyContribution > 0) {
      const monthlyRate = interestRate / 100 / 12;
      if (monthlyRate > 0) {
        // FV = PV*(1+r)^n + PMT*((1+r)^n - 1)/r
        // Solve for n when FV = target
        // n = ln((PMT + target*r) / (PMT + current*r)) / ln(1+r)
        const numerator = monthlyContribution + targetAmount * monthlyRate;
        const denominator = monthlyContribution + currentAmount * monthlyRate;
        if (denominator > 0 && numerator > 0) {
          monthsToGoal = Math.ceil(Math.log(numerator / denominator) / Math.log(1 + monthlyRate));
        }
      } else {
        monthsToGoal = Math.ceil(remaining / monthlyContribution);
      }
    }

    return {
      id: g.id,
      name: g.name,
      targetAmount,
      currentAmount,
      type: g.type,
      deadline: g.deadline?.toISOString() || null,
      interestRate,
      monthlyContribution,
      icon: g.icon,
      color: g.color,
      percentage,
      remaining,
      monthsToGoal,
      account: g.account ? { id: g.account.id, name: g.account.name, type: g.account.type, currency: g.account.currency } : null,
    };
  });
}

export async function createGoal(data: z.input<typeof goalSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = goalSchema.parse(data);
  const { accountId, ...rest } = parsed;

  // Verify account belongs to user if provided
  if (accountId) {
    const account = await db.financialAccount.findFirst({
      where: { id: accountId, userId: session.user.id },
    });
    if (!account) throw new Error("Account not found");
  }

  const goal = await db.goal.create({
    data: {
      ...rest,
      accountId: accountId || null,
      userId: session.user.id,
    },
  });

  revalidatePath("/");
  revalidatePath("/goals");
  return { id: goal.id };
}

export async function checkGoalAchievements() {
  const { checkAchievements } = await import("@/actions/gamification");
  return checkAchievements("goal");
}

export async function updateGoal(id: string, data: z.input<typeof goalSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const existing = await db.goal.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) throw new Error("Goal not found");

  const parsed = goalSchema.parse(data);

  await db.goal.update({
    where: { id },
    data: parsed,
  });

  revalidatePath("/");
  revalidatePath("/goals");
}

export async function addContribution(id: string, amount: number) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  if (amount <= 0) throw new Error("Amount must be positive");

  const goal = await db.goal.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!goal) throw new Error("Goal not found");

  const updated = await db.goal.update({
    where: { id },
    data: { currentAmount: { increment: amount } },
  });

  const { checkAchievements } = await import("@/actions/gamification");

  // Award XP for contribution
  await checkAchievements("goal_contribution");

  // Check if goal is now complete
  if (Number(updated.currentAmount) >= Number(updated.targetAmount)) {
    await checkAchievements("goal_complete");
  }

  revalidatePath("/");
  revalidatePath("/goals");
}

export async function deleteGoal(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const goal = await db.goal.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!goal) throw new Error("Goal not found");

  await db.goal.delete({ where: { id } });

  revalidatePath("/");
  revalidatePath("/goals");
}
