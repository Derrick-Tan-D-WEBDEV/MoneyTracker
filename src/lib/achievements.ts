export interface AchievementDef {
  key: string;
  name: string;
  description: string;
  icon: string;
  xp: number;
  category: "getting-started" | "transactions" | "budgets" | "investments" | "goals" | "debts" | "streaks" | "savings" | "milestones";
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // ─── Getting Started ─────────────────────────────────
  { key: "FIRST_LOGIN", name: "Welcome Aboard", description: "Create your MoneyTracker account", icon: "🎉", xp: 10, category: "getting-started" },
  { key: "FIRST_ACCOUNT", name: "Bank Day", description: "Add your first financial account", icon: "🏦", xp: 20, category: "getting-started" },
  { key: "PROFILE_COMPLETE", name: "Identity Check", description: "Complete your profile settings", icon: "🪪", xp: 15, category: "getting-started" },
  { key: "THREE_ACCOUNTS", name: "Multi-Banker", description: "Set up 3 financial accounts", icon: "🗂️", xp: 30, category: "getting-started" },

  // ─── Transactions ────────────────────────────────────
  { key: "FIRST_TRANSACTION", name: "First Entry", description: "Record your first transaction", icon: "✏️", xp: 20, category: "transactions" },
  { key: "TEN_TRANSACTIONS", name: "Getting Serious", description: "Record 10 transactions", icon: "📊", xp: 50, category: "transactions" },
  { key: "FIFTY_TRANSACTIONS", name: "Money Tracker Pro", description: "Record 50 transactions", icon: "🏆", xp: 100, category: "transactions" },
  { key: "HUNDRED_TRANSACTIONS", name: "Century Club", description: "Record 100 transactions", icon: "💯", xp: 200, category: "transactions" },
  { key: "FIVE_HUNDRED_TRANSACTIONS", name: "Data Driven", description: "Record 500 transactions", icon: "📚", xp: 500, category: "transactions" },
  { key: "FIRST_INCOME", name: "Payday!", description: "Record your first income", icon: "💰", xp: 15, category: "transactions" },
  { key: "BIG_EARNER", name: "Big Earner", description: "Record a single income over 10,000", icon: "🤑", xp: 50, category: "transactions" },

  // ─── Budgets ─────────────────────────────────────────
  { key: "FIRST_BUDGET", name: "Budget Beginner", description: "Create your first budget", icon: "📋", xp: 20, category: "budgets" },
  { key: "BUDGET_MASTER", name: "Budget Master", description: "Stay under budget for a full month", icon: "🎯", xp: 75, category: "budgets" },
  { key: "FIVE_BUDGETS", name: "Budget Planner", description: "Create 5 budgets", icon: "📐", xp: 40, category: "budgets" },
  { key: "UNDER_BUDGET_ALL", name: "Perfect Month", description: "Stay under budget in ALL categories", icon: "✨", xp: 150, category: "budgets" },

  // ─── Investments ─────────────────────────────────────
  { key: "FIRST_INVESTMENT", name: "Investor Initiate", description: "Add your first investment", icon: "📈", xp: 25, category: "investments" },
  { key: "FIVE_INVESTMENTS", name: "Portfolio Builder", description: "Track 5 or more investments", icon: "💼", xp: 75, category: "investments" },
  { key: "TEN_INVESTMENTS", name: "Wall Street", description: "Track 10 or more investments", icon: "🏛️", xp: 150, category: "investments" },
  { key: "DIVERSIFIED", name: "Diversified", description: "Own 3 different investment types", icon: "🌐", xp: 50, category: "investments" },

  // ─── Goals ───────────────────────────────────────────
  { key: "FIRST_GOAL", name: "Dream Big", description: "Set your first savings goal", icon: "⭐", xp: 20, category: "goals" },
  { key: "GOAL_CRUSHER", name: "Goal Crusher", description: "Complete a savings goal", icon: "🏅", xp: 100, category: "goals" },
  { key: "THREE_GOALS", name: "Ambitious", description: "Have 3 active goals at once", icon: "🚀", xp: 50, category: "goals" },
  { key: "FIVE_GOALS_COMPLETE", name: "Unstoppable", description: "Complete 5 savings goals", icon: "🏆", xp: 250, category: "goals" },
  { key: "GOAL_50_PERCENT", name: "Halfway There", description: "Reach 50% on any goal", icon: "⏳", xp: 25, category: "goals" },

  // ─── Debts & Loans ───────────────────────────────────
  { key: "FIRST_DEBT", name: "Facing It", description: "Track your first debt", icon: "📝", xp: 15, category: "debts" },
  { key: "FIRST_PAYMENT", name: "Chipping Away", description: "Make your first debt payment", icon: "💪", xp: 20, category: "debts" },
  { key: "DEBT_FREE", name: "Debt Free!", description: "Pay off a debt completely", icon: "🎊", xp: 100, category: "debts" },
  { key: "THREE_DEBTS_PAID", name: "Debt Destroyer", description: "Pay off 3 debts", icon: "🔥", xp: 200, category: "debts" },
  { key: "ALL_DEBTS_PAID", name: "Clean Slate", description: "Pay off ALL your debts", icon: "🏆", xp: 500, category: "debts" },

  // ─── Savings & Discipline ────────────────────────────
  { key: "SAVINGS_1K", name: "First Thousand", description: "Total balance reaches 1,000", icon: "💵", xp: 30, category: "savings" },
  { key: "SAVINGS_10K", name: "Five Figures", description: "Total balance reaches 10,000", icon: "💎", xp: 75, category: "savings" },
  { key: "SAVINGS_100K", name: "Six Figures", description: "Total balance reaches 100,000", icon: "🏠", xp: 200, category: "savings" },
  { key: "SAVINGS_1M", name: "Millionaire", description: "Total balance reaches 1,000,000", icon: "🎩", xp: 500, category: "savings" },
  { key: "NO_SPEND_DAY", name: "Zero Spend Day", description: "Log a day with no expenses", icon: "🧘", xp: 10, category: "savings" },
  { key: "SAVINGS_RATE_50", name: "Super Saver", description: "Achieve 50%+ savings rate in a month", icon: "🐖", xp: 100, category: "savings" },

  // ─── Streaks ─────────────────────────────────────────
  { key: "STREAK_3", name: "On a Roll", description: "Maintain a 3-day streak", icon: "🔥", xp: 30, category: "streaks" },
  { key: "STREAK_7", name: "Weekly Warrior", description: "Maintain a 7-day streak", icon: "⚡", xp: 75, category: "streaks" },
  { key: "STREAK_30", name: "Monthly Master", description: "Maintain a 30-day streak", icon: "👑", xp: 200, category: "streaks" },
  { key: "STREAK_100", name: "Legendary Streak", description: "Maintain a 100-day streak", icon: "🐉", xp: 500, category: "streaks" },
  { key: "STREAK_365", name: "Year of Discipline", description: "Maintain a 365-day streak", icon: "🌟", xp: 1000, category: "streaks" },

  // ─── Milestones ──────────────────────────────────────
  { key: "LEVEL_5", name: "Rising Star", description: "Reach level 5", icon: "⭐", xp: 50, category: "milestones" },
  { key: "LEVEL_10", name: "Experienced", description: "Reach level 10", icon: "🌟", xp: 100, category: "milestones" },
  { key: "LEVEL_20", name: "Legendary", description: "Reach level 20", icon: "💫", xp: 250, category: "milestones" },
  { key: "ALL_CATEGORIES", name: "Well-Rounded", description: "Have transactions in 5+ categories", icon: "🎨", xp: 40, category: "milestones" },
];

