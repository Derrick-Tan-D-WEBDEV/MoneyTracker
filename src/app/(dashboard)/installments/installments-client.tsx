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
import { Plus, CreditCard, ShoppingBag, ArrowLeftRight, Trash2, BadgeCheck, CalendarDays, Percent, Banknote, Store, CheckCircle2 } from "lucide-react";
import { usePartnerView } from "@/hooks/use-partner-view";
import { getInstallments, createInstallment, makeInstallmentPayment, deleteInstallment } from "@/actions/installments";
import { getAccounts } from "@/actions/accounts";
import { getExchangeRates as fetchExchangeRates } from "@/actions/exchange-rates";
import { convertCurrency } from "@/lib/exchange-rates";
import { SUPPORTED_CURRENCIES } from "@/lib/constants";
import { currencyFormatter } from "@/lib/format";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

interface Installment {
  id: string;
  name: string;
  type: string;
  merchant: string | null;
  totalAmount: number;
  monthlyPayment: number;
  totalMonths: number;
  paidMonths: number;
  remainingMonths: number;
  remainingAmount: number;
  paidAmount: number;
  interestRate: number;
  startDate: string;
  currency: string;
  isCompleted: boolean;
  notes: string | null;
  account: { id: string; name: string; type: string; color: string; creditLimit: unknown; repaymentDay: number | null };
  createdAt: string;
}

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
  color: string;
}

