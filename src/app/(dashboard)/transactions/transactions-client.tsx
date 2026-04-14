"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, ArrowUpRight, ArrowDownRight, ArrowRightLeft, Trash2, Pencil, Filter, Search, Download, Upload, X, Tag } from "lucide-react";
import { usePartnerView } from "@/hooks/use-partner-view";
import { getCategoryIcon } from "@/lib/category-icons";
import { CSVImportDialog } from "@/components/csv-import-dialog";
import { getTransactions, createTransaction, deleteTransaction, checkTransactionAchievements } from "@/actions/transactions";
import { getTags, createTag, updateTransactionTags } from "@/actions/tags";
import { getAccounts } from "@/actions/accounts";
import { getCategories } from "@/actions/categories";
import { currencyFormatter } from "@/lib/format";
import { getExchangeRates } from "@/actions/exchange-rates";
import { convertCurrency, type RateMap } from "@/lib/exchange-rates";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  date: string;
  notes: string | null;
  transferId: string | null;
  category: { id: string; name: string; color: string; icon: string } | null;
  account: { id: string; name: string; type: string; currency: string };
  tags: { id: string; name: string; color: string }[];
}

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
}

interface Category {
  id: string;
  name: string;
  type: string;
  icon: string;
  color: string;
}

export function TransactionsClient() {
  const { data: session } = useSession();
  const { isPartnerView } = usePartnerView();
  const userCurrency = session?.user?.currency || "MYR";
  const formatCurrency = currencyFormatter(userCurrency);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<{ id: string; name: string; color: string }[]>([]);
  const [rates, setRates] = useState<RateMap>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [filterType, setFilterType] = useState("ALL");
  const [filterAccountId, setFilterAccountId] = useState("ALL");
  const [filterCategoryId, setFilterCategoryId] = useState("ALL");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Form state
  const [formType, setFormType] = useState<"EXPENSE" | "INCOME" | "TRANSFER">("EXPENSE");
  const [formAccountId, setFormAccountId] = useState("");
  const [formTransferToAccountId, setFormTransferToAccountId] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [formNotes, setFormNotes] = useState("");

  const fetchData = async () => {
    try {
      const filters: Record<string, string> = {};
      if (filterType !== "ALL") filters.type = filterType;
      if (filterAccountId !== "ALL") filters.accountId = filterAccountId;
      if (filterCategoryId !== "ALL") filters.categoryId = filterCategoryId;
      if (filterStartDate) filters.startDate = filterStartDate;
      if (filterEndDate) filters.endDate = filterEndDate;

      const [txns, accts, cats, rateMap, tagList] = await Promise.all([
        getTransactions(Object.keys(filters).length > 0 ? filters : undefined),
        getAccounts(),
        getCategories(),
        getExchangeRates(userCurrency),
        getTags(),
      ]);
      setTransactions(txns);
      setAccounts(accts);
      setCategories(cats);
      setRates(rateMap);
      setTags(tagList);
    } catch (error) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterType, filterAccountId, filterCategoryId, filterStartDate, filterEndDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formAccountId) {
      toast.error("Please select an account");
      return;
    }
    if (formType === "TRANSFER" && !formTransferToAccountId) {
      toast.error("Please select a destination account");
      return;
    }
    if (formType === "TRANSFER" && formAccountId === formTransferToAccountId) {
      toast.error("Source and destination must be different");
      return;
    }

    try {
      const txAmount = parseFloat(formAmount);
      await createTransaction({
        type: formType,
        accountId: formAccountId,
        categoryId: formType === "TRANSFER" ? null : formCategoryId || null,
        amount: txAmount,
        description: formDescription || (formType === "TRANSFER" ? "Transfer" : ""),
        date: formDate,
        notes: formNotes || null,
        transferToAccountId: formType === "TRANSFER" ? formTransferToAccountId : null,
      });
      if (formType !== "TRANSFER") await checkTransactionAchievements({ type: formType, amount: txAmount });
      toast.success("Transaction added");
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error("Failed to add transaction");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTransaction(id);
      toast.success("Transaction deleted");
      fetchData();
    } catch (error) {
      toast.error("Failed to delete transaction");
    }
  };

  const resetForm = () => {
    setFormType("EXPENSE");
    setFormAccountId("");
    setFormTransferToAccountId("");
    setFormCategoryId("");
    setFormAmount("");
    setFormDescription("");
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormNotes("");
  };

  const filteredCategories = categories.filter((c) => (formType === "TRANSFER" ? false : c.type === formType));

  const displayedTransactions = searchQuery
    ? transactions.filter(
        (t) =>
          t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (t.category?.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.account.name.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : transactions;

  const totalIncome = displayedTransactions.filter((t) => t.type === "INCOME").reduce((s, t) => s + convertCurrency(t.amount, t.account.currency, userCurrency, rates), 0);
  const totalExpenses = displayedTransactions.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + convertCurrency(t.amount, t.account.currency, userCurrency, rates), 0);

  const hasActiveFilters = filterAccountId !== "ALL" || filterCategoryId !== "ALL" || filterStartDate !== "" || filterEndDate !== "" || searchQuery !== "";

  const clearFilters = () => {
    setFilterType("ALL");
    setFilterAccountId("ALL");
    setFilterCategoryId("ALL");
    setFilterStartDate("");
    setFilterEndDate("");
    setSearchQuery("");
  };

  const exportCSV = () => {
    const rows = [
      ["Date", "Description", "Type", "Category", "Account", "Currency", "Amount", "Notes"],
      ...displayedTransactions.map((t) => [
        new Date(t.date).toLocaleDateString("en-US"),
        t.description,
        t.type,
        t.category?.name || "",
        t.account.name,
        t.account.currency,
        t.type === "INCOME" ? String(t.amount) : String(-t.amount),
        t.notes || "",
      ]),
    ];
    const csvContent = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `transactions-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#6B7280");

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    try {
      await createTag({ name: newTagName.trim(), color: newTagColor });
      setNewTagName("");
      setNewTagColor("#6B7280");
      fetchData();
      toast.success("Tag created");
    } catch {
      toast.error("Failed to create tag");
    }
  };

  const TAG_COLORS = ["#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#EC4899", "#6B7280", "#14B8A6"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Transactions</h1>
          <p className="text-muted-foreground">Manage your income and expenses</p>
        </div>
        {!isPartnerView && <div className="flex items-center gap-2">
          <Popover open={tagDialogOpen} onOpenChange={setTagDialogOpen}>
            <PopoverTrigger render={<Button variant="outline" />}>
              <Tag className="w-4 h-4 mr-2" />
              Tags
            </PopoverTrigger>
            <PopoverContent side="bottom" align="end" className="w-64 p-3">
              <p className="text-sm font-medium mb-2">Manage Tags</p>
              <div className="space-y-2 mb-3">
                {tags.map((tag) => (
                  <div key={tag.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                      {tag.name}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-red-500"
                      onClick={async () => {
                        const { deleteTag } = await import("@/actions/tags");
                        await deleteTag(tag.id);
                        fetchData();
                      }}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input placeholder="New tag..." value={newTagName} onChange={(e) => setNewTagName(e.target.value)} className="h-8 text-sm" onKeyDown={(e) => e.key === "Enter" && handleCreateTag()} />
                <input type="color" value={newTagColor} onChange={(e) => setNewTagColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0 p-0" />
                <Button size="sm" className="h-8" onClick={handleCreateTag}>
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
              <div className="flex gap-1 mt-2">
                {TAG_COLORS.map((c) => (
                  <button
                    key={c}
                    className={`w-5 h-5 rounded-full border-2 ${newTagColor === c ? "border-foreground" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setNewTagColor(c)}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Import CSV
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger render={<Button />}>
              <Plus className="w-4 h-4 mr-2" />
              Add Transaction
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Transaction</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex gap-2">
                  <Button type="button" variant={formType === "EXPENSE" ? "default" : "outline"} className="flex-1" onClick={() => setFormType("EXPENSE")}>
                    Expense
                  </Button>
                  <Button type="button" variant={formType === "INCOME" ? "default" : "outline"} className="flex-1" onClick={() => setFormType("INCOME")}>
                    Income
                  </Button>
                  <Button type="button" variant={formType === "TRANSFER" ? "default" : "outline"} className="flex-1" onClick={() => setFormType("TRANSFER")}>
                    Transfer
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input type="number" placeholder="0.00" step="0.01" min="0.01" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} required />
                </div>

                <div className="space-y-2">
                  <Label>{formType === "TRANSFER" ? "Transfer Description (optional)" : "Description"}</Label>
                  <Input
                    placeholder={formType === "TRANSFER" ? "e.g., Savings transfer" : "e.g., Grocery shopping"}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    required={formType !== "TRANSFER"}
                  />
                </div>

                {formType === "TRANSFER" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>From Account</Label>
                      <Select value={formAccountId} onValueChange={(v) => v && setFormAccountId(v)}>
                        <SelectTrigger className="w-full">
                          <SelectValue>{(value: string) => accounts.find((a) => a.id === value)?.name || "Select..."}</SelectValue>
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
                    <div className="space-y-2">
                      <Label>To Account</Label>
                      <Select value={formTransferToAccountId} onValueChange={(v) => v && setFormTransferToAccountId(v)}>
                        <SelectTrigger className="w-full">
                          <SelectValue>{(value: string) => accounts.find((a) => a.id === value)?.name || "Select..."}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {accounts
                            .filter((a) => a.id !== formAccountId)
                            .map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Account</Label>
                      <Select value={formAccountId} onValueChange={(v) => v && setFormAccountId(v)}>
                        <SelectTrigger className="w-full">
                          <SelectValue>{(value: string) => accounts.find((a) => a.id === value)?.name || "Select..."}</SelectValue>
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

                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select value={formCategoryId} onValueChange={(v) => v && setFormCategoryId(v)}>
                        <SelectTrigger className="w-full">
                          <SelectValue>{(value: string) => filteredCategories.find((c) => c.id === value)?.name || "Select..."}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {filteredCategories.map((c) => {
                            const CIcon = getCategoryIcon(c.icon);
                            return (
                              <SelectItem key={c.id} value={c.id}>
                                <span className="flex items-center gap-2">
                                  <CIcon className="w-3.5 h-3.5 shrink-0" style={{ color: c.color }} />
                                  {c.name}
                                </span>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} required />
                </div>

                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Input placeholder="Add a note..." value={formNotes} onChange={(e) => setFormNotes(e.target.value)} />
                </div>

                <Button type="submit" className="w-full">
                  {formType === "TRANSFER" ? "Transfer" : `Add ${formType === "INCOME" ? "Income" : "Expense"}`}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>}
        <CSVImportDialog open={importOpen} onOpenChange={setImportOpen} accounts={accounts} onImported={fetchData} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total Income</p>
            <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalIncome)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total Expenses</p>
            <p className="text-2xl font-bold text-red-500">{formatCurrency(totalExpenses)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Net</p>
            <p className={`text-2xl font-bold ${totalIncome - totalExpenses >= 0 ? "text-emerald-600" : "text-red-500"}`}>{formatCurrency(totalIncome - totalExpenses)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter & Table */}
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">All Transactions</CardTitle>
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="w-3 h-3 mr-1" /> Clear
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={exportCSV}>
                <Download className="w-3.5 h-3.5 mr-1" /> CSV
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search description, category, account..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8 h-9" />
            </div>
            <Select value={filterType} onValueChange={(v) => v && setFilterType(v)}>
              <SelectTrigger className="w-28 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                <SelectItem value="INCOME">Income</SelectItem>
                <SelectItem value="EXPENSE">Expense</SelectItem>
                <SelectItem value="TRANSFER">Transfer</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterAccountId} onValueChange={(v) => v && setFilterAccountId(v)}>
              <SelectTrigger className="w-32 h-9">
                <SelectValue>{(value: string) => (value === "ALL" ? "All Accounts" : accounts.find((a) => a.id === value)?.name || "Account")}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Accounts</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterCategoryId} onValueChange={(v) => v && setFilterCategoryId(v)}>
              <SelectTrigger className="w-32 h-9">
                <SelectValue>{(value: string) => (value === "ALL" ? "All Categories" : categories.find((c) => c.id === value)?.name || "Category")}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Categories</SelectItem>
                {categories.map((c) => {
                  const CIcon = getCategoryIcon(c.icon);
                  return (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        <CIcon className="w-3.5 h-3.5 shrink-0" style={{ color: c.color }} />
                        {c.name}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <Input type="date" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} className="w-32 h-9" placeholder="From" />
            <Input type="date" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} className="w-32 h-9" placeholder="To" />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3 py-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-7 w-7 rounded-md" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ) : displayedTransactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">{searchQuery || hasActiveFilters ? "No transactions match your filters." : "No transactions yet. Add your first one!"}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Category / Tags</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedTransactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: (t.category?.color || "#6B7280") + "20",
                          }}
                        >
                          {(() => {
                            const CatIcon = getCategoryIcon(t.category?.icon || "tag");
                            return <CatIcon className="w-3.5 h-3.5" style={{ color: t.category?.color || "#6B7280" }} />;
                          })()}
                        </div>
                        <span className="font-medium text-sm">{t.description}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {t.category && (
                          <Badge
                            variant="secondary"
                            className="text-xs"
                            style={{
                              backgroundColor: t.category.color + "20",
                              color: t.category.color,
                            }}
                          >
                            {t.category.name}
                          </Badge>
                        )}
                        {t.tags.map((tag) => (
                          <Badge
                            key={tag.id}
                            variant="outline"
                            className="text-xs"
                            style={{
                              borderColor: tag.color,
                              color: tag.color,
                            }}
                          >
                            {tag.name}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{t.account.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(t.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`font-semibold text-sm tabular-nums ${t.type === "INCOME" ? "text-emerald-600" : t.type === "TRANSFER" ? "text-blue-500" : "text-foreground"}`}>
                        {t.type === "INCOME" ? "+" : t.type === "TRANSFER" ? "↔ " : "-"}
                        {currencyFormatter(t.account.currency)(t.amount)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Popover>
                          <PopoverTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-blue-500" />}>
                            <Tag className="w-3.5 h-3.5" />
                          </PopoverTrigger>
                          <PopoverContent side="left" className="w-48 p-2">
                            <p className="text-xs font-medium mb-2">Tags</p>
                            {tags.length === 0 ? (
                              <p className="text-xs text-muted-foreground">No tags yet</p>
                            ) : (
                              <div className="space-y-1">
                                {tags.map((tag) => {
                                  const hasTag = t.tags.some((tt) => tt.id === tag.id);
                                  return (
                                    <button
                                      key={tag.id}
                                      className={`w-full text-left text-xs px-2 py-1 rounded flex items-center gap-2 hover:bg-accent ${hasTag ? "bg-accent" : ""}`}
                                      onClick={async () => {
                                        const newTagIds = hasTag ? t.tags.filter((tt) => tt.id !== tag.id).map((tt) => tt.id) : [...t.tags.map((tt) => tt.id), tag.id];
                                        await updateTransactionTags(t.id, newTagIds);
                                        fetchData();
                                      }}
                                    >
                                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                                      {tag.name}
                                      {hasTag && <span className="ml-auto text-emerald-500">✓</span>}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </PopoverContent>
                        </Popover>
                        {!isPartnerView && <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-500" onClick={() => handleDelete(t.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
