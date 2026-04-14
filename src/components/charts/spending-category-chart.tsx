"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

interface CategoryData {
  name: string;
  amount: number;
  color: string;
}

export function SpendingCategoryChart({ data }: { data: CategoryData[] }) {
  const total = data.reduce((sum, d) => sum + d.amount, 0);

  if (data.length === 0) {
    return <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">No spending data yet</div>;
  }

  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width={160} height={160}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="amount">
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color} stroke="none" />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid var(--border)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              backgroundColor: "var(--popover)",
              color: "var(--popover-foreground)",
              fontSize: "12px",
            }}
            formatter={(value) => [`$${Number(value).toLocaleString()}`, undefined]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-col gap-2 flex-1">
        {data.map((item, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
            <span className="text-muted-foreground truncate flex-1">{item.name}</span>
            <span className="font-medium tabular-nums">${item.amount.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
