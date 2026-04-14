"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Repeat, ExternalLink, CreditCard } from "lucide-react";
import { usePartnerView } from "@/hooks/use-partner-view";
import { getSubscriptions, createSubscription, toggleSubscription, deleteSubscription } from "@/actions/subscriptions";
import { getCategories } from "@/actions/categories";
import { currencyFormatter } from "@/lib/format";
import { SUPPORTED_CURRENCIES } from "@/lib/constants";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

interface Subscription {
  id: string;
  name: string;
  amount: number;
  currency: string;
  frequency: string;
  nextBillingDate: string;
  category: { id: string; name: string; color: string } | null;
  url: string | null;
  icon: string;
  color: string;
  isActive: boolean;
  notes: string | null;
}

const FREQ_LABELS: Record<string, string> = { DAILY: "Daily", WEEKLY: "Weekly", MONTHLY: "Monthly", YEARLY: "Yearly" };

export function SubscriptionsClient() {
  const { data: session } = useSession();
  const { isPartnerView } = usePartnerView();
  const userCurrency = session?.user?.currency || "USD";
  const formatCurrency = currencyFormatter(userCurrency);

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string; type: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(userCurrency);
  const [frequency, setFrequency] = useState("MONTHLY");
  const [nextBillingDate, setNextBillingDate] = useState(new Date().toISOString().split("T")[0]);
  const [categoryId, setCategoryId] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");

  const fetchData = async () => {
    try {
      const [subs, cats] = await Promise.all([getSubscriptions(), getCategories()]);
      setSubscriptions(subs);
      setCategories(cats);
    } catch {
      toast.error("Failed to load subscriptions");
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
      await createSubscription({
        name,
        amount: parseFloat(amount),
        currency,
        frequency: frequency as "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY",
        nextBillingDate,
        categoryId: categoryId || null,
        url: url || null,
        notes: notes || null,
      });
      toast.success("Subscription added");
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch {
      toast.error("Failed to add subscription");
    }
  };

  const resetForm = () => {
    setName("");
    setAmount("");
    setCurrency(userCurrency);
    setFrequency("MONTHLY");
    setNextBillingDate(new Date().toISOString().split("T")[0]);
    setCategoryId("");
    setUrl("");
    setNotes("");
  };

  const handleToggle = async (id: string) => {
    await toggleSubscription(id);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await deleteSubscription(id);
    toast.success("Subscription deleted");
    fetchData();
  };

  const activeSubs = subscriptions.filter((s) => s.isActive);
  const inactiveSubs = subscriptions.filter((s) => !s.isActive);

  const monthlyTotal = activeSubs.reduce((sum, s) => {
    const amt = s.amount;
    switch (s.frequency) {
      case "DAILY":
        return sum + amt * 30;
      case "WEEKLY":
        return sum + amt * 4.33;
      case "MONTHLY":
        return sum + amt;
      case "YEARLY":
        return sum + amt / 12;
      default:
        return sum + amt;
    }
  }, 0);

  const yearlyTotal = monthlyTotal * 12;

  const expenseCategories = categories.filter((c) => c.type === "EXPENSE");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Subscriptions</h1>
          <p className="text-muted-foreground">Track your recurring subscriptions and services</p>
        </div>
        {!isPartnerView && <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="w-4 h-4 mr-2" /> Add Subscription
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Subscription</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input placeholder="e.g., Netflix, Spotify" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input type="number" step="0.01" min="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select value={currency} onValueChange={(v) => v && setCurrency(v)}>
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
                  <Label>Frequency</Label>
                  <Select value={frequency} onValueChange={(v) => v && setFrequency(v)}>
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
                <div className="space-y-2">
                  <Label>Next Billing Date</Label>
                  <Input type="date" value={nextBillingDate} onChange={(e) => setNextBillingDate(e.target.value)} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Category (optional)</Label>
                <Select value={categoryId} onValueChange={(v) => v && setCategoryId(v)}>
                  <SelectTrigger>
                    <SelectValue>{(value: string) => expenseCategories.find((c) => c.id === value)?.name || "Select..."}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>URL (optional)</Label>
                <Input placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Input placeholder="Add a note..." value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <Button type="submit" className="w-full">
                Add Subscription
              </Button>
            </form>
          </DialogContent>
        </Dialog>}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Active Subscriptions</p>
            <p className="text-2xl font-bold">{activeSubs.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Monthly Cost</p>
            <p className="text-2xl font-bold text-amber-500">{formatCurrency(monthlyTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Yearly Cost</p>
            <p className="text-2xl font-bold text-red-500">{formatCurrency(yearlyTotal)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Subscriptions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active Subscriptions</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Loading...</p>
          ) : activeSubs.length === 0 ? (
            <div className="text-center py-8">
              <Repeat className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No active subscriptions</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeSubs.map((sub) => (
                <div key={sub.id} className="flex items-center gap-3 py-3 border-b last:border-0">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: sub.color + "20" }}>
                    <CreditCard className="w-5 h-5" style={{ color: sub.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{sub.name}</p>
                      {sub.url && (
                        <a href={sub.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-xs">
                        {FREQ_LABELS[sub.frequency]}
                      </Badge>
                      {sub.category && (
                        <Badge variant="secondary" className="text-xs" style={{ backgroundColor: sub.category.color + "20", color: sub.category.color }}>
                          {sub.category.name}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">Next: {new Date(sub.nextBillingDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    </div>
                  </div>
                  <p className="text-sm font-bold tabular-nums">{currencyFormatter(sub.currency)(sub.amount)}</p>
                  {!isPartnerView && <Switch checked={sub.isActive} onCheckedChange={() => handleToggle(sub.id)} />}
                  {!isPartnerView && <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-500" onClick={() => handleDelete(sub.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>}
                </div>
              ))}
            </div>
          )}

        </CardContent>
      </Card>

      {/* Inactive Subscriptions */}
      {inactiveSubs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-muted-foreground">Inactive Subscriptions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {inactiveSubs.map((sub) => (
                <div key={sub.id} className="flex items-center gap-3 py-3 border-b last:border-0 opacity-60">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-muted">
                    <CreditCard className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{sub.name}</p>
                    <Badge variant="outline" className="text-xs">
                      {FREQ_LABELS[sub.frequency]}
                    </Badge>
                  </div>
                  <p className="text-sm font-bold tabular-nums">{currencyFormatter(sub.currency)(sub.amount)}</p>
                  {!isPartnerView && <Switch checked={sub.isActive} onCheckedChange={() => handleToggle(sub.id)} />}
                  {!isPartnerView && <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-500" onClick={() => handleDelete(sub.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
