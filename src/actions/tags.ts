"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewUserId } from "@/lib/partner-view";
import { getEncryptionKey, encrypt, decrypt } from "@/lib/encryption";

export async function getTags() {
  const userId = await getViewUserId();
  const encKey = await getEncryptionKey();

  const tags = await db.tag.findMany({
    where: { userId },
    orderBy: { name: "asc" },
  });

  return tags.map((t) => ({
    id: t.id,
    name: decrypt(t.name, encKey),
    color: t.color,
  }));
}

const tagSchema = z.object({
  name: z.string().min(1).max(30),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export async function createTag(data: z.input<typeof tagSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const encKey = await getEncryptionKey();

  const parsed = tagSchema.parse(data);

  const tag = await db.tag.create({
    data: {
      userId: session.user.id,
      name: encrypt(parsed.name, encKey),
      color: parsed.color,
    },
  });

  revalidatePath("/transactions");
  return { id: tag.id, name: parsed.name, color: tag.color };
}

export async function deleteTag(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  await db.tag.delete({
    where: { id, userId: session.user.id },
  });

  revalidatePath("/transactions");
}

export async function updateTransactionTags(transactionId: string, tagIds: string[]) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const transaction = await db.transaction.findFirst({
    where: { id: transactionId, userId: session.user.id },
  });
  if (!transaction) throw new Error("Transaction not found");

  await db.transaction.update({
    where: { id: transactionId },
    data: {
      tags: {
        set: tagIds.map((id) => ({ id })),
      },
    },
  });

  revalidatePath("/transactions");
}
