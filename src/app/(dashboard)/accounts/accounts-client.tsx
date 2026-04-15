"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Plus, Wallet, CreditCard, Landmark, PiggyBank, Banknote, TrendingUp, Bitcoin, Pencil, ArrowRightLeft } from "lucide-react";
import { usePartnerView } from "@/hooks/use-partner-view";
import { getAccounts, createAccount, updateAccount } from "@/actions/accounts";
import { getExchangeRates } from "@/actions/exchange-rates";
import { convertCurrency, type RateMap } from "@/lib/exchange-rates";
import { toast } from "sonner";
import { currencyFormatter } from "@/lib/format";
import { useSession } from "next-auth/react";
import { SUPPORTED_CURRENCIES } from "@/lib/constants";

const ACCOUNT_TYPES = [
  { value: "CHECKING", label: "Checking", icon: Landmark },
  { value: "SAVINGS", label: "Savings", icon: PiggyBank },
  { value: "CREDIT_CARD", label: "Credit Card", icon: CreditCard },
  { value: "CASH", label: "Cash", icon: Banknote },
  { value: "INVESTMENT", label: "Investment", icon: TrendingUp },
  { value: "CRYPTO", label: "Crypto", icon: Bitcoin },
  { value: "LOAN", label: "Loan", icon: Wallet },
];

const ACCOUNT_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#F97316"];

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  reservedAmount: number;
  currency: string;
  color: string;
  icon: string;
  creditLimit: number | null;
  repaymentDay: number | null;
}

function getAccountIcon(type: string) {
  const found = ACCOUNT_TYPES.find((t) => t.value === type);
  return found?.icon || Wallet;
}

