import "dotenv/config";
import { PrismaClient } from "./src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Replicate getCategories("EXPENSE") exactly
  const userId = "00000000-0000-0000-0000-000000000000"; // fake UUID
  const type = "EXPENSE";

  const where: Record<string, unknown> = {
    OR: [{ userId }, { isDefault: true }],
  };
  where.type = type;

  console.log("Where clause:", JSON.stringify(where, null, 2));

  try {
    const categories = await prisma.category.findMany({
      where,
      orderBy: { name: "asc" },
    });
    console.log("Categories found:", categories.length);
    categories.forEach((c) => console.log(` - ${c.name} (${c.type})`));
  } catch (e) {
    console.error("Error:", e);
  }

  await prisma.$disconnect();
}

main();
