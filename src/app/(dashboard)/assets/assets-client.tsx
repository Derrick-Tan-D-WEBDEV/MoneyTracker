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
import { Plus, TrendingUp, TrendingDown, Trash2, Pencil, Home, Car, Gem, Package, DollarSign, MapPin, RefreshCw } from "lucide-react";
import { usePartnerView } from "@/hooks/use-partner-view";
import { getAssets, createAsset, updateAsset, updateAssetValue, markAssetSold, deleteAsset } from "@/actions/assets";
import { getExchangeRates as fetchExchangeRates } from "@/actions/exchange-rates";
import { convertCurrency } from "@/lib/exchange-rates";
import { toast } from "sonner";
import { currencyFormatter } from "@/lib/format";
import { useSession } from "next-auth/react";

const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "MYR", "SGD", "JPY", "AUD", "CAD", "INR", "CNY"];

const ASSET_TYPES = [
  { value: "PROPERTY", label: "Property", icon: Home },
  { value: "VEHICLE", label: "Vehicle", icon: Car },
  { value: "COLLECTIBLE", label: "Collectible", icon: Gem },
  { value: "OTHER", label: "Other", icon: Package },
];

const ASSET_TYPE_COLORS: Record<string, string> = {
  PROPERTY: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  VEHICLE: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  COLLECTIBLE: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  OTHER: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
};

const ASSET_TYPE_ICONS: Record<string, React.ElementType> = {
  PROPERTY: Home,
  VEHICLE: Car,
  COLLECTIBLE: Gem,
  OTHER: Package,
};

interface Asset {
  id: string;
  name: string;
  type: string;
  purchasePrice: number;
  currentValue: number;
  currency: string;
  purchaseDate: string | null;
  lastValuedDate: string | null;
  location: string | null;
  description: string | null;
  icon: string;
  color: string;
  isSold: boolean;
  notes: string | null;
  createdAt: string;
  gainLoss: number;
  gainLossPercentage: number;
}