export function getAchievement(key: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.key === key);
}

// ─── XP Calculation ───────────────────────────────────────
// Income:     +5 XP per 100 earned  (max +50 per transaction)
// Investment: +10 XP flat per investment
// Expense:    -2 XP per 100 spent   (max -20 per transaction, floor 0)
// Goal contrib: +10 XP flat
// Streak:     implicit from achievements

export function calculateTransactionXp(type: "INCOME" | "EXPENSE" | "TRANSFER", amount: number): number {
  if (type === "INCOME") {
    return Math.min(Math.floor(amount / 100) * 5, 50);
  }
  if (type === "EXPENSE") {
    return -Math.min(Math.floor(amount / 100) * 2, 20);
  }
  return 0; // transfers are neutral
}

export const XP_INVESTMENT = 10;
export const XP_GOAL_CONTRIBUTION = 10;

export function calculateLevel(xp: number): { level: number; currentXp: number; nextLevelXp: number } {
  const XP_PER_LEVEL = 200;
  const safeXp = Math.max(xp, 0);
  const level = Math.floor(safeXp / XP_PER_LEVEL) + 1;
  const currentXp = safeXp % XP_PER_LEVEL;
  return { level, currentXp, nextLevelXp: XP_PER_LEVEL };
}

export function getLevelTitle(level: number): string {
  if (level >= 25) return "Finance God";
  if (level >= 20) return "Finance Legend";
  if (level >= 15) return "Money Master";
  if (level >= 10) return "Wealth Builder";
  if (level >= 7) return "Smart Saver";
  if (level >= 5) return "Budget Pro";
  if (level >= 3) return "Tracker";
  return "Beginner";
}
