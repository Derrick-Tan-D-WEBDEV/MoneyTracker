"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewUserId } from "@/lib/partner-view";
import { getEncryptionKey, encrypt, decrypt, encryptAmount, decryptAmount } from "@/lib/encryption";

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
  const encKey = await getEncryptionKey();

  const assets = await db.asset.findMany({
    where: { userId },
    orderBy: [{ isSold: "asc" }, { createdAt: "desc" }],
  });

  return assets.map((a) => ({
    id: a.id,
    name: decrypt(a.name, encKey),
    type: a.type,
    purchasePrice: decryptAmount(a.purchasePrice, encKey),
    currentValue: decryptAmount(a.currentValue, encKey),
    currency: a.currency,
    purchaseDate: a.purchaseDate?.toISOString() || null,
    lastValuedDate: a.lastValuedDate?.toISOString() || null,
    location: a.location ? decrypt(a.location, encKey) : a.location,
    description: a.description ? decrypt(a.description, encKey) : a.description,
    icon: a.icon,
    color: a.color,
    isSold: a.isSold,
    notes: a.notes ? decrypt(a.notes, encKey) : a.notes,
    createdAt: a.createdAt.toISOString(),
    // Computed
    gainLoss: decryptAmount(a.currentValue, encKey) - decryptAmount(a.purchasePrice, encKey),
    gainLossPercentage:
      decryptAmount(a.purchasePrice, encKey) > 0 ? ((decryptAmount(a.currentValue, encKey) - decryptAmount(a.purchasePrice, encKey)) / decryptAmount(a.purchasePrice, encKey)) * 100 : 0,
  }));
}

export async function createAsset(data: z.input<typeof assetSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const encKey = await getEncryptionKey();

  const parsed = assetSchema.parse(data);

  const asset = await db.asset.create({
    data: {
      ...parsed,
      name: encrypt(parsed.name, encKey),
      location: parsed.location ? encrypt(parsed.location, encKey) : parsed.location,
      description: parsed.description ? encrypt(parsed.description, encKey) : parsed.description,
      notes: parsed.notes ? encrypt(parsed.notes, encKey) : parsed.notes,
      purchasePrice: encryptAmount(parsed.purchasePrice, encKey),
      currentValue: encryptAmount(parsed.currentValue, encKey),
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
  const encKey = await getEncryptionKey();

  const existing = await db.asset.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) throw new Error("Asset not found");

  const parsed = assetSchema.parse(data);

  await db.asset.update({
    where: { id },
    data: {
      ...parsed,
      name: encrypt(parsed.name, encKey),
      location: parsed.location ? encrypt(parsed.location, encKey) : parsed.location,
      description: parsed.description ? encrypt(parsed.description, encKey) : parsed.description,
      notes: parsed.notes ? encrypt(parsed.notes, encKey) : parsed.notes,
      purchasePrice: encryptAmount(parsed.purchasePrice, encKey),
      currentValue: encryptAmount(parsed.currentValue, encKey),
    },
  });

  revalidatePath("/");
  revalidatePath("/assets");
}

export async function updateAssetValue(id: string, currentValue: number) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const encKey = await getEncryptionKey();

  const existing = await db.asset.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) throw new Error("Asset not found");

  await db.asset.update({
    where: { id },
    data: { currentValue: encryptAmount(currentValue, encKey), lastValuedDate: new Date() },
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
