"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Plus, Repeat, ArrowUpRight, ArrowDownRight, Trash2, CalendarClock, Play, Pause, Zap } from "lucide-react";
import { usePartnerView } from "@/hooks/use-partner-view";
import { getCategoryIcon } from "@/lib/category-icons";
import { getRecurringRules, createRecurringRule, toggleRecurringRule, deleteRecurringRule, processRecurringTransactions } from "@/actions/recurring";
import { getAccounts } from "@/actions/accounts";
import { getCategories } from "@/actions/categories";
import { currencyFormatter } from "@/lib/format";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

interface RecurringRule {
  id: string;
  frequency: string;
  nextDue: string;
  isActive: boolean;
  transaction: {
    id: string;
    description: string;
    amount: number;
    type: string;
    notes: string | null;
    category: { id: string; name: string; color: string; icon: string } | null;
    account: { id: string; name: string; currency: string };
  };
}

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
}

interface Category {
  id: string;
  name: string;
  type: string;
  icon: string;
  color: string;
}

const FREQUENCY_LABELS: Record<string, string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
};

const FREQUENCY_BADGE_COLOR: Record<string, string> = {
  DAILY: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  WEEKLY: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  MONTHLY: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  YEARLY: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
};

export function RecurringClient() {
  const { data: session } = useSession();
  const { isPartnerView } = usePartnerView();
  const userCurrency = session?.user?.currency || "MYR";
  const formatCurrency = currencyFormatter(userCurrency);
  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Form state
  const [formType, setFormType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [formAccountId, setFormAccountId] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formFrequency, setFormFrequency] = useState("MONTHLY");
  const [formNextDue, setFormNextDue] = useState(new Date().toISOString().split("T")[0]);

  const fetchData = async () => {
    try {
      const [rulesData, accts, cats] = await Promise.all([getRecurringRules(), getAccounts(), getCategories()]);
      setRules(rulesData as RecurringRule[]);
      setAccounts(accts as Account[]);
      setCategories(cats);
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetForm = () => {
    setFormType("EXPENSE");
    setFormAccountId("");
    setFormCategoryId("");
    setFormAmount("");
    setFormDescription("");
    setFormNotes("");
    setFormFrequency("MONTHLY");
    setFormNextDue(new Date().toISOString().split("T")[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createRecurringRule({
        accountId: formAccountId,
        categoryId: formCategoryId || null,
        type: formType,
        amount: parseFloat(formAmount),
        description: formDescription,
        notes: formNotes || null,
        frequency: formFrequency as "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY",
        nextDue: formNextDue,
      });
      toast.success("Recurring transaction created");
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch {
      toast.error("Failed to create recurring transaction");
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      await toggleRecurringRule(id, isActive);
      setRules((prev) => prev.map((r) => (r.id === id ? { ...r, isActive } : r)));
      toast.success(isActive ? "Rule activated" : "Rule paused");
    } catch {
      toast.error("Failed to update rule");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRecurringRule(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
      toast.success("Recurring transaction deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  const handleProcessNow = async () => {
    setProcessing(true);
    try {
      const result = await processRecurringTransactions();
      if (result.created > 0) {
        toast.success(`Processed ${result.created} recurring transaction${result.created > 1 ? "s" : ""}`);
        fetchData();
      } else {
        toast.info("No recurring transactions are due yet");
      }
    } catch {
      toast.error("Failed to process");
    } finally {
      setProcessing(false);
    }
  };

  const filteredCategories = categories.filter((c) => c.type === formType || c.type === "BOTH");

  const dueCount = rules.filter((r) => r.isActive && new Date(r.nextDue) <= new Date()).length;

  const activeCount = rules.filter((r) => r.isActive).length;
  const monthlyTotal = rules
    .filter((r) => r.isActive)
    .reduce((sum, r) => {
      const amt = r.transaction.amount;
      switch (r.frequency) {
        case "DAILY":
          return sum + amt * 30;
        case "WEEKLY":
          return sum + amt * 4.33;
        case "MONTHLY":
          return sum + amt;
        case "YEARLY":
          return sum + amt / 12;
        default:
          return sum;
      }
    }, 0);

  const formatAccountCurrency = (rule: RecurringRule) => {
    const acctCurrency = rule.transaction.account.currency;
    return currencyFormatter(acctCurrency)(rule.transaction.amount);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Recurring Transactions</h1>
          <p className="text-muted-foreground text-sm">Automate your regular income and expenses</p>
        </div>
        <div className="flex gap-2">
          {!isPartnerView && dueCount > 0 && (
            <Button variant="outline" onClick={handleProcessNow} disabled={processing}>
              <Zap className="w-4 h-4 mr-2" />
              Process Due ({dueCount})
            </Button>
          )}
          {!isPartnerView && (
            <Dialog
              open={dialogOpen}
              onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) resetForm();
              }}
            >
              <DialogTrigger
                render={
                  <Button>
                    <Plus className="w-4 h-4 mr-2" /> Add Recurring
                  </Button>
                }
              />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Recurring Transaction</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Type toggle */}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={formType === "EXPENSE" ? "default" : "outline"}
                      className={formType === "EXPENSE" ? "flex-1 bg-red-500 hover:bg-red-600" : "flex-1"}
                      onClick={() => {
                        setFormType("EXPENSE");
                        setFormCategoryId("");
                      }}
                    >
                      <ArrowDownRight className="w-4 h-4 mr-1" /> Expense
                    </Button>
                    <Button
                      type="button"
                      variant={formType === "INCOME" ? "default" : "outline"}
                      className={formType === "INCOME" ? "flex-1 bg-emerald-500 hover:bg-emerald-600" : "flex-1"}
                      onClick={() => {
                        setFormType("INCOME");
                        setFormCategoryId("");
                      }}
                    >
                      <ArrowUpRight className="w-4 h-4 mr-1" /> Income
                    </Button>
                  </div>

                  {/* Amount */}
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount</Label>
                    <Input id="amount" type="number" step="0.01" min="0.01" required value={formAmount} onChange={(e) => setFormAmount(e.target.value)} placeholder="0.00" />
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Input id="description" required value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="e.g. Netflix, Rent, Salary" />
                  </div>

                  {/* Account */}
                  <div className="space-y-2">
                    <Label>Account</Label>
                    <Select value={formAccountId} onValueChange={(v) => setFormAccountId(v || "")} required>
                      <SelectTrigger>
                        <SelectValue>{(value: string) => accounts.find((a) => a.id === value)?.name || "Select account"}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Category */}
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={formCategoryId} onValueChange={(v) => setFormCategoryId(v || "")}>
                      <SelectTrigger>
                        <SelectValue>{(value: string) => filteredCategories.find((c) => c.id === value)?.name || "Select category (optional)"}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {filteredCategories.map((c) => {
                          const IconComp = getCategoryIcon(c.icon);
                          return (
                            <SelectItem key={c.id} value={c.id}>
                              <span className="flex items-center gap-2">
                                <IconComp className="w-4 h-4" style={{ color: c.color }} />
                                {c.name}
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Frequency */}
                  <div className="space-y-2">
                    <Label>Frequency</Label>
                    <Select value={formFrequency} onValueChange={(v) => setFormFrequency(v || "MONTHLY")} required>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DAILY">Daily</SelectItem>
                        <SelectItem value="WEEKLY">Weekly</SelectItem>
                        <SelectItem value="MONTHLY">Monthly</SelectItem>
                        <SelectItem value="YEARLY">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Next Due Date */}
                  <div className="space-y-2">
                    <Label htmlFor="nextDue">First Due Date</Label>
                    <Input id="nextDue" type="date" required value={formNextDue} onChange={(e) => setFormNextDue(e.target.value)} />
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes (optional)</Label>
                    <Input id="notes" value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Optional notes" />
                  </div>

                  <Button type="submit" className="w-full">
                    Create Recurring Transaction
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <Repeat className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Rules</p>
                <p className="text-2xl font-bold">{activeCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <CalendarClock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Due Now</p>
                <p className="text-2xl font-bold">{dueCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Zap className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Est. Monthly</p>
                <p className="text-2xl font-bold">{formatCurrency(monthlyTotal)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rules list */}
      {rules.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Repeat className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-1">No recurring transactions yet</h3>
            <p className="text-muted-foreground text-sm mb-4">Set up automatic transactions for rent, subscriptions, salary, and more</p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Add Your First
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => {
            const tx = rule.transaction;
            const isExpense = tx.type === "EXPENSE";
            const isDue = rule.isActive && new Date(rule.nextDue) <= new Date();
            const IconComp = tx.category ? getCategoryIcon(tx.category.icon) : isExpense ? ArrowDownRight : ArrowUpRight;
            const iconColor = tx.category?.color || (isExpense ? "#EF4444" : "#10B981");

            return (
              <Card key={rule.id} className={`transition-all ${!rule.isActive ? "opacity-50" : ""} ${isDue ? "ring-2 ring-amber-400 dark:ring-amber-500" : ""}`}>
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    {/* Icon */}
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${iconColor}20` }}>
                      <IconComp className="w-5 h-5" style={{ color: iconColor }} />
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{tx.description}</span>
                        <Badge variant="secondary" className={FREQUENCY_BADGE_COLOR[rule.frequency] || ""}>
                          {FREQUENCY_LABELS[rule.frequency]}
                        </Badge>
                        {isDue && (
                          <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                            Due
                          </Badge>
                        )}
                        {!rule.isActive && (
                          <Badge variant="secondary" className="bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                            Paused
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                        <span>{tx.account.name}</span>
                        {tx.category && (
                          <>
                            <span>·</span>
                            <span>{tx.category.name}</span>
                          </>
                        )}
                        <span>·</span>
                        <span>Next: {new Date(rule.nextDue).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Amount */}
                    <div className={`text-right font-semibold whitespace-nowrap ${isExpense ? "text-red-500" : "text-emerald-500"}`}>
                      {isExpense ? "-" : "+"}
                      {formatAccountCurrency(rule)}
                    </div>

                    {/* Actions */}
                    {!isPartnerView && (
                      <div className="flex items-center gap-2 shrink-0">
                        <Switch checked={rule.isActive} onCheckedChange={(checked) => handleToggle(rule.id, checked)} />
                        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => handleDelete(rule.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
