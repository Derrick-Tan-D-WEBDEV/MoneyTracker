"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Plus, Target, Trash2, AlertTriangle, Bell } from "lucide-react";
import { usePartnerView } from "@/hooks/use-partner-view";
import { getCategoryIcon } from "@/lib/category-icons";
import { getBudgets, createBudget, deleteBudget } from "@/actions/budgets";
import { getCategories } from "@/actions/categories";
import { toast } from "sonner";
import { currencyFormatter } from "@/lib/format";
import { useSession } from "next-auth/react";

interface Budget {
  id: string;
  categoryId: string;
  category: string;
  categoryColor: string;
  categoryIcon: string;
  amount: number;
  period: string;
  alertThreshold: number;
  spent: number;
  remaining: number;
  percentage: number;
  isOverBudget: boolean;
  isNearLimit: boolean;
}

interface Category {
  id: string;
  name: string;
  type: string;
  icon: string;
  color: string;
}

export function BudgetsClient() {
  const { data: session } = useSession();
  const { isPartnerView } = usePartnerView();
  const formatCurrency = currencyFormatter(session?.user?.currency);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [formCategoryId, setFormCategoryId] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formPeriod, setFormPeriod] = useState("MONTHLY");
  const [formAlertThreshold, setFormAlertThreshold] = useState("80");

  const fetchData = async () => {
    try {
      const [budgetData, catData] = await Promise.all([getBudgets(), getCategories("EXPENSE")]);
      setBudgets(budgetData);
      setCategories(catData);
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createBudget({
        categoryId: formCategoryId,
        amount: parseFloat(formAmount),
        period: formPeriod as "WEEKLY" | "MONTHLY" | "YEARLY",
        alertThreshold: parseInt(formAlertThreshold) || 80,
        startDate: new Date().toISOString(),
        endDate: null,
      });
      toast.success("Budget created");
      setDialogOpen(false);
      setFormCategoryId("");
      setFormAmount("");
      fetchData();
    } catch {
      toast.error("Failed to create budget");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBudget(id);
      toast.success("Budget deleted");
      fetchData();
    } catch {
      toast.error("Failed to delete budget");
    }
  };

  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
  const overBudgetCount = budgets.filter((b) => b.isOverBudget).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Budgets</h1>
          <p className="text-muted-foreground">Set spending limits per category</p>
        </div>
        {!isPartnerView && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger render={<Button />}>
              <Plus className="w-4 h-4 mr-2" />
              Add Budget
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Budget</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={formCategoryId} onValueChange={(v) => v && setFormCategoryId(v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue>{(value: string) => categories.find((c) => c.id === value)?.name || "Select category..."}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => {
                        const CIcon = getCategoryIcon(c.icon);
                        return (
                          <SelectItem key={c.id} value={c.id}>
                            <span className="flex items-center gap-2">
                              <CIcon className="w-3.5 h-3.5 shrink-0" style={{ color: c.color }} />
                              {c.name}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Budget Amount</Label>
                  <Input type="number" step="1" min="1" placeholder="500" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} required />
                </div>

                <div className="space-y-2">
                  <Label>Period</Label>
                  <Select value={formPeriod} onValueChange={(v) => v && setFormPeriod(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WEEKLY">Weekly</SelectItem>
                      <SelectItem value="MONTHLY">Monthly</SelectItem>
                      <SelectItem value="YEARLY">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Alert at (%)</Label>
                  <Input type="number" min="1" max="100" value={formAlertThreshold} onChange={(e) => setFormAlertThreshold(e.target.value)} placeholder="80" />
                  <p className="text-xs text-muted-foreground">Get warned when spending reaches this percentage</p>
                </div>

                <Button type="submit" className="w-full">
                  Create Budget
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Alert Banner */}
      {budgets.some((b) => b.isNearLimit || b.isOverBudget) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-4 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-400">
            <Bell className="w-4 h-4" />
            Budget Alerts
          </div>
          {budgets
            .filter((b) => b.isOverBudget)
            .map((b) => (
              <div key={b.id} className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>
                  <strong>{b.category}</strong> is over budget — {formatCurrency(b.spent)} of {formatCurrency(b.amount)} ({b.percentage.toFixed(0)}%)
                </span>
              </div>
            ))}
          {budgets
            .filter((b) => b.isNearLimit)
            .map((b) => (
              <div key={b.id} className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>
                  <strong>{b.category}</strong> is at {b.percentage.toFixed(0)}% — {formatCurrency(b.remaining)} remaining
                </span>
              </div>
            ))}
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total Budget</p>
            <p className="text-2xl font-bold">{formatCurrency(totalBudget)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total Spent</p>
            <p className="text-2xl font-bold">{formatCurrency(totalSpent)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Over Budget</p>
            <p className="text-2xl font-bold text-red-500">
              {overBudgetCount} categor{overBudgetCount !== 1 ? "ies" : "y"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Budget cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="pt-4 space-y-3">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3 w-full rounded-full" />
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : budgets.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No budgets set yet. Create your first budget!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {budgets.map((budget) => (
            <Card key={budget.id} className="group relative">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const BIcon = getCategoryIcon(budget.categoryIcon);
                      return (
                        <span className="w-7 h-7 rounded-md flex items-center justify-center" style={{ backgroundColor: budget.categoryColor + "20" }}>
                          <BIcon className="w-3.5 h-3.5" style={{ color: budget.categoryColor }} />
                        </span>
                      );
                    })()}
                    <span className="font-semibold">{budget.category}</span>
                    <Badge variant="secondary" className="text-xs">
                      {budget.period}
                    </Badge>
                  </div>
                  {!isPartnerView && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500"
                      onClick={() => handleDelete(budget.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>

                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-2xl font-bold tabular-nums">{formatCurrency(budget.spent)}</span>
                  <span className="text-sm text-muted-foreground">of {formatCurrency(budget.amount)}</span>
                </div>

                <Progress value={Math.min(budget.percentage, 100)} className={`h-2 ${budget.isOverBudget ? "[&>div]:bg-red-500" : ""}`} />

                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-muted-foreground">{formatCurrency(budget.remaining)} remaining</span>
                  {budget.isOverBudget && (
                    <div className="flex items-center gap-1 text-xs text-red-500">
                      <AlertTriangle className="w-3 h-3" />
                      Over budget!
                    </div>
                  )}
                  {budget.isNearLimit && (
                    <div className="flex items-center gap-1 text-xs text-amber-500">
                      <AlertTriangle className="w-3 h-3" />
                      {budget.percentage.toFixed(0)}% used
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