export function AccountsClient() {
  const { data: session } = useSession();
  const { isPartnerView } = usePartnerView();
  const userCurrency = session?.user?.currency || "MYR";
  const formatUserCurrency = currencyFormatter(userCurrency);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [rates, setRates] = useState<RateMap>({});

  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("CHECKING");
  const [formBalance, setFormBalance] = useState("0");
  const [formColor, setFormColor] = useState("#3B82F6");
  const [formCurrency, setFormCurrency] = useState(userCurrency);
  const [formCreditLimit, setFormCreditLimit] = useState("");
  const [formRepaymentDay, setFormRepaymentDay] = useState("");
  const [formReservedAmount, setFormReservedAmount] = useState("0");

  const fetchAccounts = async () => {
    try {
      const [data, rateData] = await Promise.all([getAccounts(), getExchangeRates(userCurrency)]);
      setAccounts(data);
      setRates(rateData);
    } catch {
      toast.error("Failed to load accounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createAccount({
        name: formName,
        type: formType as "CHECKING" | "SAVINGS" | "CREDIT_CARD" | "CASH" | "INVESTMENT" | "CRYPTO" | "LOAN",
        balance: parseFloat(formBalance),
        reservedAmount: parseFloat(formReservedAmount) || 0,
        currency: formCurrency,
        color: formColor,
        icon: "wallet",
        creditLimit: formCreditLimit ? parseFloat(formCreditLimit) : null,
        repaymentDay: formRepaymentDay ? parseInt(formRepaymentDay) : null,
      });
      toast.success("Account created");
      setDialogOpen(false);
      resetForm();
      fetchAccounts();
    } catch {
      toast.error("Failed to create account");
    }
  };

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setFormName(account.name);
    setFormType(account.type);
    setFormBalance(String(account.balance));
    setFormColor(account.color);
    setFormCurrency(account.currency);
    setFormCreditLimit(account.creditLimit ? String(account.creditLimit) : "");
    setFormRepaymentDay(account.repaymentDay ? String(account.repaymentDay) : "");
    setFormReservedAmount(String(account.reservedAmount || 0));
    setEditDialogOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;
    try {
      await updateAccount(editingAccount.id, {
        name: formName,
        type: formType as "CHECKING" | "SAVINGS" | "CREDIT_CARD" | "CASH" | "INVESTMENT" | "CRYPTO" | "LOAN",
        balance: parseFloat(formBalance),
        reservedAmount: parseFloat(formReservedAmount) || 0,
        currency: formCurrency,
        color: formColor,
        icon: "wallet",
        creditLimit: formCreditLimit ? parseFloat(formCreditLimit) : null,
        repaymentDay: formRepaymentDay ? parseInt(formRepaymentDay) : null,
      });
      toast.success("Account updated");
      setEditDialogOpen(false);
      setEditingAccount(null);
      resetForm();
      fetchAccounts();
    } catch {
      toast.error("Failed to update account");
    }
  };

  const resetForm = () => {
    setFormName("");
    setFormType("CHECKING");
    setFormBalance("0");
    setFormColor("#3B82F6");
    setFormCurrency(userCurrency);
    setFormCreditLimit("");
    setFormRepaymentDay("");
    setFormReservedAmount("0");
  };

  const totalBalance = accounts.reduce((s, a) => {
    const effectiveBalance = a.balance - (a.reservedAmount || 0);
    const converted = a.currency === userCurrency ? effectiveBalance : rates[a.currency] ? effectiveBalance / rates[a.currency] : effectiveBalance;
    if (a.type === "CREDIT_CARD") {
      // Balance = available credit; liability = creditLimit - balance (used)
      const limit = a.creditLimit != null ? (a.currency === userCurrency ? a.creditLimit : rates[a.currency] ? a.creditLimit / rates[a.currency] : a.creditLimit) : 0;
      return s - (limit - converted);
    }
    return s + converted;
  }, 0);

  const hasMultipleCurrencies = new Set(accounts.map((a) => a.currency)).size > 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Accounts</h1>
          <p className="text-muted-foreground">Manage your financial accounts</p>
        </div>
        {!isPartnerView && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger render={<Button />}>
              <Plus className="w-4 h-4 mr-2" />
              Add Account
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Account</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Account Name</Label>
                  <Input placeholder="e.g., Main Checking" value={formName} onChange={(e) => setFormName(e.target.value)} required />
                </div>

                <div className="space-y-2">
                  <Label>Account Type</Label>
                  <Select value={formType} onValueChange={(v) => v && setFormType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACCOUNT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{formType === "CREDIT_CARD" ? "Available Balance" : "Current Balance"}</Label>
                  <Input type="number" step="0.01" value={formBalance} onChange={(e) => setFormBalance(e.target.value)} required />
                </div>

                {formType !== "CREDIT_CARD" && (
                  <div className="space-y-2">
                    <Label>Reserved / Held Amount</Label>
                    <Input type="number" step="0.01" min="0" placeholder="0" value={formReservedAmount} onChange={(e) => setFormReservedAmount(e.target.value)} />
                    <p className="text-xs text-muted-foreground">Money parked in this account that isn&apos;t yours. Excluded from all statistics.</p>
                  </div>
                )}

                {formType === "CREDIT_CARD" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Credit Limit</Label>
                      <Input type="number" step="0.01" min="0" placeholder="e.g., 10000" value={formCreditLimit} onChange={(e) => setFormCreditLimit(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Repayment Day</Label>
                      <Input type="number" min="1" max="31" placeholder="1-31" value={formRepaymentDay} onChange={(e) => setFormRepaymentDay(e.target.value)} />
                    </div>
                  </div>
                )}

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
                  <Label>Color</Label>
                  <div className="flex gap-2">
                    {ACCOUNT_COLORS.map((color) => (
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
                  Create Account
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Total balance */}
      <Card>
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">Total Balance</p>
          <p className="text-3xl font-bold">{formatUserCurrency(totalBalance)}</p>
          <p className="text-sm text-muted-foreground mt-1">
            Across {accounts.length} account{accounts.length !== 1 ? "s" : ""}
            {hasMultipleCurrencies && (
              <span className="inline-flex items-center gap-1 ml-2">
                <ArrowRightLeft className="w-3 h-3" />
                Converted to {userCurrency}
              </span>
            )}
          </p>
        </CardContent>
      </Card>

      {/* Account cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="pt-4 space-y-3">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-4 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Wallet className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No accounts yet. Add your first account to get started!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((account) => {
            const Icon = getAccountIcon(account.type);
            return (
              <Card key={account.id} className="group relative">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: account.color + "20" }}>
                      <Icon className="w-5 h-5" style={{ color: account.color }} />
                    </div>
                    {!isPartnerView && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-primary"
                        onClick={() => handleEdit(account)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="mt-3">
                    <p className="text-sm font-medium text-foreground">{account.name}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {ACCOUNT_TYPES.find((t) => t.value === account.type)?.label}
                      </Badge>
                      <Badge variant="outline" className="text-xs font-mono">
                        {account.currency}
                      </Badge>
                    </div>
                  </div>
                  {account.type === "CREDIT_CARD" && account.creditLimit != null ? (
                    <>
                      <p className="text-2xl font-bold mt-3 tabular-nums">{currencyFormatter(account.currency)(account.balance)}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>Available of {currencyFormatter(account.currency)(account.creditLimit)}</span>
                        <span>Used: {currencyFormatter(account.currency)(account.creditLimit - account.balance)}</span>
                        {account.repaymentDay != null && <span>Due: Day {account.repaymentDay}</span>}
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-2xl font-bold mt-3 tabular-nums">{currencyFormatter(account.currency)(account.balance)}</p>
                      {account.reservedAmount > 0 && (
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span>Held: {currencyFormatter(account.currency)(account.reservedAmount)}</span>
                          <span>Yours: {currencyFormatter(account.currency)(account.balance - account.reservedAmount)}</span>
                        </div>
                      )}
                      {account.type === "CREDIT_CARD" && account.repaymentDay != null && (
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span>Due: Day {account.repaymentDay}</span>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Account Dialog */}
      {!isPartnerView && (
        <Dialog
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) {
              setEditingAccount(null);
              resetForm();
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Account</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="space-y-2">
                <Label>Account Name</Label>
                <Input placeholder="e.g., Main Checking" value={formName} onChange={(e) => setFormName(e.target.value)} required />
              </div>

              <div className="space-y-2">
                <Label>Account Type</Label>
                <Select value={formType} onValueChange={(v) => v && setFormType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{formType === "CREDIT_CARD" ? "Available Balance" : "Balance"}</Label>
                <Input type="number" step="0.01" value={formBalance} onChange={(e) => setFormBalance(e.target.value)} required />
                {editingAccount && parseFloat(formBalance) !== editingAccount.balance && <p className="text-xs text-muted-foreground">Changing the balance will create an adjustment record</p>}
              </div>

              {formType !== "CREDIT_CARD" && (
                <div className="space-y-2">
                  <Label>Reserved / Held Amount</Label>
                  <Input type="number" step="0.01" min="0" placeholder="0" value={formReservedAmount} onChange={(e) => setFormReservedAmount(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Money parked in this account that isn&apos;t yours. Excluded from all statistics.</p>
                </div>
              )}

              {formType === "CREDIT_CARD" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Credit Limit</Label>
                    <Input type="number" step="0.01" min="0" placeholder="e.g., 10000" value={formCreditLimit} onChange={(e) => setFormCreditLimit(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Repayment Day</Label>
                    <Input type="number" min="1" max="31" placeholder="1-31" value={formRepaymentDay} onChange={(e) => setFormRepaymentDay(e.target.value)} />
                  </div>
                </div>
              )}

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
                <Label>Color</Label>
                <div className="flex gap-2">
                  {ACCOUNT_COLORS.map((color) => (
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
                Save Changes
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
