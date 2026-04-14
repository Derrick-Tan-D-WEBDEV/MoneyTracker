"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Heart,
  Wallet,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Target,
  Landmark,
  ArrowRight,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { currencyFormatter } from "@/lib/format";

type PartnerData = {
  partner: { name: string | null; email: string | null; image: string | null; currency: string };
  netWorth: number;
  currentMonth: { income: number; expenses: number; savings: number };
  accounts: { id: string; name: string; type: string; balance: number; currency: string; color: string; icon: string }[];
  recentTransactions: {
    id: string;
    type: string;
    amount: number;
    description: string;
    date: string;
    category: string;
    categoryIcon: string;
    accountName: string;
  }[];
  goals: { id: string; name: string; targetAmount: number; currentAmount: number; type: string; icon: string; color: string }[];
  debts: { id: string; name: string; type: string; originalAmount: number; remainingAmount: number }[];
  totalDebt: number;
};

type CoupleLink = {
  id: string;
  status: string;
  inviteCode: string | null;
  partner: { id: string; name: string | null; email: string | null; image: string | null } | null;
  isInitiator: boolean;
  createdAt: string;
  acceptedAt: string | null;
} | null;

export function PartnerDashboardClient({
  coupleLink,
  partnerData,
}: {
  coupleLink: CoupleLink;
  partnerData: PartnerData | null;
}) {
  if (!coupleLink || coupleLink.status !== "ACCEPTED" || !partnerData) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Heart className="w-6 h-6 text-pink-500" />
            Partner Dashboard
          </h1>
          <p className="text-muted-foreground">View your partner&apos;s finances</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <Heart className="w-12 h-12 text-muted-foreground/30 mx-auto" />
            <h3 className="text-lg font-semibold">No Partner Linked</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Link with your partner in Settings to see each other&apos;s financial overview.
            </p>
            <Link href="/settings">
              <Button variant="outline" className="gap-2 mt-2">
                <Settings className="w-4 h-4" />
                Go to Settings
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { partner, netWorth, currentMonth, accounts, recentTransactions, goals, debts, totalDebt } = partnerData;
  const fmt = currencyFormatter(partner.currency);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Avatar className="w-10 h-10">
          <AvatarImage src={partner.image || ""} />
          <AvatarFallback className="bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-400 font-semibold">
            {partner.name?.[0]?.toUpperCase() || "P"}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            {partner.name || "Partner"}&apos;s Finances
            <Heart className="w-5 h-5 text-pink-500 fill-pink-500" />
          </h1>
          <p className="text-muted-foreground text-sm">Read-only view of your partner&apos;s financial data</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Wallet className="w-3.5 h-3.5" />
              Net Worth
            </div>
            <p className="text-lg font-bold">{fmt(netWorth)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              Income (Month)
            </div>
            <p className="text-lg font-bold text-emerald-600">{fmt(currentMonth.income)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <TrendingDown className="w-3.5 h-3.5 text-red-500" />
              Expenses (Month)
            </div>
            <p className="text-lg font-bold text-red-600">{fmt(currentMonth.expenses)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <PiggyBank className="w-3.5 h-3.5 text-blue-500" />
              Savings (Month)
            </div>
            <p className={`text-lg font-bold ${currentMonth.savings >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {fmt(currentMonth.savings)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Accounts */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              Accounts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No accounts</p>
            ) : (
              accounts.map((acc) => (
                <div key={acc.id} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: acc.color }} />
                    <span className="text-sm">{acc.name}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {acc.type.replace("_", " ")}
                    </Badge>
                  </div>
                  <span className="text-sm font-medium">{currencyFormatter(acc.currency)(acc.balance)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowRight className="w-4 h-4" />
              Recent Transactions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No transactions this month</p>
            ) : (
              recentTransactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-1.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{tx.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {tx.category} · {new Date(tx.date).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-medium shrink-0 ml-2 ${
                      tx.type === "INCOME" ? "text-emerald-600" : tx.type === "EXPENSE" ? "text-red-600" : "text-blue-600"
                    }`}
                  >
                    {tx.type === "INCOME" ? "+" : tx.type === "EXPENSE" ? "-" : ""}
                    {fmt(tx.amount)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Goals */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="w-4 h-4" />
              Goals
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {goals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No goals set</p>
            ) : (
              goals.map((goal) => {
                const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
                return (
                  <div key={goal.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">{goal.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {fmt(goal.currentAmount)} / {fmt(goal.targetAmount)}
                      </span>
                    </div>
                    <Progress value={Math.min(progress, 100)} className="h-2" />
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Debts */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Landmark className="w-4 h-4" />
              Debts
              {totalDebt > 0 && (
                <Badge variant="destructive" className="text-[10px] ml-auto">
                  {fmt(totalDebt)} total
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {debts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active debts 🎉</p>
            ) : (
              debts.map((debt) => {
                const progress =
                  debt.originalAmount > 0
                    ? ((debt.originalAmount - debt.remainingAmount) / debt.originalAmount) * 100
                    : 0;
                return (
                  <div key={debt.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">{debt.name}</span>
                      <span className="text-xs text-muted-foreground">{fmt(debt.remainingAmount)} left</span>
                    </div>
                    <Progress value={Math.min(progress, 100)} className="h-2" />
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
