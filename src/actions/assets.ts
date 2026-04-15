"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewUserId } from "@/lib/partner-view";

const assetSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["PROPERTY", "VEHICLE", "COLLECTIBLE", "OTHER"]),
  purchasePrice: z.number().min(0, "Purchase price must be non-negative"),
  currentValue: z.number().min(0, "Current value must be non-negative"),
  currency: z.string().default("USD"),
  purchaseDate: z
    .string()
    .optional()
    .nullable()
    .transform((s) => (s ? new Date(s) : null)),
  lastValuedDate: z
    .string()
    .optional()
    .nullable()
    .transform((s) => (s ? new Date(s) : null)),
  location: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  icon: z.string().default("package"),
  color: z.string().default("#6366F1"),
  notes: z.string().optional().nullable(),
});

export async function getAssets() {
  const userId = await getViewUserId();

  const assets = await db.asset.findMany({
    where: { userId },
    orderBy: [{ isSold: "asc" }, { currentValue: "desc" }],
  });

  return assets.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    purchasePrice: Number(a.purchasePrice),
    currentValue: Number(a.currentValue),
    currency: a.currency,
    purchaseDate: a.purchaseDate?.toISOString() || null,
    lastValuedDate: a.lastValuedDate?.toISOString() || null,
    location: a.location,
    description: a.description,
    icon: a.icon,
    color: a.color,
    isSold: a.isSold,
    notes: a.notes,
    createdAt: a.createdAt.toISOString(),
    // Computed
    gainLoss: Number(a.currentValue) - Number(a.purchasePrice),
    gainLossPercentage: Number(a.purchasePrice) > 0 ? ((Number(a.currentValue) - Number(a.purchasePrice)) / Number(a.purchasePrice)) * 100 : 0,
  }));
}

export async function createAsset(data: z.input<typeof assetSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = assetSchema.parse(data);

  const asset = await db.asset.create({
    data: {
      ...parsed,
      userId: session.user.id,
    },
  });

  revalidatePath("/");
  revalidatePath("/assets");
  return { id: asset.id };
}

export async function updateAsset(id: string, data: z.input<typeof assetSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const existing = await db.asset.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) throw new Error("Asset not found");

  const parsed = assetSchema.parse(data);

  await db.asset.update({
    where: { id },
    data: parsed,
  });

  revalidatePath("/");
  revalidatePath("/assets");
}

export async function updateAssetValue(id: string, currentValue: number) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const existing = await db.asset.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) throw new Error("Asset not found");

  await db.asset.update({
    where: { id },
    data: { currentValue, lastValuedDate: new Date() },
  });

  revalidatePath("/");
  revalidatePath("/assets");
}

export async function markAssetSold(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const existing = await db.asset.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) throw new Error("Asset not found");

  await db.asset.update({
    where: { id },
    data: { isSold: true },
  });

  revalidatePath("/");
  revalidatePath("/assets");
}

export async function deleteAsset(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const existing = await db.asset.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) throw new Error("Asset not found");

  await db.asset.delete({ where: { id } });

  revalidatePath("/");
  revalidatePath("/assets");
}
