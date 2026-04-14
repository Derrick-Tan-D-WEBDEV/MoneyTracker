"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getViewUserId } from "@/lib/partner-view";

export async function getCategories(type?: "EXPENSE" | "INCOME") {
  const userId = await getViewUserId();

  const where: Record<string, unknown> = {
    OR: [{ userId }, { isDefault: true }],
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
