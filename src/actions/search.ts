"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getViewUserId } from "@/lib/partner-view";
import { getEncryptionKey, decrypt, decryptAmount } from "@/lib/encryption";

export interface SearchResult {
  id: string;
  type: "transaction" | "account" | "category" | "goal" | "investment" | "debt" | "subscription" | "asset" | "wishlist" | "page";
  title: string;
  subtitle?: string;
  href: string;
  icon?: string;
  color?: string;
}

export async function globalSearch(query: string): Promise<SearchResult[]> {
  if (!query || query.length < 2) return [];

  const userId = await getViewUserId();
  const encKey = await getEncryptionKey();
  const q = query.toLowerCase();

  const results: SearchResult[] = [];

  // Pages (always available, no DB query)
  const pages: SearchResult[] = [
    { id: "page-home", type: "page", title: "Overview", href: "/", icon: "layout-dashboard" },
    { id: "page-transactions", type: "page", title: "Transactions", href: "/transactions", icon: "arrow-left-right" },
    { id: "page-accounts", type: "page", title: "Accounts", href: "/accounts", icon: "wallet" },
    { id: "page-budgets", type: "page", title: "Budgets", href: "/budgets", icon: "target" },
    { id: "page-goals", type: "page", title: "Goals", href: "/goals", icon: "flag" },
    { id: "page-investments", type: "page", title: "Investments", href: "/investments", icon: "trending-up" },
    { id: "page-debts", type: "page", title: "Debts", href: "/debts", icon: "landmark" },
    { id: "page-installments", type: "page", title: "Installments", href: "/installments", icon: "credit-card" },
    { id: "page-subscriptions", type: "page", title: "Subscriptions", href: "/subscriptions", icon: "repeat" },
    { id: "page-recurring", type: "page", title: "Recurring", href: "/recurring", icon: "calendar-clock" },
    { id: "page-calendar", type: "page", title: "Bill Calendar", href: "/calendar", icon: "calendar" },
    { id: "page-assets", type: "page", title: "Assets", href: "/assets", icon: "package" },
    { id: "page-wishlist", type: "page", title: "Wishlist", href: "/wishlist", icon: "gift" },
    { id: "page-reports", type: "page", title: "Reports", href: "/reports", icon: "bar-chart-3" },
    { id: "page-tax", type: "page", title: "Tax Prediction", href: "/tax", icon: "calculator" },
    { id: "page-export", type: "page", title: "Export Data", href: "/export", icon: "download" },
    { id: "page-achievements", type: "page", title: "Achievements", href: "/achievements", icon: "trophy" },
    { id: "page-settings", type: "page", title: "Settings", href: "/settings", icon: "settings" },
    { id: "page-partner", type: "page", title: "Partner", href: "/partner", icon: "heart" },
  ];
  results.push(...pages.filter((p) => p.title.toLowerCase().includes(q)));

  // Categories
  const categories = await db.category.findMany({
    where: { OR: [{ userId }, { isDefault: true }] },
    take: 50,
  });
  for (const cat of categories) {
    if (cat.name.toLowerCase().includes(q)) {
      results.push({
        id: `cat-${cat.id}`,
        type: "category",
        title: cat.name,
        subtitle: cat.type === "INCOME" ? "Income category" : "Expense category",
        href: "/transactions",
        icon: cat.icon,
        color: cat.color,
      });
    }
  }

  // Accounts
  const accounts = await db.financialAccount.findMany({
    where: { userId },
    take: 50,
  });
  for (const acc of accounts) {
    const name = decrypt(acc.name, encKey);
    if (name.toLowerCase().includes(q)) {
      results.push({
        id: `acc-${acc.id}`,
        type: "account",
        title: name,
        subtitle: `${acc.type.replace("_", " ").toLowerCase()} · ${acc.currency}`,
        href: "/accounts",
        icon: acc.icon,
        color: acc.color,
      });
    }
  }

  // Transactions (last 200 for performance)
  const transactions = await db.transaction.findMany({
    where: { userId, isRecurring: false, isAdjustment: false },
    orderBy: { date: "desc" },
    take: 200,
    include: { category: true, account: true },
  });
  for (const tx of transactions) {
    const desc = decrypt(tx.description, encKey);
    const amount = decryptAmount(tx.amount, encKey);
    const amountStr = amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (desc.toLowerCase().includes(q) || amountStr.includes(q)) {
      results.push({
        id: `tx-${tx.id}`,
        type: "transaction",
        title: desc,
        subtitle: `${tx.type} · ${tx.account.currency} ${amountStr} · ${tx.date.toLocaleDateString()}`,
        href: "/transactions",
        color: tx.category?.color,
      });
    }
  }

  // Goals
  const goals = await db.goal.findMany({
    where: { userId },
    take: 50,
  });
  for (const goal of goals) {
    const name = decrypt(goal.name, encKey);
    if (name.toLowerCase().includes(q)) {
      results.push({
        id: `goal-${goal.id}`,
        type: "goal",
        title: name,
        subtitle: "Savings goal",
        href: "/goals",
        icon: goal.icon,
        color: goal.color,
      });
    }
  }

  // Investments
  const investments = await db.investment.findMany({
    where: { userId },
    take: 50,
  });
  for (const inv of investments) {
    const name = decrypt(inv.name, encKey);
    if (name.toLowerCase().includes(q) || inv.symbol?.toLowerCase().includes(q)) {
      results.push({
        id: `inv-${inv.id}`,
        type: "investment",
        title: name,
        subtitle: `${inv.type.replace("_", " ").toLowerCase()}${inv.symbol ? ` · ${inv.symbol}` : ""}`,
        href: "/investments",
        color: "#10B981",
      });
    }
  }

  // Debts
  const debts = await db.debt.findMany({
    where: { userId },
    take: 50,
  });
  for (const debt of debts) {
    const name = decrypt(debt.name, encKey);
    if (name.toLowerCase().includes(q)) {
      results.push({
        id: `debt-${debt.id}`,
        type: "debt",
        title: name,
        subtitle: `${debt.type.replace("_", " ").toLowerCase()}`,
        href: "/debts",
        icon: debt.icon,
        color: debt.color,
      });
    }
  }

  // Subscriptions
  const subs = await db.subscription.findMany({
    where: { userId },
    take: 50,
  });
  for (const sub of subs) {
    if (sub.name.toLowerCase().includes(q)) {
      results.push({
        id: `sub-${sub.id}`,
        type: "subscription",
        title: sub.name,
        subtitle: `Subscription · ${sub.frequency.toLowerCase()}`,
        href: "/subscriptions",
        icon: sub.icon,
        color: sub.color,
      });
    }
  }

  // Assets
  const assets = await db.asset.findMany({
    where: { userId },
    take: 50,
  });
  for (const asset of assets) {
    const name = decrypt(asset.name, encKey);
    if (name.toLowerCase().includes(q)) {
      results.push({
        id: `asset-${asset.id}`,
        type: "asset",
        title: name,
        subtitle: asset.type.replace("_", " ").toLowerCase(),
        href: "/assets",
        icon: asset.icon,
        color: asset.color,
      });
    }
  }

  // Wishlist
  const wishes = await db.wishlistItem.findMany({
    where: { userId },
    take: 50,
  });
  for (const wish of wishes) {
    const name = decrypt(wish.name, encKey);
    if (name.toLowerCase().includes(q)) {
      results.push({
        id: `wish-${wish.id}`,
        type: "wishlist",
        title: name,
        subtitle: "Wishlist item",
        href: "/wishlist",
        color: "#EC4899",
      });
    }
  }

  return results.slice(0, 25);
}
