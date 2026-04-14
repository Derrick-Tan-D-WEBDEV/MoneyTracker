"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, TrendingUp, TrendingDown, Trash2 } from "lucide-react";
import { usePartnerView } from "@/hooks/use-partner-view";
import { getInvestments, createInvestment, deleteInvestment } from "@/actions/investments";
import { getExchangeRates as fetchExchangeRates } from "@/actions/exchange-rates";
import { convertCurrency } from "@/lib/exchange-rates";
import { PortfolioPieChart } from "@/components/charts/portfolio-pie-chart";
import { toast } from "sonner";
import { currencyFormatter } from "@/lib/format";
import { useSession } from "next-auth/react";

const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "MYR", "SGD", "JPY", "AUD", "CAD", "INR", "CNY"];

const INVESTMENT_TYPES = [
  { value: "STOCK", label: "Stock" },
  { value: "CRYPTO", label: "Crypto" },
  { value: "ETF", label: "ETF" },
  { value: "MUTUAL_FUND", label: "Mutual Fund" },
  { value: "BOND", label: "Bond" },
  { value: "REAL_ESTATE", label: "Real Estate" },
  { value: "OTHER", label: "Other" },
];

interface Investment {
  id: string;
  symbol: string | null;
  name: string;
  type: string;
  quantity: number;
  buyPrice: number;
  currentPrice: number;
  totalValue: number;
  totalCost: number;
  pnl: number;
  pnlPercentage: number;
  currency: string;
  buyDate: string;
  notes: string | null;
}

export function InvestmentsClient() {
  const { data: session } = useSession();
  const { isPartnerView } = usePartnerView();
  const userCurrency = session?.user?.currency || "MYR";
  const formatCurrency = currencyFormatter(userCurrency);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [dialogOpen, setDialogOpen] = useState(false);

  const [formName, setFormName] = useState("");
  const [formSymbol, setFormSymbol] = useState("");
  const [formType, setFormType] = useState("STOCK");
  const [formCurrency, setFormCurrency] = useState(userCurrency);
  const [formQuantity, setFormQuantity] = useState("");
  const [formBuyPrice, setFormBuyPrice] = useState("");
  const [formCurrentPrice, setFormCurrentPrice] = useState("");
  const [formBuyDate, setFormBuyDate] = useState(new Date().toISOString().split("T")[0]);

  const fetchData = async () => {
    try {
      const [data, rateData] = await Promise.all([getInvestments(), fetchExchangeRates(userCurrency)]);
      setInvestments(data);
      setRates(rateData);
    } catch {
      toast.error("Failed to load investments");
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
      await createInvestment({
        name: formName,
        symbol: formSymbol || null,
        type: formType as "STOCK" | "CRYPTO" | "MUTUAL_FUND" | "BOND" | "ETF" | "REAL_ESTATE" | "OTHER",
        quantity: parseFloat(formQuantity),
        buyPrice: parseFloat(formBuyPrice),
        currentPrice: parseFloat(formCurrentPrice),
        currency: formCurrency,
        buyDate: formBuyDate,
        accountId: null,
        notes: null,
      });
      toast.success("Investment added");
      setDialogOpen(false);
      setFormName("");
      setFormSymbol("");
      setFormQuantity("");
      setFormBuyPrice("");
      setFormCurrentPrice("");
      setFormCurrency(userCurrency);
      fetchData();
    } catch {
      toast.error("Failed to add investment");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteInvestment(id);
      toast.success("Investment deleted");
      fetchData();
    } catch {
      toast.error("Failed to delete investment");
    }
  };

  const toUser = (amount: number, from: string) => convertCurrency(amount, from, userCurrency, rates);
  const totalValue = investments.reduce((s, i) => s + toUser(i.totalValue, i.currency), 0);
  const totalCost = investments.reduce((s, i) => s + toUser(i.totalCost, i.currency), 0);
  const totalPnl = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;
  const hasMultipleCurrencies = new Set(investments.map((i) => i.currency)).size > 1;

  const byType = investments.reduce(
    (acc, inv) => {
      if (!acc[inv.type]) acc[inv.type] = 0;
      acc[inv.type] += toUser(inv.totalValue, inv.currency);
      return acc;
    },
    {} as Record<string, number>,
  );
  const pieData = Object.entries(byType).map(([type, value]) => ({
    type,
    value,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Investments</h1>
          <p className="text-muted-foreground">Track your investment portfolio</p>
        </div>
        {!isPartnerView && <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="w-4 h-4 mr-2" />
            Add Investment
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Investment</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input placeholder="Apple Inc." value={formName} onChange={(e) => setFormName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Symbol</Label>
                  <Input placeholder="AAPL" value={formSymbol} onChange={(e) => setFormSymbol(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={formType} onValueChange={(v) => v && setFormType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INVESTMENT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input type="number" step="any" min="0.00000001" placeholder="10" value={formQuantity} onChange={(e) => setFormQuantity(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Buy Price</Label>
                  <Input type="number" step="0.01" min="0.01" placeholder="150.00" value={formBuyPrice} onChange={(e) => setFormBuyPrice(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Current Price</Label>
                  <Input type="number" step="0.01" min="0" placeholder="175.00" value={formCurrentPrice} onChange={(e) => setFormCurrentPrice(e.target.value)} required />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Buy Date</Label>
                <Input type="date" value={formBuyDate} onChange={(e) => setFormBuyDate(e.target.value)} required />
              </div>

              <Button type="submit" className="w-full">
                Add Investment
              </Button>
            </form>
          </DialogContent>
        </Dialog>}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Portfolio Value</p>
            <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
            {hasMultipleCurrencies && <p className="text-xs text-muted-foreground">Converted to {userCurrency}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total Invested</p>
            <p className="text-2xl font-bold">{formatCurrency(totalCost)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total P&L</p>
            <p className={`text-2xl font-bold ${totalPnl >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              {totalPnl >= 0 ? "+" : ""}
              {formatCurrency(totalPnl)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Return %</p>
            <p className={`text-2xl font-bold ${totalPnlPct >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              {totalPnlPct >= 0 ? "+" : ""}
              {totalPnlPct.toFixed(2)}%
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Allocation chart */}
        {pieData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Asset Allocation</CardTitle>
            </CardHeader>
            <CardContent>
              <PortfolioPieChart data={pieData} />
            </CardContent>
          </Card>
        )}

        {/* Holdings table */}
        <Card className={pieData.length > 0 ? "lg:col-span-2" : "lg:col-span-3"}>
          <CardHeader>
            <CardTitle className="text-base">Holdings</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3 py-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-5 flex-1" />
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                ))}
              </div>
            ) : investments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No investments yet. Add your first holding!</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Buy Price</TableHead>
                    <TableHead className="text-right">Current</TableHead>
                    <TableHead className="text-right">P&L</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {investments.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{inv.name}</p>
                          {inv.symbol && <p className="text-xs text-muted-foreground">{inv.symbol}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {INVESTMENT_TYPES.find((t) => t.value === inv.type)?.label || inv.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{inv.quantity}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{currencyFormatter(inv.currency)(inv.buyPrice)}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{currencyFormatter(inv.currency)(inv.currentPrice)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {inv.pnl >= 0 ? <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> : <TrendingDown className="w-3.5 h-3.5 text-red-500" />}
                          <span className={`text-sm font-semibold tabular-nums ${inv.pnl >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                            {inv.pnlPercentage >= 0 ? "+" : ""}
                            {inv.pnlPercentage.toFixed(1)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {!isPartnerView && <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-500" onClick={() => handleDelete(inv.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
