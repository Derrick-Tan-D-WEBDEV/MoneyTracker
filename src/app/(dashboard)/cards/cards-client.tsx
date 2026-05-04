"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Plus, RefreshCw, Trash2, Pencil, Search, Heart, Upload, Layers, Sparkles, ImageOff, ArrowDownToLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

import { usePartnerView } from "@/hooks/use-partner-view";
import { convertCurrency } from "@/lib/exchange-rates";
import { currencyFormatter } from "@/lib/format";
import { getExchangeRates as fetchExchangeRates } from "@/actions/exchange-rates";
import {
  isCatalogEmpty,
  syncCatalog,
  listSets,
  listCardsInSet,
  searchCatalog,
  getCollection,
  addCollectionItem,
  updateCollectionItem,
  deleteCollectionItem,
  refreshCollectionPrices,
  getCardPriceHistory,
  getCardWishlist,
  addCardWishlistItem,
  removeCardWishlistItem,
  importCollectionCsv,
  type CatalogCard,
  type CollectionItem,
  type WishlistEntry,
  type PriceHistoryPoint,
} from "@/actions/cards";

import { PriceHistoryChart } from "@/components/cards/price-history-chart";

type Finish = "NORMAL" | "FOIL" | "ENCHANTED";
type Condition = "NM" | "LP" | "MP" | "HP" | "DMG";

const FINISH_OPTIONS: Finish[] = ["NORMAL", "FOIL", "ENCHANTED"];
const CONDITION_OPTIONS: Condition[] = ["NM", "LP", "MP", "HP", "DMG"];

function fullName(c: { name: string; subtitle: string | null }) {
  return c.subtitle ? `${c.name} – ${c.subtitle}` : c.name;
}

