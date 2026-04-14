import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const defaultCategories = [
  // Expense categories
  { name: "Food & Dining", type: "EXPENSE" as const, icon: "utensils", color: "#EF4444" },
  { name: "Transportation", type: "EXPENSE" as const, icon: "car", color: "#F97316" },
  { name: "Housing", type: "EXPENSE" as const, icon: "home", color: "#8B5CF6" },
  { name: "Utilities", type: "EXPENSE" as const, icon: "zap", color: "#EAB308" },
  { name: "Entertainment", type: "EXPENSE" as const, icon: "film", color: "#EC4899" },
  { name: "Shopping", type: "EXPENSE" as const, icon: "shopping-bag", color: "#14B8A6" },
  { name: "Healthcare", type: "EXPENSE" as const, icon: "heart-pulse", color: "#06B6D4" },
  { name: "Education", type: "EXPENSE" as const, icon: "graduation-cap", color: "#6366F1" },
  { name: "Personal", type: "EXPENSE" as const, icon: "user", color: "#A855F7" },
  { name: "Insurance", type: "EXPENSE" as const, icon: "shield", color: "#64748B" },
  { name: "Subscriptions", type: "EXPENSE" as const, icon: "repeat", color: "#F43F5E" },
  { name: "Other Expense", type: "EXPENSE" as const, icon: "circle-dot", color: "#9CA3AF" },
  // Income categories
  { name: "Salary", type: "INCOME" as const, icon: "briefcase", color: "#22C55E" },
  { name: "Freelance", type: "INCOME" as const, icon: "laptop", color: "#3B82F6" },
  { name: "Investment Returns", type: "INCOME" as const, icon: "trending-up", color: "#10B981" },
  { name: "Rental Income", type: "INCOME" as const, icon: "building", color: "#8B5CF6" },
  { name: "Side Business", type: "INCOME" as const, icon: "store", color: "#F59E0B" },
  { name: "Other Income", type: "INCOME" as const, icon: "plus-circle", color: "#6B7280" },
];

async function main() {
  console.log("Seeding default categories...");

  for (const category of defaultCategories) {
    const existing = await prisma.category.findFirst({
      where: { name: category.name, isDefault: true },
    });
    if (!existing) {
      await prisma.category.create({
        data: {
          name: category.name,
          type: category.type,
          icon: category.icon,
          color: category.color,
          isDefault: true,
          userId: null,
        },
      });
    }
  }

  console.log(`Seeded ${defaultCategories.length} default categories.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
