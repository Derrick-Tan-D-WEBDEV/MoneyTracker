"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, Area, AreaChart, ReferenceLine } from "recharts";
import { getReportData } from "@/actions/reports";
import { getNetWorthHistory } from "@/actions/net-worth";
import { currencyFormatter } from "@/lib/format";
import { useSession } from "next-auth/react";
import { TrendingUp, TrendingDown, DollarSign, PiggyBank, ArrowUpRight, ArrowDownRight, Calendar, BarChart3, Download } from "lucide-react";

type ReportData = Awaited<ReturnType<typeof getReportData>>;

const COLORS = ["#10B981", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#F97316"];

export function ReportsClient() {
  const { data: session } = useSession();
  const formatCurrency = currencyFormatter(session?.user?.currency);
  const [data, setData] = useState<ReportData | null>(null);
  const [netWorthData, setNetWorthData] = useState<{ date: string; netWorth: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    setLoading(true);
    Promise.all([getReportData(year), getNetWorthHistory(12)])
      .then(([reportData, nwData]) => {
        setData(reportData);
        setNetWorthData(nwData);
      })
      .finally(() => setLoading(false));
  }, [year]);

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading reports...</div>;
  }

  if (!data) return null;

  const { summary, monthlyData, categoryBreakdown, netWorthTrend } = data;
  const topExpenseCategories = categoryBreakdown.filter((c) => c.expenses > 0).slice(0, 8);
  const totalCatExpenses = topExpenseCategories.reduce((s, c) => s + c.expenses, 0);

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports</h1>
          <p className="text-muted-foreground">Financial insights and analytics</p>
        </div>
        <Select value={String(year)} onValueChange={(v) => v && setYear(Number(v))}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowUpRight className="w-4 h-4 text-emerald-500" />
              <span className="text-sm text-muted-foreground">Total Income</span>
            </div>
            <p className="text-2xl font-bold text-emerald-600">{formatCurrency(summary.totalIncome)}</p>
            <p className="text-xs text-muted-foreground mt-1">Avg {formatCurrency(summary.avgMonthlyIncome)}/mo</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowDownRight className="w-4 h-4 text-red-500" />
              <span className="text-sm text-muted-foreground">Total Expenses</span>
            </div>
            <p className="text-2xl font-bold text-red-500">{formatCurrency(summary.totalExpenses)}</p>
            <p className="text-xs text-muted-foreground mt-1">Avg {formatCurrency(summary.avgMonthlyExpenses)}/mo</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <PiggyBank className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Net Savings</span>
            </div>
            <p className={`text-2xl font-bold ${summary.totalSavings >= 0 ? "text-blue-600" : "text-red-500"}`}>{formatCurrency(summary.totalSavings)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-purple-500" />
              <span className="text-sm text-muted-foreground">Savings Rate</span>
            </div>
            <p className="text-2xl font-bold text-purple-600">{summary.savingsRate.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground mt-1">{summary.transactionCount} transactions</p>
          </CardContent>
        </Card>
      </div>

      {/* Net Worth History Chart */}
      {netWorthData.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Net Worth History</CardTitle>
            <CardDescription>Daily net worth snapshots over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={netWorthData.map((d) => ({ date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }), netWorth: d.netWorth }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" tickFormatter={(v: number) => formatCurrency(v)} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={{ borderRadius: "8px", border: "1px solid var(--border)", background: "var(--popover)" }} />
                <Area type="monotone" dataKey="netWorth" name="Net Worth" stroke="#10B981" fill="#10B981" fillOpacity={0.1} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Monthly Trend Chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Monthly Income vs Expenses</CardTitle>
            <CardDescription>Compare your earnings and spending each month</CardDescription>
          </div>
          <Badge variant="outline">{year}</Badge>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
              <YAxis tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" tickFormatter={(v: number) => formatCurrency(v)} />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={{ borderRadius: "8px", border: "1px solid var(--border)", background: "var(--popover)" }} />
              <Bar dataKey="income" name="Income" fill="#10B981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#EF4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Savings Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cumulative Savings</CardTitle>
            <CardDescription>Running total of savings throughout the year</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={netWorthTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" tickFormatter={(v: number) => formatCurrency(v)} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={{ borderRadius: "8px", border: "1px solid var(--border)", background: "var(--popover)" }} />
                <Area type="monotone" dataKey="netWorth" name="Savings" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.1} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Expense by Category Pie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expenses by Category</CardTitle>
            <CardDescription>Where your money goes</CardDescription>
          </CardHeader>
          <CardContent>
            {topExpenseCategories.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={topExpenseCategories} dataKey="expenses" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {topExpenseCategories.map((c, i) => (
                        <Cell key={c.name} fill={c.color || COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {topExpenseCategories.map((c, i) => (
                    <div key={c.name} className="flex items-center gap-2 text-xs">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color || COLORS[i % COLORS.length] }} />
                      <span className="truncate text-muted-foreground">{c.name}</span>
                      <span className="ml-auto font-medium tabular-nums">{totalCatExpenses > 0 ? ((c.expenses / totalCatExpenses) * 100).toFixed(0) : 0}%</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">No expense data</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Monthly Savings Rate */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly Savings</CardTitle>
            <CardDescription>Net savings each month (income - expenses)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" tickFormatter={(v: number) => formatCurrency(v)} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={{ borderRadius: "8px", border: "1px solid var(--border)", background: "var(--popover)" }} />
                <Bar dataKey="savings" name="Savings" radius={[4, 4, 0, 0]}>
                  {monthlyData.map((entry, i) => (
                    <Cell key={i} fill={entry.savings >= 0 ? "#10B981" : "#EF4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Monthly Savings Rate % */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Savings Rate</CardTitle>
            <CardDescription>Percentage of income saved each month</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={monthlyData.map((m) => ({ ...m, rate: m.income > 0 ? ((m.savings / m.income) * 100) : 0 }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
                <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} contentStyle={{ borderRadius: "8px", border: "1px solid var(--border)", background: "var(--popover)" }} />
                <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="rate" name="Savings Rate" stroke="#8B5CF6" strokeWidth={2} dot={{ r: 3, fill: "#8B5CF6" }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Category Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Category Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {categoryBreakdown.map((c) => (
              <div key={c.name} className="flex items-center gap-3 py-2 border-b last:border-0">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                <span className="text-sm font-medium flex-1">{c.name}</span>
                {c.income > 0 && <span className="text-sm text-emerald-600 tabular-nums">+{formatCurrency(c.income)}</span>}
                {c.expenses > 0 && <span className="text-sm text-red-500 tabular-nums">-{formatCurrency(c.expenses)}</span>}
              </div>
            ))}
            {categoryBreakdown.length === 0 && <p className="text-center text-muted-foreground py-4 text-sm">No transactions for {year}</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
