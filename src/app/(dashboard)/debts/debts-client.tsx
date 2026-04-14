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
import { Progress } from "@/components/ui/progress";
import { Plus, Landmark, Car, Home, GraduationCap, CreditCard, HeartPulse, CircleDollarSign, Trash2, BadgeCheck, Banknote, CalendarDays, Percent, TrendingDown, Pencil } from "lucide-react";
import { usePartnerView } from "@/hooks/use-partner-view";
import { getDebts, createDebt, updateDebt, makePayment, deleteDebt } from "@/actions/debts";
import { getAccounts } from "@/actions/accounts";
import { getExchangeRates as fetchExchangeRates } from "@/actions/exchange-rates";
import { convertCurrency } from "@/lib/exchange-rates";
import { SUPPORTED_CURRENCIES } from "@/lib/constants";
import { currencyFormatter } from "@/lib/format";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

interface Debt {
  id: string;
  name: string;
  type: string;
  lender: string | null;
  accountId: string | null;
  accountName: string | null;
  accountColor: string | null;
  accountRepaymentDay: number | null;
  accountCreditLimit: number | null;
  originalAmount: number;
  remainingAmount: number;
  interestRate: number;
  minimumPayment: number;
  dueDay: number | null;
  startDate: string;
  endDate: string | null;
  currency: string;
  icon: string;
  color: string;
  isPaidOff: boolean;
  notes: string | null;
  createdAt: string;
}

interface Account {
  id: string;
  name: string;
  type: string;
  color: string;
  currency: string;
}

const DEBT_TYPE_OPTIONS = [
  { value: "PERSONAL_LOAN", label: "Personal Loan", icon: Landmark },
  { value: "CAR_LOAN", label: "Car Loan", icon: Car },
  { value: "MORTGAGE", label: "Mortgage", icon: Home },
  { value: "STUDENT_LOAN", label: "Student Loan", icon: GraduationCap },
  { value: "CREDIT_CARD", label: "Credit Card", icon: CreditCard },
  { value: "MEDICAL", label: "Medical", icon: HeartPulse },
  { value: "OTHER", label: "Other", icon: CircleDollarSign },
];

const DEBT_TYPE_COLORS: Record<string, string> = {
  PERSONAL_LOAN: "#8B5CF6",
  CAR_LOAN: "#3B82F6",
  MORTGAGE: "#10B981",
  STUDENT_LOAN: "#F59E0B",
  CREDIT_CARD: "#EF4444",
  MEDICAL: "#EC4899",
  OTHER: "#6B7280",
};

function getDebtIcon(type: string) {
  return DEBT_TYPE_OPTIONS.find((o) => o.value === type)?.icon || CircleDollarSign;
}

function getDebtTypeLabel(type: string) {
  return DEBT_TYPE_OPTIONS.find((o) => o.value === type)?.label || type;
}

