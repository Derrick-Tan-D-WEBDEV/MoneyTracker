"use client";

import { calculateLevel, getLevelTitle } from "@/lib/achievements";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface LevelBadgeProps {
  xp: number;
  level: number;
  compact?: boolean;
}

export function LevelBadge({ xp, level, compact = false }: LevelBadgeProps) {
  const { currentXp, nextLevelXp } = calculateLevel(xp);
  const progress = (currentXp / nextLevelXp) * 100;
  const title = getLevelTitle(level);

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <div className="flex items-center gap-1.5 px-2 py-1 bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-950/40 dark:to-blue-950/40 rounded-full border border-emerald-200/50 dark:border-emerald-800/30 cursor-default" />
          }
        >
          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Lv.{level}</span>
          <div className="w-12 h-1.5 bg-emerald-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-center">
          <p className="font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">
            {currentXp}/{nextLevelXp} XP to next level
          </p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-950/40 dark:to-blue-950/40 rounded-xl border border-emerald-200/50 dark:border-emerald-800/30">
      <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-blue-500 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-emerald-500/20">{level}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-semibold text-foreground">{title}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {currentXp}/{nextLevelXp} XP
          </span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>
    </div>
  );
}
