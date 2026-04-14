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
import { Plus, Flag, Trash2, Pencil, Home, Car, Shield, Sunset, Palmtree, GraduationCap, Target, DollarSign, Wallet, TrendingUp, Calendar } from "lucide-react";
import { usePartnerView } from "@/hooks/use-partner-view";
import { getGoals, createGoal, updateGoal, addContribution, deleteGoal } from "@/actions/goals";
import { SUPPORTED_CURRENCIES } from "@/lib/constants";
import { getAccounts } from "@/actions/accounts";
import { toast } from "sonner";
import { currencyFormatter } from "@/lib/format";
import { useSession } from "next-auth/react";

const GOAL_TYPES = [
  { value: "PROPERTY", label: "Property", icon: Home },
  { value: "VEHICLE", label: "Vehicle", icon: Car },
  { value: "EMERGENCY_FUND", label: "Emergency Fund", icon: Shield },
  { value: "RETIREMENT", label: "Retirement", icon: Sunset },
  { value: "VACATION", label: "Vacation", icon: Palmtree },
  { value: "EDUCATION", label: "Education", icon: GraduationCap },
  { value: "CUSTOM", label: "Custom", icon: Target },
];

const GOAL_COLORS = ["#10B981", "#3B82F6", "#8B5CF6", "#EC4899", "#F59E0B", "#EF4444", "#06B6D4", "#F97316"];

interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: string;
  type: string;
  deadline: string | null;
  interestRate: number;
  monthlyContribution: number;
  icon: string;
  color: string;
  percentage: number;
  remaining: number;
  monthsToGoal: number | null;
  account: { id: string; name: string; type: string; currency: string } | null;
}

interface Account {
  id: string;
  name: string;
  type: string;
  currency: string;
  balance: number;
}

function getGoalIcon(type: string) {
  return GOAL_TYPES.find((t) => t.value === type)?.icon || Target;
}

