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
import { Plus, Star, Trash2, ExternalLink, ShoppingBag, Check } from "lucide-react";
import { usePartnerView } from "@/hooks/use-partner-view";
import { getWishlistItems, createWishlistItem, toggleWishlistItem, deleteWishlistItem } from "@/actions/wishlist";
import { currencyFormatter } from "@/lib/format";
import { SUPPORTED_CURRENCIES } from "@/lib/constants";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

interface WishlistItem {
  id: string;
  name: string;
  estimatedCost: number;
  currency: string;
  priority: number;
  targetDate: string | null;
  url: string | null;
  notes: string | null;
  isPurchased: boolean;
  createdAt: string;
}

const PRIORITY_LABELS: Record<number, string> = { 1: "Low", 2: "Low-Med", 3: "Medium", 4: "Med-High", 5: "High" };
const PRIORITY_COLORS: Record<number, string> = {
  1: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  2: "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400",
  3: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-400",
  4: "bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-400",
  5: "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400",
};

export function WishlistClient() {
  const { data: session } = useSession();
  const { isPartnerView } = usePartnerView();
  const userCurrency = session?.user?.currency || "USD";
  const formatCurrency = currencyFormatter(userCurrency);

  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [name, setName] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [currency, setCurrency] = useState(userCurrency);
  const [priority, setPriority] = useState("3");
  const [targetDate, setTargetDate] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");

  const fetchData = async () => {
    try {
      const data = await getWishlistItems();
      setItems(data);
    } catch {
      toast.error("Failed to load wishlist");
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
      await createWishlistItem({
        name,
        estimatedCost: parseFloat(estimatedCost),
        currency,
        priority: parseInt(priority),
        targetDate: targetDate || null,
        url: url || null,
        notes: notes || null,
      });
      toast.success("Item added to wishlist");
      setDialogOpen(false);
      setName("");
      setEstimatedCost("");
      setPriority("3");
      setTargetDate("");
      setUrl("");
      setNotes("");
      fetchData();
    } catch {
      toast.error("Failed to add item");
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await toggleWishlistItem(id);
      fetchData();
    } catch {
      toast.error("Failed to update item");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteWishlistItem(id);
      toast.success("Item removed");
      fetchData();
    } catch {
      toast.error("Failed to delete item");
    }
  };

  const activeItems = items.filter((i) => !i.isPurchased);
  const purchasedItems = items.filter((i) => i.isPurchased);
  const totalCost = activeItems.reduce((s, i) => s + i.estimatedCost, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Wishlist</h1>
          <p className="text-muted-foreground">Track planned purchases and savings goals</p>
        </div>
        {!isPartnerView && <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add to Wishlist</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. New laptop" required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Estimated Cost</Label>
                  <Input type="number" step="0.01" min="0.01" value={estimatedCost} onChange={(e) => setEstimatedCost(e.target.value)} placeholder="1000" required />
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
                  <Label>Priority</Label>
                  <Select value={priority} onValueChange={(v) => v && setPriority(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((p) => (
                        <SelectItem key={p} value={String(p)}>
                          {p} - {PRIORITY_LABELS[p]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Target Date</Label>
                  <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>URL (optional)</Label>
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
              </div>

              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any details..." />
              </div>

              <Button type="submit" className="w-full">
                Add to Wishlist
              </Button>
            </form>
          </DialogContent>
        </Dialog>}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Items</p>
            <p className="text-2xl font-bold">{activeItems.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total Estimated</p>
            <p className="text-2xl font-bold">{formatCurrency(totalCost)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Purchased</p>
            <p className="text-2xl font-bold text-emerald-500">{purchasedItems.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Items */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="pt-4 space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : activeItems.length === 0 && purchasedItems.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Your wishlist is empty. Add something you&apos;d like to save for!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {activeItems.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Planned</h2>
              {activeItems.map((item) => (
                <Card key={item.id} className="group">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <button
                          onClick={() => handleToggle(item.id)}
                          className="mt-0.5 w-5 h-5 rounded border-2 border-muted-foreground/30 flex items-center justify-center shrink-0 hover:border-emerald-500 transition-colors"
                        >
                          &nbsp;
                        </button>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold truncate">{item.name}</span>
                            <Badge className={PRIORITY_COLORS[item.priority]}>
                              <Star className="w-3 h-3 mr-1" />
                              {PRIORITY_LABELS[item.priority]}
                            </Badge>
                            {item.url && (
                              <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">
                              {item.currency} {item.estimatedCost.toLocaleString()}
                            </span>
                            {item.targetDate && <span>Target: {new Date(item.targetDate).toLocaleDateString()}</span>}
                          </div>
                          {item.notes && <p className="text-xs text-muted-foreground mt-1">{item.notes}</p>}
                        </div>
                      </div>
                      {!isPartnerView && <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500 shrink-0"
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {purchasedItems.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-muted-foreground">Purchased</h2>
              {purchasedItems.map((item) => (
                <Card key={item.id} className="group opacity-60">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <button onClick={() => handleToggle(item.id)} className="mt-0.5 w-5 h-5 rounded border-2 border-emerald-500 bg-emerald-500 flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3 text-white" />
                        </button>
                        <div className="min-w-0">
                          <span className="font-semibold truncate line-through">{item.name}</span>
                          <div className="text-sm text-muted-foreground mt-1">
                            {item.currency} {item.estimatedCost.toLocaleString()}
                          </div>
                        </div>
                      </div>
                      {!isPartnerView && <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500 shrink-0"
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
