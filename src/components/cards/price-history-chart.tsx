"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import type { PriceHistoryPoint } from "@/actions/cards";

interface Props {
  data: PriceHistoryPoint[];
}

/** Daily price history for a card. Splits NORMAL and FOIL finishes into separate lines. */
export function PriceHistoryChart({ data }: Props) {
  // Pivot rows by date with separate columns per finish
  const byDate = new Map<string, { date: string; NORMAL?: number; FOIL?: number; ENCHANTED?: number }>();
  for (const p of data) {
    const row = byDate.get(p.date) ?? { date: p.date };
    row[p.finish] = p.priceUsd;
    byDate.set(p.date, row);
  }
  const rows = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            tickFormatter={(d: string) => d.slice(5)}
          />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `$${v.toFixed(2)}`} />
          <Tooltip
            formatter={(v: number) => `$${v.toFixed(2)}`}
            labelFormatter={(l: string) => l}
            contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="NORMAL" name="Normal" stroke="#6366F1" dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="FOIL" name="Foil" stroke="#F59E0B" dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="ENCHANTED" name="Enchanted" stroke="#EC4899" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