export function InstallmentsClient() {
  const { data: session } = useSession();
  const { isPartnerView } = usePartnerView();
  const userCurrency = session?.user?.currency || "MYR";
  const formatCurrency = currencyFormatter(userCurrency);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payInstallmentId, setPayInstallmentId] = useState<string | null>(null);
  const [payMonths, setPayMonths] = useState("1");

  // Form state
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("PURCHASE");
  const [formMerchant, setFormMerchant] = useState("");
  const [formAccountId, setFormAccountId] = useState("");
  const [formTotalAmount, setFormTotalAmount] = useState("");
  const [formTotalMonths, setFormTotalMonths] = useState("");
  const [formPaidMonths, setFormPaidMonths] = useState("");
  const [formInterestRate, setFormInterestRate] = useState("");
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [formCurrency, setFormCurrency] = useState(userCurrency);
  const [formNotes, setFormNotes] = useState("");

  const creditCardAccounts = accounts.filter((a) => a.type === "CREDIT_CARD");

  const fetchData = async () => {
    try {
      const [data, accts, rateData] = await Promise.all([getInstallments(), getAccounts(), fetchExchangeRates(userCurrency)]);
      setInstallments(data);
      setAccounts(accts);
      setRates(rateData);
    } catch {
      toast.error("Failed to load installments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetForm = () => {
    setFormName("");
    setFormType("PURCHASE");
    setFormMerchant("");
    setFormAccountId("");
    setFormTotalAmount("");
    setFormTotalMonths("");
    setFormPaidMonths("");
    setFormInterestRate("");
    setFormStartDate(new Date().toISOString().split("T")[0]);
    setFormCurrency(userCurrency);
    setFormNotes("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAccountId) {
      toast.error("Please select a credit card");
      return;
    }
    try {
      await createInstallment({
        accountId: formAccountId,
        name: formName,
        type: formType as "PURCHASE" | "BALANCE_TRANSFER",
        merchant: formMerchant || null,
        totalAmount: parseFloat(formTotalAmount),
        totalMonths: parseInt(formTotalMonths),
        paidMonths: formPaidMonths ? parseInt(formPaidMonths) : 0,
        interestRate: formInterestRate ? parseFloat(formInterestRate) : 0,
        startDate: formStartDate,
        currency: formCurrency,
        notes: formNotes || null,
      });
      toast.success("Installment added");
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch {
      toast.error("Failed to add installment");
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payInstallmentId) return;
    try {
      const result = await makeInstallmentPayment({
        installmentId: payInstallmentId,
        months: parseInt(payMonths),
      });
      if (result.isCompleted) {
        toast.success("Installment fully paid off!");
      } else {
        toast.success(`Marked ${payMonths} month(s) as paid`);
      }
      setPayDialogOpen(false);
      setPayInstallmentId(null);
      setPayMonths("1");
      fetchData();
    } catch {
      toast.error("Failed to record payment");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteInstallment(id);
      setInstallments((prev) => prev.filter((i) => i.id !== id));
      toast.success("Installment deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  const openPayDialog = (id: string) => {
    setPayInstallmentId(id);
    setPayMonths("1");
    setPayDialogOpen(true);
  };

  // Stats (converted to user currency)
  const toUser = (amount: number, from: string) => convertCurrency(amount, from, userCurrency, rates);
  const activeInstallments = installments.filter((i) => !i.isCompleted);
  const completedInstallments = installments.filter((i) => i.isCompleted);
  const totalMonthlyPayments = activeInstallments.reduce((sum, i) => sum + toUser(i.monthlyPayment, i.currency), 0);
  const totalRemaining = activeInstallments.reduce((sum, i) => sum + toUser(i.remainingAmount, i.currency), 0);
  const totalPaid = installments.reduce((sum, i) => sum + toUser(i.paidAmount, i.currency), 0);
  const hasMultipleCurrencies = new Set(activeInstallments.map((i) => i.currency)).size > 1;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-40" />
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
          <h1 className="text-2xl font-bold">Installments</h1>
          <p className="text-muted-foreground text-sm">Track credit card installment plans & balance transfers</p>
        </div>
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
                  <Plus className="w-4 h-4 mr-2" /> Add Installment
                </Button>
              }
            />
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Installment Plan</DialogTitle>
              </DialogHeader>
              {creditCardAccounts.length === 0 ? (
                <div className="text-center py-6">
                  <CreditCard className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">No credit card accounts found.</p>
                  <p className="text-xs text-muted-foreground mt-1">Add a credit card account first to create installments.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Name */}
                  <div className="space-y-2">
                    <Label>Item / Description</Label>
                    <Input required value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. iPhone 16 Pro, Samsung TV" />
                  </div>

                  {/* Type & Credit Card */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select value={formType} onValueChange={(v) => v && setFormType(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PURCHASE">
                            <span className="flex items-center gap-2">
                              <ShoppingBag className="w-4 h-4" /> Purchase
                            </span>
                          </SelectItem>
                          <SelectItem value="BALANCE_TRANSFER">
                            <span className="flex items-center gap-2">
                              <ArrowLeftRight className="w-4 h-4" /> Balance Transfer
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Credit Card</Label>
                      <Select value={formAccountId} onValueChange={(v) => v && setFormAccountId(v)}>
                        <SelectTrigger>
                          <SelectValue>{(value: string) => creditCardAccounts.find((a) => a.id === value)?.name || "Select card"}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {creditCardAccounts.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Merchant */}
                  <div className="space-y-2">
                    <Label>Merchant / Vendor (optional)</Label>
                    <Input value={formMerchant} onChange={(e) => setFormMerchant(e.target.value)} placeholder="e.g. Apple Store, Harvey Norman" />
                  </div>

                  {/* Amount & Months */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Total Amount</Label>
                      <Input type="number" step="0.01" min="0.01" required value={formTotalAmount} onChange={(e) => setFormTotalAmount(e.target.value)} placeholder="0.00" />
                    </div>
                    <div className="space-y-2">
                      <Label>Number of Months</Label>
                      <Input type="number" min="1" max="60" required value={formTotalMonths} onChange={(e) => setFormTotalMonths(e.target.value)} placeholder="12" />
                    </div>
                  </div>

                  {/* Monthly preview */}
                  {formTotalAmount && formTotalMonths && parseInt(formTotalMonths) > 0 && (
                    <div className="p-3 rounded-lg bg-muted/50 text-sm">
                      <span className="text-muted-foreground">Monthly payment: </span>
                      <span className="font-semibold">{currencyFormatter(formCurrency)(parseFloat(formTotalAmount) / parseInt(formTotalMonths))}</span>
                      <span className="text-muted-foreground"> / month</span>
                    </div>
                  )}

                  {/* Months Already Paid (for starting halfway) */}
                  <div className="space-y-2">
                    <Label>Months Already Paid</Label>
                    <Input
                      type="number"
                      min="0"
                      max={formTotalMonths ? parseInt(formTotalMonths) : 999}
                      value={formPaidMonths}
                      onChange={(e) => setFormPaidMonths(e.target.value)}
                      placeholder="0 for new plans"
                    />
                    <p className="text-xs text-muted-foreground">Set this if the installment is already partway through</p>
                  </div>

                  {/* Interest Rate & Currency */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Interest / Fee Rate (%)</Label>
                      <Input type="number" step="0.01" min="0" max="100" value={formInterestRate} onChange={(e) => setFormInterestRate(e.target.value)} placeholder="0 for 0% plans" />
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

                  {/* Start Date */}
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input type="date" required value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} />
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    <Label>Notes (optional)</Label>
                    <Input value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Any extra details" />
                  </div>

                  <Button type="submit" className="w-full">
                    Add Installment
                  </Button>
                </form>
              )}
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                <CreditCard className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Remaining</p>
                <p className="text-2xl font-bold">{formatCurrency(totalRemaining)}</p>
                {hasMultipleCurrencies && <p className="text-xs text-muted-foreground">Converted to {userCurrency}</p>}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Banknote className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Monthly Total</p>
                <p className="text-2xl font-bold">{formatCurrency(totalMonthlyPayments)}</p>
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
                <CalendarDays className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Plans</p>
                <p className="text-2xl font-bold">{activeInstallments.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment dialog */}
      <Dialog
        open={payDialogOpen}
        onOpenChange={(open) => {
          setPayDialogOpen(open);
          if (!open) {
            setPayInstallmentId(null);
            setPayMonths("1");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePayment} className="space-y-4">
            {payInstallmentId &&
              (() => {
                const inst = installments.find((i) => i.id === payInstallmentId);
                if (!inst) return null;
                const fmtInst = currencyFormatter(inst.currency);
                return (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="font-medium">{inst.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {fmtInst(inst.monthlyPayment)}/mo · {inst.remainingMonths} month{inst.remainingMonths !== 1 ? "s" : ""} remaining
                    </p>
                  </div>
                );
              })()}
            <div className="space-y-2">
              <Label>Months to mark as paid</Label>
              <Input
                type="number"
                min="1"
                max={payInstallmentId ? installments.find((i) => i.id === payInstallmentId)?.remainingMonths || 1 : 1}
                required
                value={payMonths}
                onChange={(e) => setPayMonths(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full">
              Record Payment
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Empty state */}
      {installments.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <CreditCard className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-1">No installments yet</h3>
            <p className="text-muted-foreground text-sm mb-4">Track your credit card installment plans and balance transfers</p>
            {creditCardAccounts.length > 0 ? (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" /> Add Your First Installment
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">Add a credit card account first to get started</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Active installments */}
          {activeInstallments.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-amber-500" />
                Active Installments
                <Badge variant="secondary">{activeInstallments.length}</Badge>
              </h2>
              {activeInstallments.map((inst) => {
                const progress = inst.totalMonths > 0 ? (inst.paidMonths / inst.totalMonths) * 100 : 0;
                const fmtInst = currencyFormatter(inst.currency);
                const TypeIcon = inst.type === "BALANCE_TRANSFER" ? ArrowLeftRight : ShoppingBag;

                return (
                  <Card key={inst.id}>
                    <CardContent className="py-4">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: `${inst.account.color}20` }}>
                          <TypeIcon className="w-5 h-5" style={{ color: inst.account.color }} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-medium">{inst.name}</span>
                            <Badge variant="secondary" className="text-xs">
                              {inst.type === "BALANCE_TRANSFER" ? "Balance Transfer" : "Purchase"}
                            </Badge>
                            {inst.interestRate > 0 && (
                              <Badge variant="outline" className="text-xs">
                                <Percent className="w-3 h-3 mr-0.5" />
                                {inst.interestRate}%
                              </Badge>
                            )}
                            {inst.interestRate === 0 && (
                              <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-200 dark:border-emerald-800">
                                0% Interest
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-sm text-muted-foreground mb-2 flex-wrap">
                            <span className="flex items-center gap-1">
                              <CreditCard className="w-3.5 h-3.5" />
                              {inst.account.name}
                            </span>
                            {inst.account.repaymentDay && (
                              <>
                                <span>·</span>
                                <span>Repayment day {inst.account.repaymentDay}</span>
                              </>
                            )}
                            {inst.merchant && (
                              <>
                                <span>·</span>
                                <span className="flex items-center gap-1">
                                  <Store className="w-3.5 h-3.5" />
                                  {inst.merchant}
                                </span>
                              </>
                            )}
                            <span>·</span>
                            <span>{fmtInst(inst.monthlyPayment)}/mo</span>
                          </div>

                          {/* Progress */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>
                                {inst.paidMonths} of {inst.totalMonths} months paid
                              </span>
                              <span>{fmtInst(inst.remainingAmount)} remaining</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                            <div className="text-xs text-muted-foreground text-right">
                              {progress.toFixed(0)}% of {fmtInst(inst.totalAmount)}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        {!isPartnerView && (
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-900/20"
                              onClick={() => openPayDialog(inst.id)}
                            >
                              <Banknote className="w-4 h-4 mr-1" />
                              Pay
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-500" onClick={() => handleDelete(inst.id)}>
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

          {/* Completed installments */}
          {completedInstallments.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                Completed
                <Badge variant="secondary">{completedInstallments.length}</Badge>
              </h2>
              {completedInstallments.map((inst) => {
                const fmtInst = currencyFormatter(inst.currency);
                return (
                  <Card key={inst.id} className="opacity-70">
                    <CardContent className="py-3">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-sm">{inst.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">{inst.account.name}</span>
                          {inst.merchant && <span className="text-xs text-muted-foreground ml-1">· {inst.merchant}</span>}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {fmtInst(inst.totalAmount)} · {inst.totalMonths} months
                        </span>
                        {!isPartnerView && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-500" onClick={() => handleDelete(inst.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
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
