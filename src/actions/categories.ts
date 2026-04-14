"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function getCategories(type?: "EXPENSE" | "INCOME") {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const where: Record<string, unknown> = {
    OR: [{ userId: session.user.id }, { isDefault: true }],
  };

  if (type) {
    where.type = type;
  }

  const categories = await db.category.findMany({
    where,
    orderBy: { name: "asc" },
  });

  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    icon: c.icon,
    color: c.color,
    isDefault: c.isDefault,
  }));
}
