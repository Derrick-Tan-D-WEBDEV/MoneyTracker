"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { useState } from "react";

interface MonthlyData {
  month: string;
  income: number;
  expenses: number;
  savings: number;
}

export function IncomeExpenseChart({ data, onMonthClick }: { data: MonthlyData[]; onMonthClick?: (month: string) => void }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart
        data={data}
        barGap={2}
        barCategoryGap="20%"
        onClick={(state) => {
          if (state?.activeLabel && onMonthClick) {
            onMonthClick(String(state.activeLabel));
          }
        }}
        onMouseMove={(state) => {
          const idx = state?.activeTooltipIndex;
          setActiveIndex(typeof idx === "number" ? idx : null);
        }}
        onMouseLeave={() => setActiveIndex(null)}
        style={{ cursor: onMonthClick ? "pointer" : undefined }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
        <Tooltip
          contentStyle={{
            borderRadius: "12px",
            border: "1px solid var(--border)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            backgroundColor: "var(--popover)",
            color: "var(--popover-foreground)",
          }}
          formatter={(value) => [`$${Number(value).toLocaleString()}`, undefined]}
        />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "12px", paddingTop: "16px" }} />
        <Bar dataKey="income" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Income">
          {data.map((_, i) => (
            <Cell key={i} fillOpacity={activeIndex === i ? 0.7 : 1} />
          ))}
        </Bar>
        <Bar dataKey="expenses" fill="#F472B6" radius={[4, 4, 0, 0]} name="Expenses">
          {data.map((_, i) => (
            <Cell key={i} fillOpacity={activeIndex === i ? 0.7 : 1} />
          ))}
        </Bar>
        <Bar dataKey="savings" fill="#93C5FD" radius={[4, 4, 0, 0]} name="Savings" fillOpacity={0.5}>
          {data.map((_, i) => (
            <Cell key={i} fillOpacity={activeIndex === i ? 0.35 : 0.5} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
