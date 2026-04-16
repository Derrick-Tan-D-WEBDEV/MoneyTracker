"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Target,
  Flag,
  ArrowRight,
  BarChart3,
  PiggyBank,
  Shield,
  Sparkles,
  CreditCard,
  Landmark,
  Banknote,
  Bitcoin,
  Receipt,
  AlertTriangle,
  CheckCircle2,
  Info,
} from "lucide-react";
import { IncomeExpenseChart } from "@/components/charts/income-expense-chart";
import { SpendingCategoryChart } from "@/components/charts/spending-category-chart";
import { PortfolioPieChart } from "@/components/charts/portfolio-pie-chart";
import { AnimatedCounter } from "@/components/dashboard/animated-counter";
import { currencyFormatter } from "@/lib/format";
import { getSpendingInsights } from "@/actions/insights";
import { getMonthlyProgress, type MonthlyProgress } from "@/actions/monthly-progress";
import { getMonthBreakdown } from "@/actions/dashboard";
import { getCategoryIcon } from "@/lib/category-icons";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { CalendarClock } from "lucide-react";

interface DashboardData {
  netWorth: number;
  netWorthChange: number;
  currentMonth: {
    income: number;
    expenses: number;
    savings: number;
  };
  budgetProgress: {
    id: string;
    category: string;
    categoryColor: string;
    limit: number;
    spent: number;
    percentage: number;
  }[];
  investments: {
    totalInvested: number;
    totalCurrentValue: number;
    totalReturn: number;
    returnPercentage: number;
    byType: { type: string; value: number }[];
  };
  goals: {
    id: string;
    name: string;
    targetAmount: number;
    currentAmount: number;
    type: string;
    deadline: string | null;
    color: string;
    percentage: number;
  }[];
  topCategories: {
    name: string;
    amount: number;
    color: string;
  }[];
  monthlyTrend: {
    month: string;
    income: number;
    expenses: number;
    savings: number;
  }[];
  recentTransactions: {
    id: string;
    description: string;
    amount: number;
    type: string;
    date: string;
    category: string;
    categoryColor: string;
    account: string;
    currency: string;
  }[];
  accounts: {
    id: string;
    name: string;
    type: string;
    balance: number;
    reservedAmount: number;
    currency: string;
    color: string;
  }[];
  debts: {
    totalDebt: number;
    totalDebtPaid: number;
    activeCount: number;
    items: {
      id: string;
      name: string;
      type: string;
      remainingAmount: number;
      originalAmount: number;
      percentage: number;
    }[];
  };
  installments: {
    totalRemaining: number;
    monthlyTotal: number;
    activeCount: number;
  };
}

