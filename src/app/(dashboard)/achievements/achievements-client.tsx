"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ACHIEVEMENTS, type AchievementDef, calculateLevel, getLevelTitle } from "@/lib/achievements";
import { getUserStats } from "@/actions/gamification";
import { Trophy, Lock, Star, Flame, Target, PiggyBank, Award, Landmark } from "lucide-react";
import { motion } from "framer-motion";

interface UserStats {
  xp: number;
  level: number;
  streak: number;
  achievements: { type: string; unlockedAt: string }[];
  totalAchievements: number;
  unlockedCount: number;
}

const CATEGORY_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  "getting-started": { label: "Getting Started", icon: <Star className="w-4 h-4" />, color: "text-amber-500" },
  transactions: { label: "Transactions", icon: <Target className="w-4 h-4" />, color: "text-blue-500" },
  budgets: { label: "Budgets", icon: <Target className="w-4 h-4" />, color: "text-emerald-500" },
  investments: { label: "Investments", icon: <Trophy className="w-4 h-4" />, color: "text-purple-500" },
  goals: { label: "Goals", icon: <Star className="w-4 h-4" />, color: "text-pink-500" },
  debts: { label: "Debts & Loans", icon: <Landmark className="w-4 h-4" />, color: "text-red-500" },
  savings: { label: "Savings & Discipline", icon: <PiggyBank className="w-4 h-4" />, color: "text-teal-500" },
  streaks: { label: "Streaks", icon: <Flame className="w-4 h-4" />, color: "text-orange-500" },
  milestones: { label: "Milestones", icon: <Award className="w-4 h-4" />, color: "text-indigo-500" },
};

export function AchievementsClient() {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUserStats()
      .then((s) => setStats(s))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading achievements...</div>;
  }

  if (!stats) return null;

  const unlockedKeys = new Set(stats.achievements.map((a) => a.type));
  const { currentXp, nextLevelXp } = calculateLevel(stats.xp);
  const levelTitle = getLevelTitle(stats.level);
  const xpProgress = (currentXp / nextLevelXp) * 100;

  // Group achievements by category
  const grouped = ACHIEVEMENTS.reduce<Record<string, AchievementDef[]>>((acc, a) => {
    (acc[a.category] ??= []).push(a);
    return acc;
  }, {});

  const totalXpEarned = stats.achievements.reduce((acc, a) => {
    const def = ACHIEVEMENTS.find((d) => d.key === a.type);
    return acc + (def?.xp || 0);
  }, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Achievements</h1>
        <p className="text-muted-foreground">Track your progress and earn rewards</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-emerald-500 to-blue-500 text-white border-0">
          <CardContent className="pt-4">
            <p className="text-sm text-white/80">Level</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{stats.level}</span>
              <span className="text-sm text-white/70">{levelTitle}</span>
            </div>
            <div className="mt-3">
              <div className="flex justify-between text-xs text-white/70 mb-1">
                <span>{currentXp} XP</span>
                <span>{nextLevelXp} XP</span>
              </div>
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${xpProgress}%` }} />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Achievements</p>
            <p className="text-3xl font-bold">
              {stats.unlockedCount}
              <span className="text-lg text-muted-foreground font-normal">/{stats.totalAchievements}</span>
            </p>
            <Progress value={(stats.unlockedCount / stats.totalAchievements) * 100} className="mt-2 h-1.5" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total XP Earned</p>
            <p className="text-3xl font-bold">{stats.xp}</p>
            <p className="text-xs text-muted-foreground mt-1">{totalXpEarned} from achievements</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Current Streak</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{stats.streak}</span>
              <span className="text-lg">🔥</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{stats.streak >= 7 ? "Amazing!" : stats.streak >= 3 ? "Keep going!" : "Log in daily!"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Achievements by Category */}
      {Object.entries(grouped).map(([category, achievements]) => {
        const meta = CATEGORY_META[category];
        const unlockedInCat = achievements.filter((a) => unlockedKeys.has(a.key)).length;

        return (
          <Card key={category}>
            <CardHeader className="flex flex-row items-center gap-2 pb-3">
              <span className={meta.color}>{meta.icon}</span>
              <div className="flex-1">
                <CardTitle className="text-base">{meta.label}</CardTitle>
              </div>
              <Badge variant="secondary" className="text-xs">
                {unlockedInCat}/{achievements.length}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {achievements.map((a, i) => {
                  const unlocked = unlockedKeys.has(a.key);
                  const unlockedAt = stats.achievements.find((u) => u.type === a.key)?.unlockedAt;

                  return (
                    <motion.div
                      key={a.key}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                        unlocked ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800" : "bg-muted/30 border-border opacity-60"
                      }`}
                    >
                      <div className={`text-3xl ${unlocked ? "" : "grayscale opacity-40"}`}>{unlocked ? a.icon : <Lock className="w-7 h-7 text-muted-foreground" />}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{a.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{a.description}</p>
                        {unlocked && unlockedAt && <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">Unlocked {new Date(unlockedAt).toLocaleDateString()}</p>}
                      </div>
                      <Badge variant={unlocked ? "default" : "secondary"} className="text-[10px] shrink-0">
                        +{a.xp} XP
                      </Badge>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