export function DebtsClient() {
  const { data: session } = useSession();
  const { isPartnerView } = usePartnerView();
  const userCurrency = session?.user?.currency || "MYR";
  const formatCurrency = currencyFormatter(userCurrency);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payDebtId, setPayDebtId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");

  // Form state
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("PERSONAL_LOAN");
  const [formLender, setFormLender] = useState("");
  const [formOriginalAmount, setFormOriginalAmount] = useState("");
  const [formRemainingAmount, setFormRemainingAmount] = useState("");
  const [formInterestRate, setFormInterestRate] = useState("");
  const [formMinPayment, setFormMinPayment] = useState("");
  const [formDueDay, setFormDueDay] = useState("");
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [formEndDate, setFormEndDate] = useState("");
  const [formCurrency, setFormCurrency] = useState(userCurrency);
  const [formNotes, setFormNotes] = useState("");
  const [formAccountId, setFormAccountId] = useState("");

  const fetchData = async () => {
    try {
      const [data, rateData, accountData] = await Promise.all([getDebts(), fetchExchangeRates(userCurrency), getAccounts()]);
      setDebts(data);
      setRates(rateData);
      setAccounts(accountData.filter((a) => a.type === "CREDIT_CARD" || a.type === "LOAN"));
    } catch {
      toast.error("Failed to load debts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetForm = () => {
    setFormName("");
    setFormType("PERSONAL_LOAN");
    setFormLender("");
    setFormOriginalAmount("");
    setFormRemainingAmount("");
    setFormInterestRate("");
    setFormMinPayment("");
    setFormDueDay("");
    setFormStartDate(new Date().toISOString().split("T")[0]);
    setFormEndDate("");
    setFormCurrency(userCurrency);
    setFormNotes("");
    setFormAccountId("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const originalAmt = parseFloat(formOriginalAmount);
    const remainingAmt = formRemainingAmount ? parseFloat(formRemainingAmount) : originalAmt;
    try {
      await createDebt({
        name: formName,
        type: formType as "PERSONAL_LOAN" | "CAR_LOAN" | "MORTGAGE" | "STUDENT_LOAN" | "CREDIT_CARD" | "MEDICAL" | "OTHER",
        lender: formLender || null,
        accountId: formAccountId && formAccountId !== "none" ? formAccountId : null,
        originalAmount: originalAmt,
        remainingAmount: remainingAmt,
        interestRate: formInterestRate ? parseFloat(formInterestRate) : 0,
        minimumPayment: formMinPayment ? parseFloat(formMinPayment) : 0,
        dueDay: formDueDay ? parseInt(formDueDay) : null,
        startDate: formStartDate,
        endDate: formEndDate || null,
        currency: formCurrency,
        notes: formNotes || null,
      });
      toast.success("Debt added");
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch {
      toast.error("Failed to add debt");
    }
  };

  const handleEdit = (debt: Debt) => {
    setEditingDebt(debt);
    setFormName(debt.name);
    setFormType(debt.type);
    setFormLender(debt.lender || "");
    setFormOriginalAmount(String(debt.originalAmount));
    setFormRemainingAmount(String(debt.remainingAmount));
    setFormInterestRate(debt.interestRate ? String(debt.interestRate) : "");
    setFormMinPayment(debt.minimumPayment ? String(debt.minimumPayment) : "");
    setFormDueDay(debt.dueDay ? String(debt.dueDay) : "");
    setFormStartDate(debt.startDate.split("T")[0]);
    setFormEndDate(debt.endDate ? debt.endDate.split("T")[0] : "");
    setFormCurrency(debt.currency);
    setFormNotes(debt.notes || "");
    setFormAccountId(debt.accountId || "");
    setEditDialogOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDebt) return;
    const originalAmt = parseFloat(formOriginalAmount);
    const remainingAmt = formRemainingAmount ? parseFloat(formRemainingAmount) : originalAmt;
    try {
      await updateDebt(editingDebt.id, {
        name: formName,
        type: formType as "PERSONAL_LOAN" | "CAR_LOAN" | "MORTGAGE" | "STUDENT_LOAN" | "CREDIT_CARD" | "MEDICAL" | "OTHER",
        lender: formLender || null,
        accountId: formAccountId && formAccountId !== "none" ? formAccountId : null,
        originalAmount: originalAmt,
        remainingAmount: remainingAmt,
        interestRate: formInterestRate ? parseFloat(formInterestRate) : 0,
        minimumPayment: formMinPayment ? parseFloat(formMinPayment) : 0,
        dueDay: formDueDay ? parseInt(formDueDay) : null,
        startDate: formStartDate,
        endDate: formEndDate || null,
        currency: formCurrency,
        notes: formNotes || null,
      });
      toast.success("Debt updated");
      setEditDialogOpen(false);
      setEditingDebt(null);
      resetForm();
      fetchData();
    } catch {
      toast.error("Failed to update debt");
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payDebtId) return;
    try {
      const result = await makePayment({
        debtId: payDebtId,
        amount: parseFloat(payAmount),
      });
      if (result.isPaidOff) {
        toast.success("Debt fully paid off! Congratulations!");
      } else {
        toast.success("Payment recorded");
      }
      setPayDialogOpen(false);
      setPayDebtId(null);
      setPayAmount("");
      fetchData();
    } catch {
      toast.error("Failed to record payment");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDebt(id);
      setDebts((prev) => prev.filter((d) => d.id !== id));
      toast.success("Debt deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  const openPayDialog = (debtId: string) => {
    setPayDebtId(debtId);
    setPayAmount("");
    setPayDialogOpen(true);
  };

  // Stats (converted to user currency for aggregates)
  const activeDebts = debts.filter((d) => !d.isPaidOff);
  const paidOffDebts = debts.filter((d) => d.isPaidOff);
  const toUser = (amount: number, from: string) => convertCurrency(amount, from, userCurrency, rates);
  const totalOwed = activeDebts.reduce((sum, d) => sum + toUser(d.remainingAmount, d.currency), 0);
  const totalOriginal = activeDebts.reduce((sum, d) => sum + toUser(d.originalAmount, d.currency), 0);
  const totalPaid = totalOriginal - totalOwed;
  const overallProgress = totalOriginal > 0 ? (totalPaid / totalOriginal) * 100 : 0;
  const totalMinPayment = activeDebts.reduce((sum, d) => sum + toUser(d.minimumPayment, d.currency), 0);
  const hasMultipleCurrencies = new Set(activeDebts.map((d) => d.currency)).size > 1;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
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
          <h1 className="text-2xl font-bold">Debts & Loans</h1>
          <p className="text-muted-foreground text-sm">Track and pay off what you owe</p>
        </div>
        {!isPartnerView && <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger
            render={
              <Button>
                <Plus className="w-4 h-4 mr-2" /> Add Debt
              </Button>
            }
          />
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Debt</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" required value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Car Loan, Credit Card" />
              </div>

              {/* Type */}
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={formType} onValueChange={(v) => setFormType(v || "PERSONAL_LOAN")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEBT_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <span className="flex items-center gap-2">
                          <opt.icon className="w-4 h-4" style={{ color: DEBT_TYPE_COLORS[opt.value] }} />
                          {opt.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Lender */}
              <div className="space-y-2">
                <Label htmlFor="lender">Lender (optional)</Label>
                <Input id="lender" value={formLender} onChange={(e) => setFormLender(e.target.value)} placeholder="e.g. CIMB Bank, Maybank" />
              </div>

              {/* Linked Account */}
              {accounts.length > 0 && (
                <div className="space-y-2">
                  <Label>Linked Account (optional)</Label>
                  <Select value={formAccountId} onValueChange={(v) => setFormAccountId(v || "")}>
                    <SelectTrigger>
                      <SelectValue>{(value: string) => value === "none" ? "No linked account" : accounts.find((a) => a.id === value)?.name || "Link to a credit card or loan account"}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No linked account</SelectItem>
                      {accounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          <span className="flex items-center gap-2">
                            <CreditCard className="w-3.5 h-3.5" style={{ color: acc.color }} />
                            {acc.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Link to see repayment day and credit limit from your account</p>
                </div>
              )}

              {/* Original Amount */}
              <div className="space-y-2">
                <Label htmlFor="originalAmount">Original Loan Amount</Label>
                <Input
                  id="originalAmount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={formOriginalAmount}
                  onChange={(e) => {
                    setFormOriginalAmount(e.target.value);
                    // Default remaining to original if not set
                    if (!formRemainingAmount) setFormRemainingAmount(e.target.value);
                  }}
                  placeholder="0.00"
                />
              </div>

              {/* Remaining Amount */}
              <div className="space-y-2">
                <Label htmlFor="remainingAmount">Remaining Balance</Label>
                <Input
                  id="remainingAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formRemainingAmount}
                  onChange={(e) => setFormRemainingAmount(e.target.value)}
                  placeholder="Same as original if empty"
                />
              </div>

              {/* Interest Rate & Min Payment */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="interestRate">Interest Rate (%)</Label>
                  <Input id="interestRate" type="number" step="0.01" min="0" max="100" value={formInterestRate} onChange={(e) => setFormInterestRate(e.target.value)} placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minPayment">Min. Monthly Payment</Label>
                  <Input id="minPayment" type="number" step="0.01" min="0" value={formMinPayment} onChange={(e) => setFormMinPayment(e.target.value)} placeholder="0.00" />
                </div>
              </div>

              {/* Due Day & Currency */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="dueDay">Payment Due Day</Label>
                  <Input id="dueDay" type="number" min="1" max="31" value={formDueDay} onChange={(e) => setFormDueDay(e.target.value)} placeholder="Day of month (1-31)" />
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
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input id="startDate" type="date" required value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">Expected Payoff Date</Label>
                  <Input id="endDate" type="date" value={formEndDate} onChange={(e) => setFormEndDate(e.target.value)} />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Input id="notes" value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Any extra details" />
              </div>

              <Button type="submit" className="w-full">
                Add Debt
              </Button>
            </form>
          </DialogContent>
        </Dialog>}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Owed</p>
                <p className="text-2xl font-bold">{formatCurrency(totalOwed)}</p>
                {hasMultipleCurrencies && <p className="text-xs text-muted-foreground">Converted to {userCurrency}</p>}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <BadgeCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Paid</p>
                <p className="text-2xl font-bold">{formatCurrency(totalPaid)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Banknote className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Monthly Payments</p>
                <p className="text-2xl font-bold">{formatCurrency(totalMinPayment)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Percent className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Overall Progress</p>
                <p className="text-2xl font-bold">{overallProgress.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Debt Dialog */}
      {!isPartnerView && <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) {
            setEditingDebt(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Debt</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input id="edit-name" required value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Car Loan, Credit Card" />
            </div>

            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={formType} onValueChange={(v) => setFormType(v || "PERSONAL_LOAN")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEBT_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="flex items-center gap-2">
                        <opt.icon className="w-4 h-4" style={{ color: DEBT_TYPE_COLORS[opt.value] }} />
                        {opt.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-lender">Lender (optional)</Label>
              <Input id="edit-lender" value={formLender} onChange={(e) => setFormLender(e.target.value)} placeholder="e.g. CIMB Bank, Maybank" />
            </div>

            {accounts.length > 0 && (
              <div className="space-y-2">
                <Label>Linked Account (optional)</Label>
                <Select value={formAccountId} onValueChange={(v) => setFormAccountId(v || "")}>
                  <SelectTrigger>
                    <SelectValue>{(value: string) => value === "none" ? "No linked account" : accounts.find((a) => a.id === value)?.name || "Link to a credit card or loan account"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No linked account</SelectItem>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        <span className="flex items-center gap-2">
                          <CreditCard className="w-3.5 h-3.5" style={{ color: acc.color }} />
                          {acc.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="edit-originalAmount">Original Loan Amount</Label>
              <Input id="edit-originalAmount" type="number" step="0.01" min="0.01" required value={formOriginalAmount} onChange={(e) => setFormOriginalAmount(e.target.value)} placeholder="0.00" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-remainingAmount">Remaining Balance</Label>
              <Input id="edit-remainingAmount" type="number" step="0.01" min="0" value={formRemainingAmount} onChange={(e) => setFormRemainingAmount(e.target.value)} placeholder="Same as original if empty" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-interestRate">Interest Rate (%)</Label>
                <Input id="edit-interestRate" type="number" step="0.01" min="0" max="100" value={formInterestRate} onChange={(e) => setFormInterestRate(e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-minPayment">Min. Monthly Payment</Label>
                <Input id="edit-minPayment" type="number" step="0.01" min="0" value={formMinPayment} onChange={(e) => setFormMinPayment(e.target.value)} placeholder="0.00" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-dueDay">Payment Due Day</Label>
                <Input id="edit-dueDay" type="number" min="1" max="31" value={formDueDay} onChange={(e) => setFormDueDay(e.target.value)} placeholder="Day of month (1-31)" />
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
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-startDate">Start Date</Label>
                <Input id="edit-startDate" type="date" required value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-endDate">Expected Payoff Date</Label>
                <Input id="edit-endDate" type="date" value={formEndDate} onChange={(e) => setFormEndDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notes (optional)</Label>
              <Input id="edit-notes" value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Any extra details" />
            </div>

            <Button type="submit" className="w-full">
              Save Changes
            </Button>
          </form>
        </DialogContent>
      </Dialog>}

      {/* Payment dialog */}
      <Dialog
        open={payDialogOpen}
        onOpenChange={(open) => {
          setPayDialogOpen(open);
          if (!open) {
            setPayDebtId(null);
            setPayAmount("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Make a Payment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePayment} className="space-y-4">
            {payDebtId &&
              (() => {
                const debt = debts.find((d) => d.id === payDebtId);
                if (!debt) return null;
                const fmtDebt = currencyFormatter(debt.currency);
                return (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="font-medium">{debt.name}</p>
                    <p className="text-sm text-muted-foreground">Remaining: {fmtDebt(debt.remainingAmount)}</p>
                  </div>
                );
              })()}
            <div className="space-y-2">
              <Label htmlFor="payAmount">Payment Amount</Label>
              <Input id="payAmount" type="number" step="0.01" min="0.01" required value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="0.00" />
            </div>
            <Button type="submit" className="w-full">
              Record Payment
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Active Debts */}
      {debts.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Landmark className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-1">No debts tracked yet</h3>
            <p className="text-muted-foreground text-sm mb-4">Add your loans, credit cards, and other debts to track your payoff progress</p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Add Your First Debt
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Active debts */}
          {activeDebts.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-red-500" />
                Active Debts
                <Badge variant="secondary">{activeDebts.length}</Badge>
              </h2>
              {activeDebts.map((debt) => {
                const DebtIcon = getDebtIcon(debt.type);
                const color = DEBT_TYPE_COLORS[debt.type] || debt.color;
                const paidAmount = debt.originalAmount - debt.remainingAmount;
                const progress = debt.originalAmount > 0 ? (paidAmount / debt.originalAmount) * 100 : 0;
                const fmtDebt = currencyFormatter(debt.currency);

                return (
                  <Card key={debt.id}>
                    <CardContent className="py-4">
                      <div className="flex items-start gap-4">
                        {/* Icon */}
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: `${color}20` }}>
                          <DebtIcon className="w-5 h-5" style={{ color }} />
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-medium">{debt.name}</span>
                            <Badge variant="secondary" className="text-xs" style={{ backgroundColor: `${color}15`, color }}>
                              {getDebtTypeLabel(debt.type)}
                            </Badge>
                            {debt.interestRate > 0 && (
                              <Badge variant="outline" className="text-xs">
                                {debt.interestRate}% APR
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-sm text-muted-foreground mb-2">
                            {debt.lender && <span>{debt.lender}</span>}
                            {debt.lender && debt.dueDay && <span>·</span>}
                            {debt.dueDay && (
                              <span className="flex items-center gap-1">
                                <CalendarDays className="w-3.5 h-3.5" />
                                Due day {debt.dueDay}
                              </span>
                            )}
                            {debt.minimumPayment > 0 && (
                              <>
                                <span>·</span>
                                <span>Min: {fmtDebt(debt.minimumPayment)}/mo</span>
                              </>
                            )}
                          </div>

                          {/* Linked account info */}
                          {debt.accountName && (
                            <div className="flex items-center gap-2 text-xs mb-2 px-2 py-1 rounded bg-muted/50 w-fit">
                              <CreditCard className="w-3 h-3" style={{ color: debt.accountColor || undefined }} />
                              <span className="font-medium">{debt.accountName}</span>
                              {debt.accountCreditLimit != null && <span>· Limit: {fmtDebt(debt.accountCreditLimit)}</span>}
                              {debt.accountRepaymentDay != null && <span>· Repayment: Day {debt.accountRepaymentDay}</span>}
                            </div>
                          )}

                          {/* Progress bar */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{fmtDebt(paidAmount)} paid</span>
                              <span>{fmtDebt(debt.remainingAmount)} remaining</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                            <div className="text-xs text-muted-foreground text-right">
                              {progress.toFixed(1)}% of {fmtDebt(debt.originalAmount)}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        {!isPartnerView && <div className="flex items-center gap-2 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-900/20"
                            onClick={() => openPayDialog(debt.id)}
                          >
                            <Banknote className="w-4 h-4 mr-1" />
                            Pay
                          </Button>
                          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary" onClick={() => handleEdit(debt)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => handleDelete(debt.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Paid off debts */}
          {paidOffDebts.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <BadgeCheck className="w-5 h-5 text-emerald-500" />
                Paid Off
                <Badge variant="secondary">{paidOffDebts.length}</Badge>
              </h2>
              {paidOffDebts.map((debt) => {
                const DebtIcon = getDebtIcon(debt.type);
                const color = DEBT_TYPE_COLORS[debt.type] || debt.color;
                const fmtDebt = currencyFormatter(debt.currency);

                return (
                  <Card key={debt.id} className="opacity-60">
                    <CardContent className="py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}20` }}>
                          <DebtIcon className="w-5 h-5" style={{ color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium line-through">{debt.name}</span>
                            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">Paid Off</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {fmtDebt(debt.originalAmount)} · {getDebtTypeLabel(debt.type)}
                            {debt.lender && ` · ${debt.lender}`}
                          </p>
                        </div>
                        {!isPartnerView && <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => handleDelete(debt.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