function EmptyState() {
  const steps = [
    {
      step: 1,
      title: "Add your accounts",
      description: "Connect your bank accounts, credit cards, or cash wallets to start tracking.",
      href: "/accounts",
      icon: Wallet,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-100 dark:bg-blue-950/40",
    },
    {
      step: 2,
      title: "Record transactions",
      description: "Log your daily income and expenses to build your financial picture.",
      href: "/transactions",
      icon: ArrowUpRight,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-100 dark:bg-emerald-950/40",
    },
    {
      step: 3,
      title: "Set budgets & goals",
      description: "Create spending limits and savings goals to stay on track.",
      href: "/budgets",
      icon: Target,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-100 dark:bg-amber-950/40",
    },
  ];

  const features = [
    { icon: BarChart3, label: "Visual Reports", description: "Charts & breakdowns" },
    { icon: PiggyBank, label: "Multi-Currency", description: "SGD, MYR & more" },
    { icon: Sparkles, label: "Gamification", description: "Earn XP & achievements" },
    { icon: Shield, label: "Secure", description: "Your data stays private" },
  ];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-50 via-blue-50 to-purple-50 dark:from-emerald-950/20 dark:via-blue-950/20 dark:to-purple-950/20 border border-emerald-200/40 dark:border-emerald-800/20 p-6 md:p-8">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Welcome to MoneyTracker</h1>
        <p className="text-muted-foreground mt-1 max-w-lg">Take control of your finances. Track spending across multiple currencies, set budgets, and watch your wealth grow.</p>
      </div>

      {/* Quick Start Steps */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Start</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {steps.map((s) => (
            <Link key={s.step} href={s.href}>
              <Card className="group border-dashed hover:border-solid hover:border-emerald-300 dark:hover:border-emerald-700 transition-all cursor-pointer h-full">
                <CardContent className="flex items-start gap-4 py-5">
                  <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center shrink-0`}>
                    <s.icon className={`w-5 h-5 ${s.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {s.step}
                      </Badge>
                      <h3 className="font-semibold text-sm">{s.title}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{s.description}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Feature Highlights */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {features.map((f) => (
          <div key={f.label} className="flex items-center gap-3 rounded-xl border bg-card p-3">
            <f.icon className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium leading-none">{f.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{f.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardClient({ data }: { data: DashboardData | null }) {
  const { data: session } = useSession();
  const formatCurrency = currencyFormatter(session?.user?.currency);

  if (!data || data.accounts.length === 0) return <EmptyState />;

  const hasTransactions = data.currentMonth.income !== 0 || data.currentMonth.expenses !== 0 || data.recentTransactions.length > 0;

  const budgetsOnTrack = data.budgetProgress.filter((b) => b.percentage <= 100).length;
  const budgetsOver = data.budgetProgress.filter((b) => b.percentage > 100).length;
  const totalBudget = data.budgetProgress.reduce((s, b) => s + b.limit, 0);
  const totalSpent = data.budgetProgress.reduce((s, b) => s + b.spent, 0);
  const budgetPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  const totalGoalTarget = data.goals.reduce((s, g) => s + g.targetAmount, 0);
  const totalGoalCurrent = data.goals.reduce((s, g) => s + g.currentAmount, 0);
  const goalPercentage = totalGoalTarget > 0 ? (totalGoalCurrent / totalGoalTarget) * 100 : 0;

  const getAccountIcon = (type: string) => {
    const icons: Record<string, typeof Wallet> = {
      CHECKING: Landmark,
      SAVINGS: PiggyBank,
      CREDIT_CARD: CreditCard,
      CASH: Banknote,
      INVESTMENT: TrendingUp,
      CRYPTO: Bitcoin,
      LOAN: Wallet,
    };
    return icons[type] || Wallet;
  };

  type InsightData = Awaited<ReturnType<typeof getSpendingInsights>>;
  type BreakdownTx = Awaited<ReturnType<typeof getMonthBreakdown>>[number];
  const [insights, setInsights] = useState<InsightData | null>(null);
  const [monthlyProgress, setMonthlyProgress] = useState<MonthlyProgress | null>(null);
  const [breakdownMonth, setBreakdownMonth] = useState<string | null>(null);
  const [breakdownTxns, setBreakdownTxns] = useState<BreakdownTx[]>([]);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  useEffect(() => {
    if (hasTransactions) {
      getSpendingInsights()
        .then(setInsights)
        .catch(() => {});
    }
    getMonthlyProgress()
      .then(setMonthlyProgress)
      .catch(() => {});
  }, [hasTransactions]);

  const handleMonthClick = async (month: string) => {
    setBreakdownMonth(month);
    setBreakdownLoading(true);
    try {
      const txns = await getMonthBreakdown(month);
      setBreakdownTxns(txns);
    } catch {
      setBreakdownTxns([]);
    } finally {
      setBreakdownLoading(false);
    }
  };

  // Build next steps based on what's missing
  const nextSteps = [];
  if (!hasTransactions)
    nextSteps.push({
      title: "Record your first transaction",
      description: "Log income or expenses to start tracking",
      href: "/transactions",
      icon: Receipt,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-100 dark:bg-emerald-950/40",
    });
  if (data.budgetProgress.length === 0)
    nextSteps.push({
      title: "Set a budget",
      description: "Create spending limits by category",
      href: "/budgets",
      icon: Target,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-100 dark:bg-amber-950/40",
    });
  if (data.goals.length === 0)
    nextSteps.push({
      title: "Create a savings goal",
      description: "Set targets for what you're saving for",
      href: "/goals",
      icon: Flag,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-100 dark:bg-blue-950/40",
    });

  return (
    <div className="space-y-6">
      {/* Page header with greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Overview</h1>
          <p className="text-muted-foreground text-sm">
            {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })} — {data.accounts.length} account{data.accounts.length !== 1 ? "s" : ""}
            {hasTransactions ? ` · ${data.recentTransactions.length} recent transactions` : ""}
          </p>
        </div>
        <Link href="/reports">
          <Badge variant="outline" className="gap-1 cursor-pointer hover:bg-accent transition-colors">
            <BarChart3 className="w-3 h-3" />
            Full Report
          </Badge>
        </Link>
      </div>

      {/* Next Steps - show when user still has setup to do */}
      {nextSteps.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {nextSteps.map((s) => (
            <Link key={s.title} href={s.href}>
              <Card className="group border-dashed hover:border-solid hover:border-emerald-300 dark:hover:border-emerald-700 transition-all cursor-pointer h-full">
                <CardContent className="flex items-center gap-3 py-3">
                  <div className={`w-9 h-9 ${s.bg} rounded-lg flex items-center justify-center shrink-0`}>
                    <s.icon className={`w-4 h-4 ${s.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm">{s.title}</h3>
                    <p className="text-xs text-muted-foreground">{s.description}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Accounts Overview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Your Accounts</CardTitle>
          <Link href="/accounts" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Manage
          </Link>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.accounts.map((acc) => {
              const Icon = getAccountIcon(acc.type);
              const fmt = currencyFormatter(acc.currency);
              return (
                <div key={acc.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: (acc.color || "#6b7280") + "20" }}>
                    <Icon className="w-4 h-4" style={{ color: acc.color || "#6b7280" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{acc.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {acc.type.toLowerCase().replace("_", " ")} · {acc.currency}
                    </p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums">{fmt(acc.balance - (acc.reservedAmount || 0))}</p>
                </div>
              );
            })}
          </div>
          {data.debts.activeCount > 0 && (
            <div className="mt-3 pt-3 border-t flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-red-500" />
                <span className="text-sm text-muted-foreground">
                  {data.debts.activeCount} active debt{data.debts.activeCount !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-red-500">{formatCurrency(data.debts.totalDebt)}</span>
                <Link href="/debts" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  View
                </Link>
              </div>
            </div>
          )}
          {data.installments.activeCount > 0 && (
            <div className={`${data.debts.activeCount > 0 ? "mt-2" : "mt-3 pt-3 border-t"} flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-amber-500" />
                <span className="text-sm text-muted-foreground">
                  {data.installments.activeCount} installment{data.installments.activeCount !== 1 ? "s" : ""} · {formatCurrency(data.installments.monthlyTotal)}/mo
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-amber-500">{formatCurrency(data.installments.totalRemaining)}</span>
                <Link href="/installments" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  View
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Row 1: Key metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Net Worth Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net Worth</CardTitle>
            <Badge variant="secondary" className="text-xs">
              All Accounts
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">
              <AnimatedCounter value={data.netWorth} formatFn={formatCurrency} />
            </div>
            <div className="flex items-center gap-1 mt-1">
              {data.netWorthChange >= 0 ? <ArrowUpRight className="w-4 h-4 text-emerald-500" /> : <ArrowDownRight className="w-4 h-4 text-red-500" />}
              <span className={`text-sm font-medium ${data.netWorthChange >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                {data.netWorthChange >= 0 ? "+" : ""}
                {data.netWorthChange.toFixed(1)}%
              </span>
              <span className="text-sm text-muted-foreground">vs last month</span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 pt-4 border-t">
              <div>
                <p className="text-xs text-muted-foreground">Income</p>
                <p className="text-sm font-semibold text-emerald-600">{formatCurrency(data.currentMonth.income)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Expenses</p>
                <p className="text-sm font-semibold text-red-500">{formatCurrency(data.currentMonth.expenses)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Net Savings</p>
                <p className={`text-sm font-semibold ${data.currentMonth.savings >= 0 ? "text-blue-600" : "text-red-500"}`}>{formatCurrency(data.currentMonth.savings)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Budget Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Budget</CardTitle>
            <Link href="/budgets" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              View All
            </Link>
          </CardHeader>
          <CardContent>
            {data.budgetProgress.length > 0 ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold tracking-tight">
                    <AnimatedCounter value={totalSpent} formatFn={formatCurrency} />
                  </span>
                  <span className="text-sm text-muted-foreground">/ {formatCurrency(totalBudget)}</span>
                </div>
                <Progress value={Math.min(budgetPercentage, 100)} className="mt-3 h-2" />
                <div className="flex items-center gap-3 mt-3 text-sm">
                  <span className="text-emerald-600 font-medium">{budgetsOnTrack} on track</span>
                  {budgetsOver > 0 && <span className="text-red-500 font-medium">{budgetsOver} over budget</span>}
                </div>
                <div className="mt-3 space-y-2 pt-3 border-t">
                  {data.budgetProgress.slice(0, 3).map((b) => (
                    <div key={b.id} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: b.categoryColor }} />
                      <span className="text-xs text-muted-foreground flex-1 truncate">{b.category}</span>
                      <span className="text-xs font-medium tabular-nums">
                        {formatCurrency(b.spent)} / {formatCurrency(b.limit)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <Target className="w-8 h-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">No budgets set yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Investment Portfolio Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Investment Portfolio</CardTitle>
            <Link href="/investments" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              View All
            </Link>
          </CardHeader>
          <CardContent>
            {data.investments.totalInvested > 0 ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold tracking-tight">
                    <AnimatedCounter value={data.investments.totalCurrentValue} formatFn={formatCurrency} />
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-1">
                  {data.investments.totalReturn >= 0 ? <TrendingUp className="w-4 h-4 text-emerald-500" /> : <TrendingDown className="w-4 h-4 text-red-500" />}
                  <span className={`text-sm font-medium ${data.investments.totalReturn >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                    {data.investments.totalReturn >= 0 ? "+" : ""}
                    {formatCurrency(data.investments.totalReturn)} ({data.investments.returnPercentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="mt-4 pt-3 border-t">
                  <PortfolioPieChart data={data.investments.byType} />
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <TrendingUp className="w-8 h-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">No investments yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Chart + Side panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Income vs Expenses Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Income vs Expenses</CardTitle>
              <CardDescription>Monthly trend for the past year</CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              {new Date().getFullYear()}
            </Badge>
          </CardHeader>
          <CardContent>
            <IncomeExpenseChart data={data.monthlyTrend} onMonthClick={handleMonthClick} />
          </CardContent>
        </Card>

        {/* Side panel */}
        <div className="space-y-4">
          {/* Savings Goals */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Savings Goals</CardTitle>
              <Link href="/goals" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                View All
              </Link>
            </CardHeader>
            <CardContent>
              {data.goals.length > 0 ? (
                <>
                  <div className="text-2xl font-bold">{formatCurrency(totalGoalCurrent)}</div>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-sm text-emerald-500 font-medium">{goalPercentage.toFixed(0)}%</span>
                    <span className="text-sm text-muted-foreground">of {formatCurrency(totalGoalTarget)}</span>
                  </div>
                  <div className="mt-3 space-y-3">
                    {data.goals.slice(0, 3).map((goal) => (
                      <div key={goal.id}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-medium">{goal.name}</span>
                          <span className="text-muted-foreground">{goal.percentage.toFixed(0)}%</span>
                        </div>
                        <Progress value={Math.min(goal.percentage, 100)} className="h-1.5" />
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <Flag className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No goals set yet</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Spending Categories */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Top Spending Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <SpendingCategoryChart data={data.topCategories} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Spending Insights */}
      {insights && insights.insights.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-500" />
              Spending Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                {insights.insights.map((insight, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 text-sm rounded-lg p-2 ${insight.type === "warning" ? "bg-amber-500/10" : insight.type === "success" ? "bg-emerald-500/10" : "bg-blue-500/10"}`}
                  >
                    {insight.type === "warning" ? (
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    ) : insight.type === "success" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    ) : (
                      <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                    )}
                    <span>{insight.message}</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Daily Average</p>
                  <p className="text-lg font-bold">{formatCurrency(insights.dailyAvg)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Projected Monthly</p>
                  <p className="text-lg font-bold">{formatCurrency(insights.projectedMonthly)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Days Left</p>
                  <p className="text-lg font-bold">{insights.daysRemaining}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">vs Last Month</p>
                  <p className={`text-lg font-bold ${insights.lastTotal > 0 ? (insights.currentTotal > insights.lastTotal ? "text-red-500" : "text-emerald-500") : ""}`}>
                    {insights.lastTotal > 0 ? `${((insights.currentTotal / insights.lastTotal - 1) * 100).toFixed(0)}%` : "—"}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monthly Follow-up */}
      {monthlyProgress && (monthlyProgress.activeDebts > 0 || monthlyProgress.activeInstallments > 0 || monthlyProgress.activeGoals > 0 || monthlyProgress.totalAssetCount > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-blue-500" />
              Monthly Follow-up
            </CardTitle>
            <CardDescription>{monthlyProgress.monthLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {monthlyProgress.activeDebts > 0 && (
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Debt Remaining</p>
                  <p className="text-lg font-bold text-red-500">{formatCurrency(monthlyProgress.totalDebtRemaining)}</p>
                  <p className="text-xs text-muted-foreground">
                    {monthlyProgress.activeDebts} active · {formatCurrency(monthlyProgress.debtPaidThisMonth)}/mo
                  </p>
                </div>
              )}
              {monthlyProgress.activeInstallments > 0 && (
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Installments</p>
                  <p className="text-lg font-bold text-amber-500">
                    {formatCurrency(monthlyProgress.installmentMonthlyTotal)}
                    <span className="text-xs font-normal text-muted-foreground">/mo</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {monthlyProgress.activeInstallments} active{monthlyProgress.installmentsCompletingSoon > 0 ? ` · ${monthlyProgress.installmentsCompletingSoon} ending soon` : ""}
                  </p>
                </div>
              )}
              {monthlyProgress.activeGoals > 0 && (
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Goal Progress</p>
                  <p className="text-lg font-bold text-emerald-500">{monthlyProgress.totalGoalProgress.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">
                    {monthlyProgress.activeGoals} goal{monthlyProgress.activeGoals !== 1 ? "s" : ""}
                    {monthlyProgress.goalContributionsThisMonth > 0 ? ` · ${formatCurrency(monthlyProgress.goalContributionsThisMonth)}/mo` : ""}
                  </p>
                </div>
              )}
              {(monthlyProgress.totalSavingsBalance > 0 || monthlyProgress.projectedInterestMonthly > 0) && (
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Savings</p>
                  <p className="text-lg font-bold text-blue-500">{formatCurrency(monthlyProgress.totalSavingsBalance)}</p>
                  {monthlyProgress.projectedInterestMonthly > 0 && <p className="text-xs text-emerald-500">+{formatCurrency(monthlyProgress.projectedInterestMonthly)} interest/mo</p>}
                </div>
              )}
              {monthlyProgress.totalAssetCount > 0 && (
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Assets</p>
                  <p className="text-lg font-bold text-indigo-500">{formatCurrency(monthlyProgress.totalAssetValue)}</p>
                  <p className="text-xs text-muted-foreground">
                    {monthlyProgress.totalAssetCount} asset{monthlyProgress.totalAssetCount !== 1 ? "s" : ""}
                  </p>
                </div>
              )}
            </div>
            {monthlyProgress.upcomingBills.length > 0 && (
              <div className="border-t pt-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">Upcoming This Month</p>
                <div className="space-y-2">
                  {monthlyProgress.upcomingBills.map((bill, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        {bill.type === "debt" ? <Landmark className="w-3.5 h-3.5 text-red-500" /> : <CreditCard className="w-3.5 h-3.5 text-amber-500" />}
                        <span>{bill.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium tabular-nums">{formatCurrency(bill.amount)}</span>
                        <span className="text-xs text-muted-foreground">day {bill.dueDay}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Row 3: Recent Transactions */}
      {data.recentTransactions.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Transactions</CardTitle>
            <Link href="/transactions" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              View All
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.recentTransactions.map((t) => (
                <div key={t.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{
                      backgroundColor: t.categoryColor + "20",
                    }}
                  >
                    {t.type === "INCOME" ? <ArrowUpRight className="w-4 h-4" style={{ color: t.categoryColor }} /> : <ArrowDownRight className="w-4 h-4" style={{ color: t.categoryColor }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.category} · {t.account}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold tabular-nums ${t.type === "INCOME" ? "text-emerald-600" : "text-foreground"}`}>
                      {t.type === "INCOME" ? "+" : "-"}
                      {currencyFormatter(t.currency)(t.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(t.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Month Breakdown Dialog */}
      <Dialog open={!!breakdownMonth} onOpenChange={(open) => !open && setBreakdownMonth(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{breakdownMonth} Breakdown</DialogTitle>
          </DialogHeader>
          {breakdownLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : breakdownTxns.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No transactions this month</div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-emerald-600 tabular-nums">
                    {formatCurrency(breakdownTxns.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.convertedAmount, 0))}
                  </p>
                  <p className="text-xs text-muted-foreground">Income</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-red-500 tabular-nums">
                    {formatCurrency(breakdownTxns.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.convertedAmount, 0))}
                  </p>
                  <p className="text-xs text-muted-foreground">Expenses</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold tabular-nums">
                    {formatCurrency(
                      breakdownTxns.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.convertedAmount, 0) -
                        breakdownTxns.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.convertedAmount, 0),
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">Savings</p>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {breakdownTxns.map((t) => {
                    const CIcon = getCategoryIcon(t.category?.icon || "tag");
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-6 h-6 rounded flex items-center justify-center shrink-0"
                              style={{ backgroundColor: (t.category?.color || "#6B7280") + "20" }}
                            >
                              <CIcon className="w-3 h-3" style={{ color: t.category?.color || "#6B7280" }} />
                            </div>
                            <span className="text-sm font-medium truncate max-w-[200px]">{t.description}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {t.category && (
                            <Badge variant="secondary" className="text-xs" style={{ backgroundColor: t.category.color + "20", color: t.category.color }}>
                              {t.category.name}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{t.account.name}</TableCell>
                        <TableCell className="text-right">
                          <span className={`text-sm font-semibold tabular-nums ${t.type === "INCOME" ? "text-emerald-600" : "text-foreground"}`}>
                            {t.type === "INCOME" ? "+" : "-"}
                            {currencyFormatter(t.account.currency)(t.amount)}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