export function AssetsClient() {
  const { data: session } = useSession();
  const { isPartnerView } = usePartnerView();
  const userCurrency = session?.user?.currency || "MYR";
  const formatCurrency = currencyFormatter(userCurrency);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [revalueId, setRevalueId] = useState<string | null>(null);
  const [revalueAmount, setRevalueAmount] = useState("");
  const [showSold, setShowSold] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<"PROPERTY" | "VEHICLE" | "COLLECTIBLE" | "OTHER">("PROPERTY");
  const [formPurchasePrice, setFormPurchasePrice] = useState("");
  const [formCurrentValue, setFormCurrentValue] = useState("");
  const [formCurrency, setFormCurrency] = useState(userCurrency);
  const [formPurchaseDate, setFormPurchaseDate] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const fetchData = async () => {
    try {
      const [data, rateData] = await Promise.all([getAssets(), fetchExchangeRates(userCurrency)]);
      setAssets(data);
      setRates(rateData);
    } catch {
      toast.error("Failed to load assets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetForm = () => {
    setEditingAsset(null);
    setFormName("");
    setFormType("PROPERTY");
    setFormPurchasePrice("");
    setFormCurrentValue("");
    setFormCurrency(userCurrency);
    setFormPurchaseDate("");
    setFormLocation("");
    setFormDescription("");
    setFormNotes("");
  };

  const populateEditForm = (asset: Asset) => {
    setEditingAsset(asset);
    setFormName(asset.name);
    setFormType(asset.type as "PROPERTY" | "VEHICLE" | "COLLECTIBLE" | "OTHER");
    setFormPurchasePrice(String(asset.purchasePrice));
    setFormCurrentValue(String(asset.currentValue));
    setFormCurrency(asset.currency);
    setFormPurchaseDate(asset.purchaseDate ? asset.purchaseDate.split("T")[0] : "");
    setFormLocation(asset.location || "");
    setFormDescription(asset.description || "");
    setFormNotes(asset.notes || "");
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: formName,
      type: formType,
      purchasePrice: parseFloat(formPurchasePrice),
      currentValue: parseFloat(formCurrentValue || formPurchasePrice),
      currency: formCurrency,
      purchaseDate: formPurchaseDate || null,
      lastValuedDate: new Date().toISOString(),
      location: formLocation || null,
      description: formDescription || null,
      icon: formType === "PROPERTY" ? "home" : formType === "VEHICLE" ? "car" : formType === "COLLECTIBLE" ? "gem" : "package",
      color: formType === "PROPERTY" ? "#3B82F6" : formType === "VEHICLE" ? "#F59E0B" : formType === "COLLECTIBLE" ? "#8B5CF6" : "#6366F1",
      notes: formNotes || null,
    };
    try {
      if (editingAsset) {
        await updateAsset(editingAsset.id, payload);
        toast.success("Asset updated");
      } else {
        await createAsset(payload);
        toast.success("Asset added");
      }
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch {
      toast.error(editingAsset ? "Failed to update" : "Failed to add asset");
    }
  };

  const handleRevalue = async (id: string) => {
    const val = parseFloat(revalueAmount);
    if (isNaN(val) || val < 0) {
      toast.error("Enter a valid amount");
      return;
    }
    try {
      await updateAssetValue(id, val);
      toast.success("Value updated");
      setRevalueId(null);
      setRevalueAmount("");
      fetchData();
    } catch {
      toast.error("Failed to update value");
    }
  };

  const handleMarkSold = async (id: string) => {
    try {
      await markAssetSold(id);
      toast.success("Marked as sold");
      fetchData();
    } catch {
      toast.error("Failed to mark as sold");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAsset(id);
      toast.success("Asset deleted");
      fetchData();
    } catch {
      toast.error("Failed to delete");
    }
  };

  const toUser = (amount: number, from: string) => convertCurrency(amount, from, userCurrency, rates);
  const activeAssets = assets.filter((a) => !a.isSold);
  const soldAssets = assets.filter((a) => a.isSold);
  const totalValue = activeAssets.reduce((s, a) => s + toUser(a.currentValue, a.currency), 0);
  const totalCost = activeAssets.reduce((s, a) => s + toUser(a.purchasePrice, a.currency), 0);
  const totalGain = totalValue - totalCost;
  const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;
  const hasMultipleCurrencies = new Set(activeAssets.map((a) => a.currency)).size > 1;

  const byType = activeAssets.reduce(
    (acc, a) => {
      const label = ASSET_TYPES.find((t) => t.value === a.type)?.label || a.type;
      if (!acc[label]) acc[label] = 0;
      acc[label] += toUser(a.currentValue, a.currency);
      return acc;
    },
    {} as Record<string, number>,
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Assets</h1>
          <p className="text-muted-foreground">Track your property, vehicles & collectibles</p>
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
              Add Asset
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingAsset ? "Edit Asset" : "Add Asset"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input placeholder="My House" value={formName} onChange={(e) => setFormName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={formType} onValueChange={(v) => setFormType(v as typeof formType)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ASSET_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Purchase Price</Label>
                    <Input type="number" step="0.01" min="0" placeholder="0.00" value={formPurchasePrice} onChange={(e) => setFormPurchasePrice(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Current Value</Label>
                    <Input type="number" step="0.01" min="0" placeholder="0.00" value={formCurrentValue} onChange={(e) => setFormCurrentValue(e.target.value)} />
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
                    <Label>Purchase Date</Label>
                    <Input type="date" value={formPurchaseDate} onChange={(e) => setFormPurchaseDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Location</Label>
                    <Input placeholder="Address or location" value={formLocation} onChange={(e) => setFormLocation(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input placeholder="Brief description" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input placeholder="Any additional notes" value={formNotes} onChange={(e) => setFormNotes(e.target.value)} />
                </div>

                <Button type="submit" className="w-full">
                  {editingAsset ? "Update Asset" : "Add Asset"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <Package className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Assets</p>
                <p className="text-2xl font-bold">{activeAssets.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
                {hasMultipleCurrencies && <p className="text-xs text-muted-foreground">Converted to {userCurrency}</p>}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${totalGain >= 0 ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-red-100 dark:bg-red-900/30"} flex items-center justify-center`}>
                {totalGain >= 0 ? <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> : <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Gain/Loss</p>
                <p className={`text-2xl font-bold ${totalGain >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {totalGain >= 0 ? "+" : ""}
                  {formatCurrency(totalGain)}
                </p>
                <p className={`text-xs ${totalGain >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {totalGainPct >= 0 ? "+" : ""}
                  {totalGainPct.toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground mb-2">By Type</p>
            <div className="space-y-1">
              {Object.entries(byType).map(([type, value]) => (
                <div key={type} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{type}</span>
                  <span className="font-medium">{formatCurrency(value)}</span>
                </div>
              ))}
              {Object.keys(byType).length === 0 && <p className="text-sm text-muted-foreground">No assets yet</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Assets */}
      {activeAssets.length === 0 && !loading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
            <h3 className="text-lg font-medium text-foreground mb-1">No assets yet</h3>
            <p className="text-sm text-muted-foreground">Add your property, vehicles, or collectibles to track their value</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {activeAssets.map((asset) => {
            const Icon = ASSET_TYPE_ICONS[asset.type] || Package;
            const typeColor = ASSET_TYPE_COLORS[asset.type] || ASSET_TYPE_COLORS.OTHER;
            const acctFmt = currencyFormatter(asset.currency);
            const gain = asset.gainLoss;
            const gainPct = asset.gainLossPercentage;
            const isRevaluing = revalueId === asset.id;

            return (
              <Card key={asset.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Icon */}
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: asset.color + "20" }}>
                      <Icon className="w-5 h-5" style={{ color: asset.color }} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="font-semibold truncate">{asset.name}</h3>
                        <Badge variant="secondary" className={typeColor}>
                          {ASSET_TYPES.find((t) => t.value === asset.type)?.label || asset.type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {asset.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {asset.location}
                          </span>
                        )}
                        {asset.purchaseDate && <span>Bought {new Date(asset.purchaseDate).toLocaleDateString()}</span>}
                        {asset.lastValuedDate && <span>Valued {new Date(asset.lastValuedDate).toLocaleDateString()}</span>}
                      </div>
                    </div>

                    {/* Value */}
                    <div className="text-right shrink-0">
                      <p className="font-bold text-lg">{acctFmt(asset.currentValue)}</p>
                      <p className={`text-xs ${gain >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {gain >= 0 ? "+" : ""}
                        {acctFmt(gain)} ({gainPct >= 0 ? "+" : ""}
                        {gainPct.toFixed(1)}%)
                      </p>
                    </div>

                    {/* Actions */}
                    {!isPartnerView && (
                      <div className="flex items-center gap-1 shrink-0">
                        {isRevaluing ? (
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="New value"
                              className="w-28 h-8 text-sm"
                              value={revalueAmount}
                              onChange={(e) => setRevalueAmount(e.target.value)}
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleRevalue(asset.id);
                                if (e.key === "Escape") {
                                  setRevalueId(null);
                                  setRevalueAmount("");
                                }
                              }}
                            />
                            <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => handleRevalue(asset.id)}>
                              ✓
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2"
                              onClick={() => {
                                setRevalueId(null);
                                setRevalueAmount("");
                              }}
                            >
                              ✕
                            </Button>
                          </div>
                        ) : (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-muted-foreground hover:text-blue-600"
                              title="Update value"
                              onClick={() => {
                                setRevalueId(asset.id);
                                setRevalueAmount(String(asset.currentValue));
                              }}
                            >
                              <RefreshCw className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => populateEditForm(asset)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-amber-600" title="Mark as sold" onClick={() => handleMarkSold(asset.id)}>
                              <DollarSign className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-red-600" onClick={() => handleDelete(asset.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Sold Assets */}
      {soldAssets.length > 0 && (
        <div>
          <button className="text-sm text-muted-foreground hover:text-foreground mb-3 flex items-center gap-1" onClick={() => setShowSold(!showSold)}>
            {showSold ? "▾" : "▸"} Sold Assets ({soldAssets.length})
          </button>
          {showSold && (
            <div className="space-y-3 opacity-60">
              {soldAssets.map((asset) => {
                const Icon = ASSET_TYPE_ICONS[asset.type] || Package;
                const acctFmt = currencyFormatter(asset.currency);
                const gain = asset.gainLoss;
                const gainPct = asset.gainLossPercentage;

                return (
                  <Card key={asset.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-gray-100 dark:bg-gray-800">
                          <Icon className="w-5 h-5 text-gray-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold truncate">{asset.name}</h3>
                            <Badge variant="secondary">Sold</Badge>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold">{acctFmt(asset.currentValue)}</p>
                          <p className={`text-xs ${gain >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                            {gain >= 0 ? "+" : ""}
                            {acctFmt(gain)} ({gainPct >= 0 ? "+" : ""}
                            {gainPct.toFixed(1)}%)
                          </p>
                        </div>
                        {!isPartnerView && (
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-red-600" onClick={() => handleDelete(asset.id)}>
                            <Trash2 className="w-4 h-4" />
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
