"use client";

import { useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getAchievement } from "@/lib/achievements";
import confetti from "canvas-confetti";

interface AchievementToastProps {
  achievementKey: string | null;
  onDismiss: () => void;
}

export function AchievementToast({ achievementKey, onDismiss }: AchievementToastProps) {
  const achievement = achievementKey ? getAchievement(achievementKey) : null;

  const fireConfetti = useCallback(() => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.8, x: 0.5 },
      colors: ["#10B981", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6"],
    });
  }, []);

  useEffect(() => {
    if (achievement) {
      fireConfetti();
      const timer = setTimeout(onDismiss, 5000);
      return () => clearTimeout(timer);
    }
  }, [achievement, fireConfetti, onDismiss]);

  return (
    <AnimatePresence>
      {achievement && (
        <motion.div
          initial={{ opacity: 0, y: 80, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] cursor-pointer"
          onClick={onDismiss}
        >
          <div className="bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 p-[2px] rounded-2xl shadow-2xl shadow-amber-500/25">
            <div className="bg-card rounded-2xl px-6 py-4 flex items-center gap-4">
              <div className="text-4xl">{achievement.icon}</div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Achievement Unlocked!</p>
                <p className="text-lg font-bold text-foreground">{achievement.name}</p>
                <p className="text-sm text-muted-foreground">{achievement.description}</p>
              </div>
              <div className="ml-2 px-3 py-1 bg-amber-100 rounded-full">
                <span className="text-sm font-bold text-amber-700">+{achievement.xp} XP</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
