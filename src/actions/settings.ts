"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { SUPPORTED_CURRENCIES, DATE_FORMATS } from "@/lib/constants";
import { getEncryptionKey, deriveKey, reEncryptUserData } from "@/lib/encryption";

const profileSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  currency: z.enum(SUPPORTED_CURRENCIES),
  dateFormat: z.enum(DATE_FORMATS),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export async function getProfile() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      currency: true,
      dateFormat: true,
      password: true,
      xp: true,
      level: true,
      streak: true,
      lastActiveDate: true,
      createdAt: true,
    },
  });

  if (!user) throw new Error("User not found");

  return {
    ...user,
    hasPassword: !!user.password,
    password: undefined,
  };
}

export async function updateProfile(data: z.infer<typeof profileSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = profileSchema.parse(data);

  await db.user.update({
    where: { id: session.user.id },
    data: {
      name: parsed.name,
      currency: parsed.currency,
      dateFormat: parsed.dateFormat,
    },
  });

  // Trigger profile achievement
  const { checkAchievements } = await import("@/actions/gamification");
  await checkAchievements("profile");

  revalidatePath("/");
  revalidatePath("/settings");
  return { success: true };
}

export async function updatePassword(data: z.input<typeof passwordSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = passwordSchema.parse(data);

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { password: true, encryptionSalt: true },
  });

  if (!user) throw new Error("User not found");

  if (user.password) {
    const valid = await bcrypt.compare(parsed.currentPassword, user.password);
    if (!valid) throw new Error("Current password is incorrect");
  }

  const hashedPassword = await bcrypt.hash(parsed.newPassword, 12);

  // Re-encrypt all user data with new key derived from new password
  if (user.encryptionSalt) {
    const oldKey = await getEncryptionKey();
    const newKey = deriveKey(parsed.newPassword, user.encryptionSalt);
    await reEncryptUserData(session.user.id, oldKey, newKey);
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { password: hashedPassword },
  });

  return { success: true };
}
