"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewUserId } from "@/lib/partner-view";
import { getEncryptionKey, encrypt, decrypt, encryptAmount, decryptAmount } from "@/lib/encryption";

const wishlistSchema = z.object({
  name: z.string().min(1),
  estimatedCost: z.number().positive(),
  currency: z.string().min(1),
  priority: z.number().int().min(1).max(5).default(3),
  targetDate: z.string().optional().nullable(),
  url: z.string().url().optional().nullable().or(z.literal("")),
  notes: z.string().optional().nullable(),
});

export async function getWishlistItems() {
  const userId = await getViewUserId();
  const encKey = await getEncryptionKey();

  const items = await db.wishlistItem.findMany({
    where: { userId },
    orderBy: [{ isPurchased: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
  });

  return items.map((item) => ({
    id: item.id,
    name: decrypt(item.name, encKey),
    estimatedCost: decryptAmount(item.estimatedCost, encKey),
    currency: item.currency,
    priority: item.priority,
    targetDate: item.targetDate?.toISOString() ?? null,
    url: item.url ? decrypt(item.url, encKey) : item.url,
    notes: item.notes ? decrypt(item.notes, encKey) : item.notes,
    isPurchased: item.isPurchased,
    createdAt: item.createdAt.toISOString(),
  }));
}

export async function createWishlistItem(data: z.input<typeof wishlistSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const encKey = await getEncryptionKey();

  const parsed = wishlistSchema.parse(data);

  await db.wishlistItem.create({
    data: {
      userId: session.user.id,
      name: encrypt(parsed.name, encKey),
      estimatedCost: encryptAmount(parsed.estimatedCost, encKey),
      currency: parsed.currency,
      priority: parsed.priority,
      targetDate: parsed.targetDate ? new Date(parsed.targetDate) : null,
      url: parsed.url ? encrypt(parsed.url, encKey) : null,
      notes: parsed.notes ? encrypt(parsed.notes, encKey) : null,
    },
  });

  revalidatePath("/wishlist");
}

export async function toggleWishlistItem(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const item = await db.wishlistItem.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!item) throw new Error("Not found");

  await db.wishlistItem.update({
    where: { id },
    data: { isPurchased: !item.isPurchased },
  });

  revalidatePath("/wishlist");
}

export async function updateWishlistItem(id: string, data: z.input<typeof wishlistSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const encKey = await getEncryptionKey();

  const existing = await db.wishlistItem.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) throw new Error("Not found");

  const parsed = wishlistSchema.parse(data);

  await db.wishlistItem.update({
    where: { id },
    data: {
      name: encrypt(parsed.name, encKey),
      estimatedCost: encryptAmount(parsed.estimatedCost, encKey),
      currency: parsed.currency,
      priority: parsed.priority,
      targetDate: parsed.targetDate ? new Date(parsed.targetDate) : null,
      url: parsed.url ? encrypt(parsed.url, encKey) : null,
      notes: parsed.notes ? encrypt(parsed.notes, encKey) : null,
    },
  });

  revalidatePath("/wishlist");
}

export async function deleteWishlistItem(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  await db.wishlistItem.deleteMany({
    where: { id, userId: session.user.id },
  });

  revalidatePath("/wishlist");
}
