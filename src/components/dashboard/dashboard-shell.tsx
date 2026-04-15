"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { QuickAddFab } from "@/components/dashboard/quick-add-fab";
import { AchievementToast } from "@/components/dashboard/achievement-toast";

interface ShellData {
  accounts: { id: string; name: string }[];
  categories: { id: string; name: string; type: string; icon: string; color: string }[];
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { update: updateSession } = useSession();
  const [achievementKey, setAchievementKey] = useState<string | null>(null);
  const [shellData, setShellData] = useState<ShellData | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [{ getAccounts }, { getCategories }, { processRecurringTransactions }, { updateStreak }] = await Promise.all([
          import("@/actions/accounts"),
          import("@/actions/categories"),
          import("@/actions/recurring"),
          import("@/actions/gamification"),
        ]);
        const [accounts, categories] = await Promise.all([getAccounts(), getCategories()]);
        setShellData({
          accounts: accounts.map((a) => ({ id: a.id, name: a.name })),
          categories: categories.map((c) => ({ id: c.id, name: c.name, type: c.type, icon: c.icon, color: c.color })),
        });
        // Auto-process any due recurring transactions in the background
        processRecurringTransactions().catch(() => {});
        // Update daily login streak, then refresh session so streak badge updates
        updateStreak()
          .then(() => updateSession())
          .catch(() => {});
      } catch {
        // Not critical - FAB just won't show
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAchievement = useCallback((key: string) => {
    setAchievementKey(key);
  }, []);

  return (
    <>
      {children}
      {shellData && shellData.accounts.length > 0 && <QuickAddFab accounts={shellData.accounts} categories={shellData.categories} onAchievement={handleAchievement} />}
      <AchievementToast achievementKey={achievementKey} onDismiss={() => setAchievementKey(null)} />
    </>
  );
}