export function CardsClient() {
  const { data: session } = useSession();
  const { isPartnerView } = usePartnerView();
  const userCurrency = session?.user?.currency || "USD";
  const formatCurrency = currencyFormatter(userCurrency);

  const [rates, setRates] = useState<Record<string, number>>({});
  const [collection, setCollection] = useState<CollectionItem[]>([]);
  const [wishlist, setWishlist] = useState<WishlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [catalogEmpty, setCatalogEmpty] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Browse tab state
  const [sets, setSets] = useState<{ code: string; name: string; count: number }[]>([]);
  const [selectedSet, setSelectedSet] = useState<string>("");
  const [browseSearch, setBrowseSearch] = useState("");
  const [browseCards, setBrowseCards] = useState<CatalogCard[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);

  // Add/edit dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null);
  const [pendingCard, setPendingCard] = useState<CatalogCard | null>(null);
  const [formFinish, setFormFinish] = useState<Finish>("NORMAL");
  const [formCondition, setFormCondition] = useState<Condition>("NM");
  const [formQuantity, setFormQuantity] = useState("1");
  const [formAcquired, setFormAcquired] = useState("");
  const [formAcquiredDate, setFormAcquiredDate] = useState("");
  const [formNotes, setFormNotes] = useState("");

  // Wishlist add dialog
  const [wishDialogOpen, setWishDialogOpen] = useState(false);
  const [wishCard, setWishCard] = useState<CatalogCard | null>(null);
  const [wishFinish, setWishFinish] = useState<Finish>("NORMAL");
  const [wishTarget, setWishTarget] = useState("");
  const [wishNotes, setWishNotes] = useState("");

  // History dialog
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyCard, setHistoryCard] = useState<CatalogCard | null>(null);
  const [historyData, setHistoryData] = useState<PriceHistoryPoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // CSV import
  const [csvText, setCsvText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);

  const refreshAll = async () => {
    try {
      const [rateData, coll, wish, isEmpty, setList] = await Promise.all([fetchExchangeRates(userCurrency), getCollection(), getCardWishlist(), isCatalogEmpty(), listSets()]);
      setRates(rateData);
      setCollection(coll);
      setWishlist(wish);
      setCatalogEmpty(isEmpty);
      setSets(setList);
      if (setList.length > 0 && !selectedSet) setSelectedSet(setList[0].code);
    } catch {
      toast.error("Failed to load cards");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load cards when set changes
  useEffect(() => {
    if (!selectedSet) return;
    setBrowseLoading(true);
    listCardsInSet(selectedSet)
      .then(setBrowseCards)
      .finally(() => setBrowseLoading(false));
  }, [selectedSet]);

  // Debounced search
  useEffect(() => {
    if (!browseSearch || browseSearch.trim().length < 2) return;
    const t = setTimeout(async () => {
      setBrowseLoading(true);
      try {
        const res = await searchCatalog(browseSearch, { setCode: selectedSet || undefined });
        setBrowseCards(res);
      } finally {
        setBrowseLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [browseSearch, selectedSet]);

  const usdToUser = (usd: number) => convertCurrency(usd, "USD", userCurrency, rates);

  const collectionTotalUsd = useMemo(() => collection.reduce((sum, c) => sum + (c.totalMarketUsd ?? 0), 0), [collection]);
  const collectionCostUsd = useMemo(() => collection.reduce((sum, c) => sum + c.acquiredPrice * c.quantity, 0), [collection]);
  const totalQuantity = useMemo(() => collection.reduce((s, c) => s + c.quantity, 0), [collection]);
  const collectionGain = collectionTotalUsd - collectionCostUsd;
  const collectionGainPct = collectionCostUsd > 0 ? (collectionGain / collectionCostUsd) * 100 : 0;

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await syncCatalog();
      toast.success(`Synced ${res.cardsUpserted} cards across ${res.setsProcessed} sets`);
      if (res.errors.length > 0) toast.warning(`${res.errors.length} sync warnings`);
      await refreshAll();
    } catch {
      toast.error("Catalog sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleRefreshPrices = async () => {
    setRefreshing(true);
    try {
      const res = await refreshCollectionPrices();
      toast.success(`Updated ${res.cardsUpserted} cards`);
      await refreshAll();
    } catch {
      toast.error("Price refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  const openAddDialog = (card: CatalogCard) => {
    setEditingCollectionId(null);
    setPendingCard(card);
    setFormFinish("NORMAL");
    setFormCondition("NM");
    setFormQuantity("1");
    setFormAcquired(card.priceUsd ? card.priceUsd.toFixed(2) : "0");
    setFormAcquiredDate(new Date().toISOString().slice(0, 10));
    setFormNotes("");
    setAddDialogOpen(true);
  };

  const openEditDialog = (item: CollectionItem) => {
    setEditingCollectionId(item.id);
    setPendingCard(item.catalog);
    setFormFinish(item.finish);
    setFormCondition(item.condition);
    setFormQuantity(String(item.quantity));
    setFormAcquired(item.acquiredPrice.toFixed(2));
    setFormAcquiredDate(item.acquiredDate ? item.acquiredDate.slice(0, 10) : "");
    setFormNotes(item.notes ?? "");
    setAddDialogOpen(true);
  };

  const submitCollectionForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingCard) return;
    const qty = parseInt(formQuantity, 10);
    const price = parseFloat(formAcquired);
    if (!Number.isFinite(qty) || qty < 1) {
      toast.error("Quantity must be at least 1");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      toast.error("Invalid acquired price");
      return;
    }
    try {
      const payload = {
        catalogId: pendingCard.id,
        finish: formFinish,
        condition: formCondition,
        language: "EN",
        quantity: qty,
        acquiredPrice: price,
        currency: "USD",
        acquiredDate: formAcquiredDate || null,
        notes: formNotes || null,
      };
      if (editingCollectionId) {
        await updateCollectionItem(editingCollectionId, payload);
        toast.success("Card updated");
      } else {
        await addCollectionItem(payload);
        toast.success("Card added to collection");
      }
      setAddDialogOpen(false);
      await refreshAll();
    } catch {
      toast.error("Failed to save card");
    }
  };

  const handleDeleteCollection = async (id: string) => {
    try {
      await deleteCollectionItem(id);
      toast.success("Card removed");
      await refreshAll();
    } catch {
      toast.error("Failed to delete card");
    }
  };

  const openWishDialog = (card: CatalogCard) => {
    setWishCard(card);
    setWishFinish("NORMAL");
    setWishTarget("");
    setWishNotes("");
    setWishDialogOpen(true);
  };

  const submitWishlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wishCard) return;
    const target = wishTarget ? parseFloat(wishTarget) : null;
    if (target != null && (!Number.isFinite(target) || target < 0)) {
      toast.error("Invalid target price");
      return;
    }
    try {
      await addCardWishlistItem({
        catalogId: wishCard.id,
        finish: wishFinish,
        targetMaxPrice: target,
        notes: wishNotes || null,
      });
      toast.success("Added to wishlist");
      setWishDialogOpen(false);
      await refreshAll();
    } catch {
      toast.error("Failed to add to wishlist");
    }
  };

  const handleRemoveWishlist = async (id: string) => {
    try {
      await removeCardWishlistItem(id);
      toast.success("Removed");
      await refreshAll();
    } catch {
      toast.error("Failed to remove");
    }
  };

  const openHistory = async (card: CatalogCard) => {
    setHistoryCard(card);
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const data = await getCardPriceHistory(card.id, 180);
      setHistoryData(data);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleCsvImport = async () => {
    if (!csvText.trim()) {
      toast.error("Paste CSV content first");
      return;
    }
    setImporting(true);
    try {
      const res = await importCollectionCsv(csvText);
      setImportResult(res);
      toast.success(`Imported ${res.imported} cards (${res.skipped} skipped)`);
      await refreshAll();
    } catch {
      toast.error("CSV import failed");
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Layers className="w-6 h-6 text-purple-500" /> Card Collection
          </h1>
          <p className="text-muted-foreground">Track your Disney Lorcana TCG collection &amp; current market value.</p>
        </div>
        <div className="flex gap-2">
          {!isPartnerView && (
            <Button onClick={handleRefreshPrices} disabled={refreshing || collection.length === 0} variant="outline">
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Refresh prices
            </Button>
          )}
        </div>
      </div>

      {catalogEmpty && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="font-medium">Catalog is empty</p>
              <p className="text-sm text-muted-foreground">Sync the Lorcana card catalog from Lorcast to start browsing.</p>
            </div>
            {!isPartnerView && (
              <Button onClick={handleSync} disabled={syncing}>
                <ArrowDownToLine className={`w-4 h-4 mr-2 ${syncing ? "animate-pulse" : ""}`} />
                {syncing ? "Syncing…" : "Sync catalog"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Collection value</p>
            <p className="text-2xl font-bold">{formatCurrency(usdToUser(collectionTotalUsd))}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {totalQuantity} cards · {collection.length} unique
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Cost basis</p>
            <p className="text-2xl font-bold">{formatCurrency(usdToUser(collectionCostUsd))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Unrealized P/L</p>
            <p className={`text-2xl font-bold ${collectionGain >= 0 ? "text-emerald-500" : "text-red-500"}`}>
              {collectionGain >= 0 ? "+" : ""}
              {formatCurrency(usdToUser(collectionGain))}
            </p>
            <p className={`text-xs mt-1 ${collectionGain >= 0 ? "text-emerald-500" : "text-red-500"}`}>
              {collectionGain >= 0 ? "+" : ""}
              {collectionGainPct.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="collection">
        <TabsList>
          <TabsTrigger value="collection">Collection</TabsTrigger>
          <TabsTrigger value="browse">Browse</TabsTrigger>
          <TabsTrigger value="wishlist">Wishlist</TabsTrigger>
          <TabsTrigger value="import">Import</TabsTrigger>
        </TabsList>

        {/* COLLECTION */}
        <TabsContent value="collection" className="space-y-3 mt-2">
          {collection.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Your collection is empty. Switch to <strong>Browse</strong> to add cards.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {collection.map((item) => {
                const unitUserCurr = item.unitMarketUsd != null ? usdToUser(item.unitMarketUsd) : null;
                const totalUserCurr = item.totalMarketUsd != null ? usdToUser(item.totalMarketUsd) : null;
                const cost = item.acquiredPrice * item.quantity;
                const gain = item.gainLossUsd != null ? usdToUser(item.gainLossUsd) : null;
                return (
                  <Card key={item.id} className="overflow-hidden">
                    <CardContent className="p-3 flex items-center gap-3">
                      <button onClick={() => openHistory(item.catalog)} className="shrink-0">
                        {item.catalog.imageSmall ? (
                          <Image src={item.catalog.imageSmall} alt={fullName(item.catalog)} width={56} height={78} className="rounded-md object-cover hover:ring-2 hover:ring-purple-400" />
                        ) : (
                          <div className="w-14 h-19.5 rounded-md bg-muted flex items-center justify-center">
                            <ImageOff className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{fullName(item.catalog)}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {item.catalog.setName} · #{item.catalog.cardNumber}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          <Badge variant="secondary">×{item.quantity}</Badge>
                          <Badge variant="outline">{item.finish}</Badge>
                          <Badge variant="outline">{item.condition}</Badge>
                          {item.catalog.rarity && (
                            <Badge variant="outline" className="capitalize">
                              {item.catalog.rarity.replace("_", " ")}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold">{totalUserCurr != null ? formatCurrency(totalUserCurr) : "—"}</p>
                        <p className="text-xs text-muted-foreground">{unitUserCurr != null ? `${formatCurrency(unitUserCurr)} ea` : "no price"}</p>
                        {gain != null && (
                          <p className={`text-xs ${gain >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                            {gain >= 0 ? "+" : ""}
                            {formatCurrency(gain)}
                          </p>
                        )}
                      </div>
                      {!isPartnerView && (
                        <div className="flex flex-col gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} aria-label="Edit">
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteCollection(item.id)} aria-label="Delete">
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* BROWSE */}
        <TabsContent value="browse" className="space-y-3 mt-2">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label>Set</Label>
              <Select value={selectedSet} onValueChange={(v) => setSelectedSet(v ?? "")}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder={sets.length === 0 ? "No sets — sync catalog first" : "Select a set"} />
                </SelectTrigger>
                <SelectContent>
                  {sets.map((s) => (
                    <SelectItem key={s.code} value={s.code}>
                      {s.name} ({s.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 flex-1 min-w-64">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Card name…" value={browseSearch} onChange={(e) => setBrowseSearch(e.target.value)} className="pl-9" />
              </div>
            </div>
          </div>

          {browseLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {[...Array(12)].map((_, i) => (
                <Skeleton key={i} className="h-72 rounded-lg" />
              ))}
            </div>
          ) : browseCards.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No cards. {catalogEmpty && "Sync the catalog above first."}</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {browseCards.map((card) => (
                <Card key={card.id} className="overflow-hidden group">
                  <button onClick={() => openHistory(card)} className="w-full block aspect-7/10 bg-muted relative">
                    {card.imageNormal ? (
                      <Image src={card.imageNormal} alt={fullName(card)} fill sizes="(max-width: 768px) 50vw, 200px" className="object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageOff className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                  </button>
                  <CardContent className="p-2 space-y-1">
                    <p className="text-xs font-medium truncate" title={fullName(card)}>
                      {fullName(card)}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      #{card.cardNumber} · {card.rarity ?? "—"}
                    </p>
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold">{card.priceUsd != null ? formatCurrency(usdToUser(card.priceUsd)) : "—"}</span>
                      {card.priceUsdFoil != null && (
                        <span className="text-amber-500" title="Foil">
                          {formatCurrency(usdToUser(card.priceUsdFoil))}★
                        </span>
                      )}
                    </div>
                    {!isPartnerView && (
                      <div className="flex gap-1 pt-1">
                        <Button size="sm" className="h-7 text-xs flex-1" onClick={() => openAddDialog(card)}>
                          <Plus className="w-3 h-3 mr-1" /> Add
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => openWishDialog(card)} aria-label="Wishlist">
                          <Heart className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* WISHLIST */}
        <TabsContent value="wishlist" className="space-y-2 mt-2">
          {wishlist.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">Your wishlist is empty. Add cards from the Browse tab.</CardContent>
            </Card>
          ) : (
            wishlist.map((w) => {
              const currentUsd = w.finish === "FOIL" ? w.catalog.priceUsdFoil : w.catalog.priceUsd;
              const targetMet = w.targetMaxPrice != null && currentUsd != null && currentUsd <= w.targetMaxPrice;
              return (
                <Card key={w.id}>
                  <CardContent className="p-3 flex items-center gap-3">
                    {w.catalog.imageSmall ? (
                      <Image src={w.catalog.imageSmall} alt={fullName(w.catalog)} width={56} height={78} className="rounded-md object-cover" />
                    ) : (
                      <div className="w-14 h-19.5 rounded-md bg-muted flex items-center justify-center">
                        <ImageOff className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{fullName(w.catalog)}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {w.catalog.setName} · #{w.catalog.cardNumber}
                      </p>
                      <div className="flex gap-1 mt-1">
                        <Badge variant="outline">{w.finish}</Badge>
                        {targetMet && <Badge className="bg-emerald-500">Target met!</Badge>}
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <p>Now: {currentUsd != null ? formatCurrency(usdToUser(currentUsd)) : "—"}</p>
                      {w.targetMaxPrice != null && <p className="text-xs text-muted-foreground">Target ≤ {formatCurrency(usdToUser(w.targetMaxPrice))}</p>}
                    </div>
                    {!isPartnerView && (
                      <Button variant="ghost" size="icon" onClick={() => handleRemoveWishlist(w.id)} aria-label="Remove">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* IMPORT */}
        <TabsContent value="import" className="space-y-3 mt-2">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div>
                <p className="font-medium">CSV format</p>
                <p className="text-xs text-muted-foreground">
                  Required columns: <code>set_code, card_number, quantity</code>. Optional:{" "}
                  <code>finish (NORMAL/FOIL/ENCHANTED), condition (NM/LP/MP/HP/DMG), acquired_price, acquired_date, notes</code>.
                </p>
              </div>
              <Textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={"set_code,card_number,quantity,finish,condition,acquired_price\n1,1,2,NORMAL,NM,1.50"}
                rows={8}
                className="font-mono text-xs"
                disabled={isPartnerView}
              />
              <Button onClick={handleCsvImport} disabled={importing || isPartnerView}>
                <Upload className="w-4 h-4 mr-2" /> {importing ? "Importing…" : "Import"}
              </Button>
              {importResult && (
                <div className="text-sm space-y-1">
                  <p>
                    Imported: <strong>{importResult.imported}</strong> · Skipped: <strong>{importResult.skipped}</strong>
                  </p>
                  {importResult.errors.length > 0 && (
                    <details className="text-xs text-muted-foreground">
                      <summary>{importResult.errors.length} warnings</summary>
                      <ul className="list-disc pl-5 mt-1">
                        {importResult.errors.slice(0, 20).map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground text-center">
        <Sparkles className="inline w-3 h-3 mr-1" />
        Card data &amp; prices courtesy of{" "}
        <a href="https://lorcast.com" target="_blank" rel="noopener" className="underline">
          Lorcast
        </a>{" "}
        (TCGPlayer market prices, USD).
      </p>

      {/* Add/Edit dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCollectionId ? "Edit card" : "Add to collection"}</DialogTitle>
          </DialogHeader>
          {pendingCard && (
            <form onSubmit={submitCollectionForm} className="space-y-3">
              <div className="flex gap-3 items-start">
                {pendingCard.imageNormal && <Image src={pendingCard.imageNormal} alt={fullName(pendingCard)} width={84} height={117} className="rounded-md" />}
                <div className="text-sm">
                  <p className="font-medium">{fullName(pendingCard)}</p>
                  <p className="text-xs text-muted-foreground">
                    {pendingCard.setName} · #{pendingCard.cardNumber}
                  </p>
                  <p className="text-xs mt-1">
                    Market: {pendingCard.priceUsd != null ? `$${pendingCard.priceUsd.toFixed(2)}` : "—"}
                    {pendingCard.priceUsdFoil != null && ` · Foil $${pendingCard.priceUsdFoil.toFixed(2)}`}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Finish</Label>
                  <Select value={formFinish} onValueChange={(v) => setFormFinish((v ?? "NORMAL") as Finish)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FINISH_OPTIONS.map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Condition</Label>
                  <Select value={formCondition} onValueChange={(v) => setFormCondition((v ?? "NM") as Condition)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONDITION_OPTIONS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Quantity</Label>
                  <Input type="number" min="1" step="1" value={formQuantity} onChange={(e) => setFormQuantity(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <Label>Acquired price (USD/ea)</Label>
                  <Input type="number" min="0" step="0.01" value={formAcquired} onChange={(e) => setFormAcquired(e.target.value)} required />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label>Acquired date</Label>
                  <Input type="date" value={formAcquiredDate} onChange={(e) => setFormAcquiredDate(e.target.value)} />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label>Notes</Label>
                  <Textarea rows={2} value={formNotes} onChange={(e) => setFormNotes(e.target.value)} />
                </div>
              </div>
              <Button type="submit" className="w-full">
                {editingCollectionId ? "Save" : "Add"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Wishlist dialog */}
      <Dialog open={wishDialogOpen} onOpenChange={setWishDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to wishlist</DialogTitle>
          </DialogHeader>
          {wishCard && (
            <form onSubmit={submitWishlist} className="space-y-3">
              <p className="text-sm font-medium">{fullName(wishCard)}</p>
              <div className="space-y-1">
                <Label>Finish</Label>
                <Select value={wishFinish} onValueChange={(v) => setWishFinish((v ?? "NORMAL") as Finish)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FINISH_OPTIONS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Target max price (USD)</Label>
                <Input type="number" min="0" step="0.01" placeholder="optional" value={wishTarget} onChange={(e) => setWishTarget(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Notes</Label>
                <Textarea rows={2} value={wishNotes} onChange={(e) => setWishNotes(e.target.value)} />
              </div>
              <Button type="submit" className="w-full">
                Add
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* History dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{historyCard ? fullName(historyCard) : "Price history"}</DialogTitle>
          </DialogHeader>
          {historyCard && (
            <div className="space-y-3">
              <div className="flex gap-3 items-start">
                {historyCard.imageNormal && <Image src={historyCard.imageNormal} alt={fullName(historyCard)} width={120} height={167} className="rounded-md" />}
                <div className="text-sm space-y-1">
                  <p>
                    {historyCard.setName} · #{historyCard.cardNumber}
                  </p>
                  <p className="text-muted-foreground">
                    {historyCard.rarity ?? ""} {historyCard.cardType ? `· ${historyCard.cardType}` : ""}
                  </p>
                  <p>Normal: {historyCard.priceUsd != null ? `$${historyCard.priceUsd.toFixed(2)}` : "—"}</p>
                  {historyCard.priceUsdFoil != null && <p>Foil: ${historyCard.priceUsdFoil.toFixed(2)}</p>}
                  {!isPartnerView && (
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        onClick={() => {
                          setHistoryOpen(false);
                          openAddDialog(historyCard);
                        }}
                      >
                        <Plus className="w-3 h-3 mr-1" /> Add to collection
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setHistoryOpen(false);
                          openWishDialog(historyCard);
                        }}
                      >
                        <Heart className="w-3 h-3 mr-1" /> Wishlist
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              {historyLoading ? (
                <Skeleton className="h-64 rounded-lg" />
              ) : historyData.length === 0 ? (
                <p className="text-muted-foreground text-sm">No price history yet. History accumulates daily after the first sync.</p>
              ) : (
                <PriceHistoryChart data={historyData} />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
