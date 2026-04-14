"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewUserId } from "@/lib/partner-view";

const subscriptionSchema = z.object({
  name: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().min(1),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
  nextBillingDate: z.string().transform((s) => new Date(s)),
  categoryId: z.string().uuid().optional().nullable(),
  url: z.string().url().optional().nullable().or(z.literal("")),
  icon: z.string().optional(),
  color: z.string().optional(),
  notes: z.string().optional().nullable(),
});

export async function getSubscriptions() {
  const userId = await getViewUserId();

  const subscriptions = await db.subscription.findMany({
    where: { userId },
    include: { category: true },
    orderBy: [{ isActive: "desc" }, { nextBillingDate: "asc" }],
  });

  return subscriptions.map((s) => ({
    id: s.id,
    name: s.name,
    amount: Number(s.amount),
    currency: s.currency,
    frequency: s.frequency,
    nextBillingDate: s.nextBillingDate.toISOString(),
    category: s.category ? { id: s.category.id, name: s.category.name, color: s.category.color } : null,
    url: s.url,
    icon: s.icon,
    color: s.color,
    isActive: s.isActive,
    notes: s.notes,
  }));
}

export async function createSubscription(data: z.input<typeof subscriptionSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = subscriptionSchema.parse(data);

  await db.subscription.create({
    data: {
      userId: session.user.id,
      name: parsed.name,
      amount: parsed.amount,
      currency: parsed.currency,
      frequency: parsed.frequency,
      nextBillingDate: parsed.nextBillingDate,
      categoryId: parsed.categoryId || null,
      url: parsed.url || null,
      icon: parsed.icon || "repeat",
      color: parsed.color || "#8B5CF6",
      notes: parsed.notes || null,
    },
  });

  revalidatePath("/subscriptions");
  revalidatePath("/calendar");
}

export async function toggleSubscription(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const sub = await db.subscription.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!sub) throw new Error("Subscription not found");

  await db.subscription.update({
    where: { id },
    data: { isActive: !sub.isActive },
  });

  revalidatePath("/subscriptions");
  revalidatePath("/calendar");
}

export async function updateSubscription(id: string, data: z.input<typeof subscriptionSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const existing = await db.subscription.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) throw new Error("Subscription not found");

  const parsed = subscriptionSchema.parse(data);

  await db.subscription.update({
    where: { id },
    data: {
      name: parsed.name,
      amount: parsed.amount,
      currency: parsed.currency,
      frequency: parsed.frequency,
      nextBillingDate: parsed.nextBillingDate,
      categoryId: parsed.categoryId || null,
      url: parsed.url || null,
      notes: parsed.notes || null,
    },
  });

  revalidatePath("/subscriptions");
  revalidatePath("/calendar");
}

export async function deleteSubscription(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  await db.subscription.delete({
    where: { id, userId: session.user.id },
  });

  revalidatePath("/subscriptions");
  revalidatePath("/calendar");
}
