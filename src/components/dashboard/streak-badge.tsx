"use client";

interface StreakBadgeProps {
  streak: number;
}

export function StreakBadge({ streak }: StreakBadgeProps) {
  if (streak <= 0) return null;

  const getStreakColor = () => {
    if (streak >= 30) return "from-red-500 to-orange-500";
    if (streak >= 7) return "from-orange-500 to-amber-500";
    if (streak >= 3) return "from-amber-500 to-yellow-500";
    return "from-yellow-500 to-yellow-400";
  };

  return (
    <div className={`flex items-center gap-1 px-2 py-1 bg-gradient-to-r ${getStreakColor()} rounded-full text-white`}>
      <span className="text-sm">🔥</span>
      <span className="text-xs font-bold">{streak}</span>
    </div>
  );
}
