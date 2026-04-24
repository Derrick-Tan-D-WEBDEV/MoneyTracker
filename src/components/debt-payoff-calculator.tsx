"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { calculatePayoff, compareStrategies, compareAllStrategies, calculateMinimumTotalPayment, type DebtInput } from "@/lib/debt-strategies";
import { generateDebtPayoffPDF } from "@/lib/pdf-export";
import { currencyFormatter } from "@/lib/format";
import { convertCurrency } from "@/lib/exchange-rates";
import { useSession } from "next-auth/react";
import {
  TrendingDown,
  Snowflake,
  Mountain,
  Calendar,
  DollarSign,
  Clock,
  Zap,
  ChevronRight,
  Trophy,
  Info,
  Download,
  TableIcon,
  ArrowUp,
  ArrowDown,
  GripVertical,
  FileDown,
} from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";

interface DebtPayoffCalculatorProps {
  debts: DebtInput[];
  rates: Record<string, number>;
}

export function DebtPayoffCalculator({ debts, rates }: DebtPayoffCalculatorProps) {
  const { data: session } = useSession();
  const userCurrency = session?.user?.currency || "MYR";
  const formatCurrency = currencyFormatter(userCurrency);

  // Convert all debts to user currency so strategy math is apples-to-apples
  const convertedDebts = useMemo(
    () =>
      debts.map((d) => ({
        ...d,
        remainingAmount: convertCurrency(d.remainingAmount, d.currency, userCurrency, rates),
        minimumPayment: convertCurrency(d.minimumPayment, d.currency, userCurrency, rates),
      })),
    [debts, userCurrency, rates],
  );

  // Stabilize activeDebts so useMemo deps below actually memoize
  const debtKey = convertedDebts.map((d) => `${d.id}:${d.remainingAmount}`).join(",");
  const activeDebts = useMemo(() => convertedDebts.filter((d) => d.remainingAmount > 0), [debtKey]);
  const totalOwed = activeDebts.reduce((s, d) => s + d.remainingAmount, 0);
  const totalMinPayment = calculateMinimumTotalPayment(activeDebts);

  const [extraPayment, setExtraPayment] = useState(0);
  const [strategy, setStrategy] = useState<"avalanche" | "snowball" | "custom">("avalanche");
  const [customOrder, setCustomOrder] = useState<string[]>(() => activeDebts.map((d) => d.id));

  // Keep customOrder in sync if debts change (use primitive dep to avoid infinite loop)
  const activeDebtIdsKey = activeDebts.map((d) => d.id).join(",");
  const prevDebtIdsKeyRef = useRef(activeDebtIdsKey);
  useEffect(() => {
    if (prevDebtIdsKeyRef.current === activeDebtIdsKey) return;
    prevDebtIdsKeyRef.current = activeDebtIdsKey;
    const activeIds = new Set(activeDebts.map((d) => d.id));
    setCustomOrder((prev) => {
      const filtered = prev.filter((id) => activeIds.has(id));
      const missing = activeDebts.filter((d) => !filtered.includes(d.id)).map((d) => d.id);
      const next = [...filtered, ...missing];
      // Bail out if order hasn't changed to prevent infinite loop
      if (next.length === prev.length && next.every((id, i) => id === prev[i])) {
        return prev;
      }
      return next;
    });
  }, [activeDebtIdsKey, activeDebts]);

  const comparison = useMemo(() => {
    if (activeDebts.length === 0) return null;
    if (strategy === "custom") {
      return compareAllStrategies(activeDebts, extraPayment, customOrder);
    }
    return compareStrategies(activeDebts, extraPayment);
  }, [activeDebts, extraPayment, strategy, customOrder]);

  const selectedResult = useMemo(() => {
    if (!comparison) return null;
    if ("custom" in comparison) {
      return strategy === "avalanche" ? comparison.avalanche : strategy === "snowball" ? comparison.snowball : comparison.custom;
    }
    return strategy === "avalanche" ? comparison.avalanche : comparison.snowball;
  }, [comparison, strategy]);

  if (activeDebts.length === 0) return null;

  const chartData =
    comparison?.avalanche.monthlySnapshots.map((a, i) => ({
      month: a.month,
      date: a.date,
      avalanche: a.totalBalance,
      snowball: comparison.snowball.monthlySnapshots[i]?.totalBalance ?? 0,
      custom: "custom" in comparison ? comparison.custom.monthlySnapshots[i]?.totalBalance ?? 0 : 0,
    })) ?? [];

  const payoffDate = selectedResult?.payoffDate ?? "—";
  const months = selectedResult?.months ?? 0;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  const timeLabel = years > 0 ? `${years} yr${years !== 1 ? "s" : ""} ${remainingMonths} mo` : `${months} mo`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            Payoff Calculator
          </h2>
          <p className="text-sm text-muted-foreground">
            Compare strategies and see when you&apos;ll be debt-free
            {debts.some((d) => d.currency !== userCurrency) && (
              <span className="ml-1 text-xs text-amber-600 dark:text-amber-400">
                (amounts converted to {userCurrency})
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Strategy selector */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Strategy</Label>
              <div className="flex gap-2">
                <Button
                  variant={strategy === "avalanche" ? "default" : "outline"}
                  className="flex-1 gap-1.5"
                  onClick={() => setStrategy("avalanche")}
                >
                  <Mountain className="w-4 h-4" />
                  Avalanche
                </Button>
                <Button
                  variant={strategy === "snowball" ? "default" : "outline"}
                  className="flex-1 gap-1.5"
                  onClick={() => setStrategy("snowball")}
                >
                  <Snowflake className="w-4 h-4" />
                  Snowball
                </Button>
                <Button
                  variant={strategy === "custom" ? "default" : "outline"}
                  className="flex-1 gap-1.5"
                  onClick={() => setStrategy("custom")}
                >
                  <GripVertical className="w-4 h-4" />
                  Custom
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {strategy === "avalanche"
                  ? "Highest interest first. Saves the most money."
                  : strategy === "snowball"
                    ? "Lowest balance first. Quick wins for motivation."
                    : "Drag to set your own payoff priority order."}
              </p>
            </div>

            {/* Custom reorder UI */}
            {strategy === "custom" && (
              <div className="space-y-3 md:col-span-3">
                <Label className="text-sm font-medium">Payoff Order</Label>
                <div className="space-y-2">
                  {customOrder.map((debtId, index) => {
                    const debt = activeDebts.find((d) => d.id === debtId);
                    if (!debt) return null;
                    return (
                      <div
                        key={debtId}
                        className="flex items-center gap-3 rounded-lg border px-3 py-2 bg-card"
                      >
                        <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                          {index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{debt.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {debt.interestRate}% APR · {formatCurrency(debt.remainingAmount)} remaining
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={index === 0}
                            onClick={() => {
                              const newOrder = [...customOrder];
                              [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
                              setCustomOrder(newOrder);
                            }}
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={index === customOrder.length - 1}
                            onClick={() => {
                              const newOrder = [...customOrder];
                              [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
                              setCustomOrder(newOrder);
                            }}
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Extra payment */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Extra Monthly Payment</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={0}
                  step={10}
                  value={extraPayment}
                  onChange={(e) => setExtraPayment(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="text-lg font-semibold"
                />
              </div>
              <div className="flex gap-1.5">
                {[0, 50, 100, 200, 500].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setExtraPayment(amt)}
                    className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                      extraPayment === amt
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-muted/80 text-muted-foreground"
                    }`}
                  >
                    +{formatCurrency(amt)}
                  </button>
                ))}
              </div>
            </div>

            {/* Baseline info */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Debt</span>
                <span className="font-semibold">{formatCurrency(totalOwed)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Min. Payments</span>
                <span className="font-semibold">{formatCurrency(totalMinPayment)}/mo</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Payment</span>
                <span className="font-semibold text-emerald-600">
                  {formatCurrency(totalMinPayment + extraPayment)}/mo
                </span>
              </div>
              <div className="pt-2">
                <Progress value={Math.min((totalMinPayment / (totalMinPayment + extraPayment)) * 100, 100)} className="h-1.5" />
                <p className="text-[10px] text-muted-foreground mt-1">
                  {extraPayment > 0
                    ? `${((extraPayment / (totalMinPayment + extraPayment)) * 100).toFixed(0)}% extra`
                    : "Minimum payments only"}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results summary */}
      {selectedResult && (
        <>
          <div className="flex items-center justify-between">
            <div />
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                if (!comparison) return;
                generateDebtPayoffPDF(selectedResult, comparison as { avalanche: typeof selectedResult; snowball: typeof selectedResult }, userCurrency);
              }}
            >
              <FileDown className="w-3.5 h-3.5" />
              Download PDF
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4 text-blue-500" />
                  <span className="text-sm text-muted-foreground">Debt-Free Date</span>
                </div>
                <p className="text-2xl font-bold">{payoffDate}</p>
                <p className="text-xs text-muted-foreground mt-1">{timeLabel} from now</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4 text-red-500" />
                  <span className="text-sm text-muted-foreground">Total Interest</span>
                </div>
                <p className="text-2xl font-bold text-red-500">{formatCurrency(selectedResult.totalInterest)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {((selectedResult.totalInterest / selectedResult.startingBalance) * 100).toFixed(1)}% of principal
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm text-muted-foreground">Total Paid</span>
                </div>
                <p className="text-2xl font-bold">{formatCurrency(selectedResult.totalPaid)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Principal + interest
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-purple-500" />
                  <span className="text-sm text-muted-foreground">Payments</span>
                </div>
                <p className="text-2xl font-bold">{selectedResult.months}</p>
                <p className="text-xs text-muted-foreground mt-1">Monthly payments</p>
              </CardContent>
            </Card>
          </div>

          {/* Strategy comparison banner */}
          {(() => {
            if (!comparison) return null;
            if ("winner" in comparison && comparison.winner !== "tie") {
              return (
                <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
                  <CardContent className="pt-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                      <Trophy className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-emerald-800 dark:text-emerald-300">
                        {comparison.winner === "avalanche" ? "Avalanche" : "Snowball"} wins this scenario
                      </p>
                      <p className="text-sm text-emerald-700 dark:text-emerald-400">
                        {comparison.interestSaved > 0
                          ? `Saves ${formatCurrency(comparison.interestSaved)} in interest`
                          : "Same interest cost"}
                        {comparison.monthsSaved > 0
                          ? ` and ${comparison.monthsSaved} month${comparison.monthsSaved !== 1 ? "s" : ""}`
                          : ""}
                        {" compared to "}
                        {comparison.winner === "avalanche" ? "Snowball" : "Avalanche"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            }
            if ("bestInterest" in comparison) {
              return (
                <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
                  <CardContent className="pt-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                      <Trophy className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-emerald-800 dark:text-emerald-300">
                        Best strategies for this scenario
                      </p>
                      <p className="text-sm text-emerald-700 dark:text-emerald-400">
                        Lowest interest: <strong className="capitalize">{comparison.bestInterest}</strong>
                        {" · "}
                        Fastest payoff: <strong className="capitalize">{comparison.bestMonths}</strong>
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            }
            return null;
          })()}

          {/* Chart */}
          {chartData.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Balance Over Time</CardTitle>
                <CardDescription>Projected total debt balance month by month</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      stroke="var(--muted-foreground)"
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      stroke="var(--muted-foreground)"
                      tickFormatter={(v: number) => formatCurrency(v)}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const labelMap: Record<string, string> = {
                          avalanche: "Avalanche",
                          snowball: "Snowball",
                          custom: "Custom",
                        };
                        const colorMap: Record<string, string> = {
                          avalanche: "#3B82F6",
                          snowball: "#10B981",
                          custom: "#F59E0B",
                        };
                        return (
                          <div className="rounded-lg border bg-popover p-2.5 shadow-sm">
                            <p className="text-xs text-muted-foreground mb-1">{label}</p>
                            {payload.map((entry) => {
                              const key = entry.dataKey as string;
                              if (!labelMap[key]) return null;
                              return (
                                <p key={key} className="text-xs" style={{ color: colorMap[key] }}>
                                  <span className="font-medium">{labelMap[key]}:</span>{" "}
                                  {formatCurrency(Number(entry.value))}
                                </p>
                              );
                            })}
                          </div>
                        );
                      }}
                    />
                    <Area
                      key="avalanche"
                      type="monotone"
                      dataKey="avalanche"
                      name="Avalanche"
                      stroke="#3B82F6"
                      fill="#3B82F6"
                      fillOpacity={0.08}
                      strokeWidth={2}
                      strokeDasharray="4 4"
                    />
                    <Area
                      key="snowball"
                      type="monotone"
                      dataKey="snowball"
                      name="Snowball"
                      stroke="#10B981"
                      fill="#10B981"
                      fillOpacity={0.08}
                      strokeWidth={2}
                    />
                    {strategy === "custom" && (
                      <Area
                        key="custom"
                        type="monotone"
                        dataKey="custom"
                        name="Custom"
                        stroke="#F59E0B"
                        fill="#F59E0B"
                        fillOpacity={0.08}
                        strokeWidth={2}
                        strokeDasharray="8 4"
                      />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Debt Payoff Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payoff Timeline</CardTitle>
              <CardDescription>When each debt will be fully paid off</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {selectedResult.debtSchedules.map((schedule, index) => {
                  const debt = activeDebts.find((d) => d.id === schedule.debtId);
                  if (!debt) return null;
                  const payoffDate = addMonths(new Date(), schedule.payoffMonth);
                  const isFirst = index === 0;
                  return (
                    <div key={schedule.debtId} className="relative">
                      {/* Connector line */}
                      {index < selectedResult.debtSchedules.length - 1 && (
                        <div className="absolute left-4 top-10 w-px h-6 bg-border" />
                      )}
                      <div className="flex items-start gap-4">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                          style={{
                            backgroundColor: (debt.color || "#6B7280") + "20",
                            color: debt.color || "#6B7280",
                          }}
                        >
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">{debt.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {debt.interestRate}% APR · Min {formatCurrency(debt.minimumPayment)}/mo
                              </p>
                            </div>
                            <div className="text-right">
                              <Badge variant={isFirst ? "default" : "secondary"} className="text-xs">
                                {payoffDate.toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                              </Badge>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {Math.floor(schedule.payoffMonth / 12) > 0
                                  ? `${Math.floor(schedule.payoffMonth / 12)}y ${schedule.payoffMonth % 12}m`
                                  : `${schedule.payoffMonth} mo`}
                              </p>
                            </div>
                          </div>
                          <div className="mt-2">
                            <div className="flex justify-between text-xs text-muted-foreground mb-1">
                              <span>{formatCurrency(debt.remainingAmount)}</span>
                              <span>
                                Interest: {formatCurrency(schedule.totalInterest)}
                              </span>
                            </div>
                            <Progress
                              value={100}
                              className="h-1.5"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Amortization Schedule */}
          {selectedResult.debtSchedules.length > 0 && (
            <AmortizationTable
              schedules={selectedResult.debtSchedules}
              debts={activeDebts}
              formatCurrency={formatCurrency}
            />
          )}

          {/* Strategy Details Tabs */}
          <Tabs defaultValue={strategy}>
            <TabsList className={`grid w-full ${"custom" in (comparison ?? {}) ? "grid-cols-3" : "grid-cols-2"}`}>
              <TabsTrigger value="avalanche">Avalanche</TabsTrigger>
              <TabsTrigger value="snowball">Snowball</TabsTrigger>
              {"custom" in (comparison ?? {}) && (
                <TabsTrigger value="custom">Custom</TabsTrigger>
              )}
            </TabsList>
            <TabsContent value="avalanche">
              <StrategyDetails result={comparison?.avalanche} formatCurrency={formatCurrency} icon={<Mountain className="w-4 h-4" />} />
            </TabsContent>
            <TabsContent value="snowball">
              <StrategyDetails result={comparison?.snowball} formatCurrency={formatCurrency} icon={<Snowflake className="w-4 h-4" />} />
            </TabsContent>
            {comparison && "custom" in comparison && (
              <TabsContent value="custom">
                <StrategyDetails result={(comparison as { custom: typeof comparison.avalanche }).custom} formatCurrency={formatCurrency} icon={<GripVertical className="w-4 h-4" />} />
              </TabsContent>
            )}
          </Tabs>
        </>
      )}
    </div>
  );
}

function StrategyDetails({
  result,
  formatCurrency,
  icon,
}: {
  result?: ReturnType<typeof calculatePayoff> | null;
  formatCurrency: (v: number) => string;
  icon: React.ReactNode;
}) {
  if (!result) return null;

  const months = result.months;
  const years = Math.floor(months / 12);
  const remMonths = months % 12;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-4">
          {icon}
          <span className="font-semibold capitalize">{result.strategy}</span>
          <span className="text-sm text-muted-foreground ml-auto">
            {result.debtOrder.length} debt{result.debtOrder.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Payoff Date</p>
            <p className="text-lg font-bold">{result.payoffDate}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Duration</p>
            <p className="text-lg font-bold">
              {years > 0 ? `${years}y ${remMonths}m` : `${remMonths}m`}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Total Interest</p>
            <p className="text-lg font-bold text-red-500">{formatCurrency(result.totalInterest)}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Total Cost</p>
            <p className="text-lg font-bold">{formatCurrency(result.totalPaid)}</p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Payoff Order</p>
          {result.debtSchedules.map((s, i) => (
            <div key={s.debtId} className="flex items-center gap-3 text-sm py-1.5 border-b last:border-0">
              <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold shrink-0">
                {i + 1}
              </span>
              <span className="flex-1">{s.name}</span>
              <span className="text-muted-foreground text-xs">
                {formatCurrency(s.totalInterest)} interest
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AmortizationTable({
  schedules,
  debts,
  formatCurrency,
}: {
  schedules: ReturnType<typeof calculatePayoff>["debtSchedules"];
  debts: DebtInput[];
  formatCurrency: (v: number) => string;
}) {
  const [selectedDebtId, setSelectedDebtId] = useState(schedules[0]?.debtId);
  const schedule = schedules.find((s) => s.debtId === selectedDebtId);
  const debt = debts.find((d) => d.id === selectedDebtId);

  const downloadCSV = () => {
    if (!schedule || !debt) return;
    const rows = [
      ["Month", "Date", "Starting Balance", "Payment", "Interest", "Principal", "Ending Balance"],
      ...schedule.monthlyBreakdown.map((m) => [
        String(m.month),
        new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" }), // approximate
        String(m.startingBalance.toFixed(2)),
        String(m.payment.toFixed(2)),
        String(m.interest.toFixed(2)),
        String(m.principalPaid.toFixed(2)),
        String(Math.max(m.endingBalance, 0).toFixed(2)),
      ]),
    ];
    const csv = rows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${debt.name.replace(/\s+/g, "_")}_amortization.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <TableIcon className="w-4 h-4 text-blue-500" />
            Amortization Schedule
          </CardTitle>
          <CardDescription>Month-by-month payment breakdown</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedDebtId}
            onChange={(e) => setSelectedDebtId(e.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-sm"
          >
            {schedules.map((s) => (
              <option key={s.debtId} value={s.debtId}>
                {s.name}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" className="gap-1" onClick={downloadCSV}>
            <Download className="w-3.5 h-3.5" />
            CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {schedule && schedule.monthlyBreakdown.length > 0 ? (
          <div className="max-h-96 overflow-y-auto border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Month</TableHead>
                  <TableHead>Starting</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Interest</TableHead>
                  <TableHead>Principal</TableHead>
                  <TableHead>Ending</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedule.monthlyBreakdown.map((m) => (
                  <TableRow key={m.month}>
                    <TableCell className="font-medium">{m.month}</TableCell>
                    <TableCell>{formatCurrency(m.startingBalance)}</TableCell>
                    <TableCell>{formatCurrency(m.payment)}</TableCell>
                    <TableCell className="text-red-500">{formatCurrency(m.interest)}</TableCell>
                    <TableCell className="text-emerald-600">{formatCurrency(m.principalPaid)}</TableCell>
                    <TableCell>{formatCurrency(Math.max(m.endingBalance, 0))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">No amortization data available.</p>
        )}
      </CardContent>
    </Card>
  );
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}
