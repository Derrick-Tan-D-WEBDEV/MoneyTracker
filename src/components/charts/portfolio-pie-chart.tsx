"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const TYPE_COLORS: Record<string, string> = {
  STOCK: "#3B82F6",
  CRYPTO: "#F59E0B",
  ETF: "#10B981",
  MUTUAL_FUND: "#8B5CF6",
  BOND: "#6366F1",
  REAL_ESTATE: "#EC4899",
  OTHER: "#6B7280",
};

const TYPE_LABELS: Record<string, string> = {
  STOCK: "Stocks",
  CRYPTO: "Crypto",
  ETF: "ETFs",
  MUTUAL_FUND: "Mutual Funds",
  BOND: "Bonds",
  REAL_ESTATE: "Real Estate",
  OTHER: "Other",
};

interface InvestmentTypeData {
  type: string;
  value: number;
}

export function PortfolioPieChart({ data }: { data: InvestmentTypeData[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (data.length === 0) {
    return <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">No investments yet</div>;
  }

  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width={140} height={140}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={3} dataKey="value">
            {data.map((entry, index) => (
              <Cell key={index} fill={TYPE_COLORS[entry.type] || "#6B7280"} stroke="none" />
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
            formatter={(value, name) => [`$${Number(value).toLocaleString()}`, TYPE_LABELS[name as string] || name]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-col gap-1.5 flex-1">
        {data.map((item, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{
                backgroundColor: TYPE_COLORS[item.type] || "#6B7280",
              }}
            />
            <span className="text-muted-foreground flex-1">{TYPE_LABELS[item.type] || item.type}</span>
            <span className="font-medium tabular-nums">{total > 0 ? ((item.value / total) * 100).toFixed(0) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