export function GoalsClient() {
  const { data: session } = useSession();
  const { isPartnerView } = usePartnerView();
  const userCurrency = session?.user?.currency || "MYR";
  const [goals, setGoals] = useState<Goal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [contributeId, setContributeId] = useState<string | null>(null);
  const [contributeAmount, setContributeAmount] = useState("");

  const [formName, setFormName] = useState("");
  const [formTarget, setFormTarget] = useState("");
  const [formCurrentAmount, setFormCurrentAmount] = useState("");
  const [formType, setFormType] = useState("CUSTOM");
  const [formDeadline, setFormDeadline] = useState("");
  const [formInterestRate, setFormInterestRate] = useState("");
  const [formMonthlyContribution, setFormMonthlyContribution] = useState("");
  const [formColor, setFormColor] = useState("#10B981");
  const [formCurrency, setFormCurrency] = useState(userCurrency);
  const [formAccountId, setFormAccountId] = useState<string | null>(null);

  // Filter to savings/investment accounts
  const savingsAccounts = accounts.filter((a) => a.type === "SAVINGS" || a.type === "INVESTMENT");

  const fetchGoals = async () => {
    try {
      const data = await getGoals();
      setGoals(data);
    } catch {
      toast.error("Failed to load goals");
    } finally {
      setLoading(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      const data = await getAccounts();
      setAccounts(data);
    } catch {
      // silently fail
    }
  };

  useEffect(() => {
    fetchGoals();
    fetchAccounts();
  }, []);

  const resetForm = () => {
    setFormName("");
    setFormTarget("");
    setFormCurrentAmount("");
    setFormType("CUSTOM");
    setFormDeadline("");
    setFormInterestRate("");
    setFormMonthlyContribution("");
    setFormColor("#10B981");
    setFormCurrency(userCurrency);
    setFormAccountId(null);
    setEditingGoal(null);
  };

  const openEditDialog = (goal: Goal) => {
    setEditingGoal(goal);
    setFormName(goal.name);
    setFormTarget(String(goal.targetAmount));
    setFormCurrentAmount(String(goal.currentAmount));
    setFormType(goal.type);
    setFormDeadline(goal.deadline ? goal.deadline.slice(0, 10) : "");
    setFormInterestRate(goal.interestRate ? String(goal.interestRate) : "");
    setFormMonthlyContribution(goal.monthlyContribution ? String(goal.monthlyContribution) : "");
    setFormColor(goal.color);
    setFormCurrency(goal.currency);
    setFormAccountId(goal.account?.id || null);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: formName,
      targetAmount: parseFloat(formTarget),
      currentAmount: formCurrentAmount ? parseFloat(formCurrentAmount) : 0,
      currency: formCurrency,
      type: formType as "PROPERTY" | "VEHICLE" | "EMERGENCY_FUND" | "RETIREMENT" | "VACATION" | "EDUCATION" | "CUSTOM",
      accountId: formAccountId,
      deadline: formDeadline || null,
      interestRate: formInterestRate ? parseFloat(formInterestRate) : 0,
      monthlyContribution: formMonthlyContribution ? parseFloat(formMonthlyContribution) : 0,
      icon: "target",
      color: formColor,
    };
    try {
      if (editingGoal) {
        await updateGoal(editingGoal.id, payload);
        toast.success("Goal updated");
      } else {
        await createGoal(payload);
        toast.success("Goal created");
      }
      setDialogOpen(false);
      resetForm();
      fetchGoals();
    } catch {
      toast.error(editingGoal ? "Failed to update goal" : "Failed to create goal");
    }
  };

  const handleContribute = async (goalId: string) => {
    const amount = parseFloat(contributeAmount);
    if (!amount || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    try {
      await addContribution(goalId, amount);
      toast.success("Contribution added");
      setContributeId(null);
      setContributeAmount("");
      fetchGoals();
    } catch {
      toast.error("Failed to add contribution");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteGoal(id);
      toast.success("Goal deleted");
      fetchGoals();
    } catch {
      toast.error("Failed to delete goal");
    }
  };

  const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);
  const totalSaved = goals.reduce((s, g) => s + g.currentAmount, 0);
  const defaultFormat = currencyFormatter(userCurrency);

  // Helper: format in goal's own currency
  const fmtGoal = (goal: Goal, amount: number) => {
    const currency = goal.currency || goal.account?.currency || userCurrency;
    return currencyFormatter(currency)(amount);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Goals</h1>
          <p className="text-muted-foreground">Track progress toward your financial goals</p>
        </div>
        {!isPartnerView && (
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger render={<Button />}>
              <Plus className="w-4 h-4 mr-2" />
              Add Goal
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingGoal ? "Edit Goal" : "Create Goal"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Goal Name</Label>
                  <Input placeholder="e.g., Down payment for house" value={formName} onChange={(e) => setFormName(e.target.value)} required />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Target Amount</Label>
                    <Input type="number" step="1" min="1" placeholder="50000" value={formTarget} onChange={(e) => setFormTarget(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Amount Saved So Far</Label>
                    <Input type="number" step="0.01" min="0" placeholder="0" value={formCurrentAmount} onChange={(e) => setFormCurrentAmount(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select value={formCurrency} onValueChange={(v) => v && setFormCurrency(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={formType} onValueChange={(v) => v && setFormType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GOAL_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Monthly Contribution</Label>
                    <Input type="number" step="1" min="0" placeholder="500" value={formMonthlyContribution} onChange={(e) => setFormMonthlyContribution(e.target.value)} />
                    <p className="text-xs text-muted-foreground">How much you plan to save monthly</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Interest Rate (% p.a.)</Label>
                    <Input type="number" step="0.01" min="0" max="100" placeholder="2.5" value={formInterestRate} onChange={(e) => setFormInterestRate(e.target.value)} />
                    <p className="text-xs text-muted-foreground">Savings account rate</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Deadline (optional)</Label>
                  <Input type="date" value={formDeadline} onChange={(e) => setFormDeadline(e.target.value)} />
                </div>

                {savingsAccounts.length > 0 && (
                  <div className="space-y-2">
                    <Label>Linked Account (optional)</Label>
                    <Select
                      value={formAccountId || "none"}
                      onValueChange={(v) => {
                        const id = v === "none" ? null : v;
                        setFormAccountId(id);
                        if (id) {
                          const acc = savingsAccounts.find((a) => a.id === id);
                          if (acc) setFormCurrentAmount(String(acc.balance));
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue>
                          {(value: string) => {
                            if (!value || value === "none") return "No linked account";
                            const acc = savingsAccounts.find((a) => a.id === value);
                            return acc ? `${acc.name} (${acc.currency})` : "No linked account";
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No linked account — track manually</SelectItem>
                        {savingsAccounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name} ({a.currency})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Optional — link to a savings or investment account for reference</p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Color</Label>
                  <div className="flex gap-2">
                    {GOAL_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`w-7 h-7 rounded-full transition-transform ${formColor === color ? "ring-2 ring-offset-2 ring-slate-400 scale-110" : ""}`}
                        style={{ backgroundColor: color }}
                        onClick={() => setFormColor(color)}
                      />
                    ))}
                  </div>
                </div>

                <Button type="submit" className="w-full">
                  {editingGoal ? "Save Changes" : "Create Goal"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total Target</p>
            <p className="text-2xl font-bold">{defaultFormat(totalTarget)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total Saved</p>
            <p className="text-2xl font-bold text-emerald-600">{defaultFormat(totalSaved)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Remaining</p>
            <p className="text-2xl font-bold">{defaultFormat(totalTarget - totalSaved)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Goal cards */}
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
      ) : goals.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Flag className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No goals yet. Create your first goal!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {goals.map((goal) => {
            const Icon = getGoalIcon(goal.type);
            return (
              <Card key={goal.id} className="group relative">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: goal.color + "20" }}>
                      <Icon className="w-5 h-5" style={{ color: goal.color }} />
                    </div>
                    {!isPartnerView && (
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openEditDialog(goal)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-500" onClick={() => handleDelete(goal.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="mt-3">
                    <h3 className="font-semibold text-sm">{goal.name}</h3>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <Badge variant="secondary" className="text-xs">
                        {GOAL_TYPES.find((t) => t.value === goal.type)?.label}
                      </Badge>
                      {goal.currency && goal.currency !== userCurrency && (
                        <Badge variant="secondary" className="text-xs">
                          {goal.currency}
                        </Badge>
                      )}
                      {goal.account && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Wallet className="w-2.5 h-2.5" />
                          {goal.account.name} ({goal.account.currency})
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-xl font-bold tabular-nums">{fmtGoal(goal, goal.currentAmount)}</span>
                      <span className="text-xs text-muted-foreground">of {fmtGoal(goal, goal.targetAmount)}</span>
                    </div>
                    <Progress value={Math.min(goal.percentage, 100)} className="h-2" />
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-muted-foreground">{goal.percentage.toFixed(0)}% complete</span>
                      {goal.deadline && (
                        <span className="text-xs text-muted-foreground">
                          Due{" "}
                          {new Date(goal.deadline).toLocaleDateString("en-US", {
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Savings Projection */}
                  {(goal.monthlyContribution > 0 || goal.interestRate > 0) && (
                    <div className="mt-2 p-2 rounded-md bg-muted/50 space-y-1">
                      {goal.monthlyContribution > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <TrendingUp className="w-3 h-3 shrink-0" />
                          <span>{fmtGoal(goal, goal.monthlyContribution)}/mo saving</span>
                        </div>
                      )}
                      {goal.interestRate > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <DollarSign className="w-3 h-3 shrink-0" />
                          <span>{goal.interestRate}% p.a. interest</span>
                        </div>
                      )}
                      {goal.monthsToGoal !== null && goal.monthsToGoal > 0 && (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          <Calendar className="w-3 h-3 shrink-0" />
                          <span>~{goal.monthsToGoal < 12 ? `${goal.monthsToGoal} month${goal.monthsToGoal !== 1 ? "s" : ""}` : `${(goal.monthsToGoal / 12).toFixed(1)} years`} to goal</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Contribute */}
                  {!isPartnerView && (
                    <div className="mt-3 pt-3 border-t">
                      {contributeId === goal.id ? (
                        <div className="flex gap-2">
                          <Input type="number" step="1" min="1" placeholder="Amount" value={contributeAmount} onChange={(e) => setContributeAmount(e.target.value)} className="h-8 text-sm" />
                          <Button size="sm" className="h-8" onClick={() => handleContribute(goal.id)}>
                            Add
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8"
                            onClick={() => {
                              setContributeId(null);
                              setContributeAmount("");
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={() => setContributeId(goal.id)}>
                          <DollarSign className="w-3 h-3 mr-1" />
                          Add Contribution
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
