"use client";

import { useState, useCallback, useRef } from "react";
import Papa from "papaparse";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { importTransactions, checkTransactionAchievements, checkDuplicateTransactions } from "@/actions/transactions";
import { toast } from "sonner";
import { parseBankStatementPDF } from "@/lib/pdf-parser";

type ColumnMapping = "skip" | "date" | "description" | "type" | "category" | "amount" | "notes";

const COLUMN_OPTIONS: { value: ColumnMapping; label: string }[] = [
  { value: "skip", label: "Skip" },
  { value: "date", label: "Date" },
  { value: "description", label: "Description" },
  { value: "type", label: "Type (Income/Expense)" },
  { value: "category", label: "Category" },
  { value: "amount", label: "Amount" },
  { value: "notes", label: "Notes" },
];

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
}

interface ReviewRow {
  id: number;
  selected: boolean;
  date: string;
  description: string;
  type: "INCOME" | "EXPENSE";
  amount: number;
  categoryName: string | null;
  notes: string | null;
  isDuplicate?: boolean;
}

interface CSVImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
  onImported: () => void;
  defaultAccountId?: string;
}

function autoDetectMapping(headers: string[]): ColumnMapping[] {
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim());
  return lowerHeaders.map((h) => {
    if (h.includes("date") || h.includes("time") || h === "posted") return "date";
    if (h.includes("description") || h.includes("memo") || h.includes("payee") || h.includes("narrative") || h.includes("details") || h.includes("particulars")) return "description";
    if (h === "type" || h.includes("transaction type") || h === "dr/cr") return "type";
    if (h.includes("category") || h.includes("label")) return "category";
    if (h.includes("amount") || h.includes("value") || h === "sum" || h.includes("debit") || h.includes("credit")) return "amount";
    if (h.includes("note") || h.includes("reference") || h.includes("ref")) return "notes";
    return "skip";
  });
}

function inferType(amountStr: string, typeStr?: string): "INCOME" | "EXPENSE" {
  if (typeStr) {
    const lower = typeStr.toLowerCase().trim();
    if (lower === "income" || lower === "credit" || lower === "cr" || lower === "deposit") return "INCOME";
    if (lower === "expense" || lower === "debit" || lower === "dr" || lower === "withdrawal" || lower === "payment") return "EXPENSE";
  }
  const num = parseFloat(amountStr.replace(/[^0-9.\-]/g, ""));
  return num >= 0 ? "INCOME" : "EXPENSE";
}

export function CSVImportDialog({ open, onOpenChange, accounts, onImported, defaultAccountId }: CSVImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "mapping" | "review" | "result">("upload");
  const [fileType, setFileType] = useState<"csv" | "pdf">("csv");
  const [parsing, setParsing] = useState(false);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ColumnMapping[]>([]);
  const [accountId, setAccountId] = useState(defaultAccountId || "");
  const [defaultType, setDefaultType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; total: number } | null>(null);
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([]);

  const reset = () => {
    setStep("upload");
    setFileType("csv");
    setParsing(false);
    setFileName("");
    setHeaders([]);
    setRawRows([]);
    setMapping([]);
    setAccountId(defaultAccountId || "");
    setDefaultType("EXPENSE");
    setImporting(false);
    setResult(null);
    setReviewRows([]);
  };

  const handleClose = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  const handleFile = useCallback((file: File) => {
    const isPdf = file.name.toLowerCase().endsWith(".pdf");
    const isCsv = file.name.toLowerCase().endsWith(".csv");

    if (!isPdf && !isCsv) {
      toast.error("Please select a CSV or PDF file");
      return;
    }

    setFileName(file.name);
    setFileType(isPdf ? "pdf" : "csv");

    if (isPdf) {
      setParsing(true);
      parseBankStatementPDF(file)
        .then(async (parsed) => {
          if (parsed.length === 0) {
            toast.error("No transactions found in PDF");
            setParsing(false);
            return;
          }
          let rows: ReviewRow[] = parsed.map((tx, i) => ({
            id: i,
            selected: true,
            date: tx.date,
            description: tx.description,
            type: tx.type,
            amount: tx.amount,
            categoryName: null,
            notes: tx.notes,
          }));
          const acctId = defaultAccountId || accountId;
          if (acctId) {
            rows = await markDuplicates(rows, acctId);
          }
          setReviewRows(rows);
          setParsing(false);
          setStep("review");
        })
        .catch(() => {
          toast.error("Failed to parse PDF file");
          setParsing(false);
        });
    } else {
      Papa.parse(file, {
        complete: (results) => {
          const data = results.data as string[][];
          if (data.length < 2) {
            toast.error("CSV file is empty or has no data rows");
            return;
          }

          const csvHeaders = data[0];
          const csvRows = data.slice(1).filter((row) => row.some((cell) => cell.trim()));

          if (csvRows.length === 0) {
            toast.error("No data rows found in CSV");
            return;
          }

          setHeaders(csvHeaders);
          setRawRows(csvRows);
          setMapping(autoDetectMapping(csvHeaders));
          setStep("mapping");
        },
        error: () => {
          toast.error("Failed to parse CSV file");
        },
      });
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const hasRequiredMappings = () => {
    const mapped = new Set(mapping.filter((m) => m !== "skip"));
    return mapped.has("amount") && (mapped.has("description") || mapped.has("date"));
  };

  const parsedRows = () => {
    const dateIdx = mapping.indexOf("date");
    const descIdx = mapping.indexOf("description");
    const typeIdx = mapping.indexOf("type");
    const catIdx = mapping.indexOf("category");
    const amountIdx = mapping.indexOf("amount");
    const notesIdx = mapping.indexOf("notes");

    return rawRows
      .map((row) => {
        const amountStr = amountIdx >= 0 ? row[amountIdx] || "" : "";
        const amount = Math.abs(parseFloat(amountStr.replace(/[^0-9.\-]/g, "")));
        if (isNaN(amount) || amount <= 0) return null;

        const type = typeIdx >= 0 ? inferType(amountStr, row[typeIdx]) : inferType(amountStr);

        return {
          date: dateIdx >= 0 ? row[dateIdx]?.trim() || new Date().toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
          description: descIdx >= 0 ? row[descIdx]?.trim() || "Imported transaction" : "Imported transaction",
          type: type || defaultType,
          categoryName: catIdx >= 0 ? row[catIdx]?.trim() || null : null,
          amount,
          notes: notesIdx >= 0 ? row[notesIdx]?.trim() || null : null,
        };
      })
      .filter(Boolean) as { date: string; description: string; type: "INCOME" | "EXPENSE"; categoryName: string | null; amount: number; notes: string | null }[];
  };

  const handleProceedToReview = async () => {
    if (!accountId) {
      toast.error("Please select an account");
      return;
    }
    if (!hasRequiredMappings()) {
      toast.error("Please map at least Amount and either Description or Date");
      return;
    }
    // Convert CSV mapped rows to review rows
    const rows = parsedRows();
    let mapped = rows.map((r, i) => ({ id: i, selected: true, ...r }));
    mapped = await markDuplicates(mapped, accountId);
    setReviewRows(mapped);
    setStep("review");
  };

  const toggleRow = (id: number) => {
    setReviewRows((prev) => prev.map((r) => (r.id === id ? { ...r, selected: !r.selected } : r)));
  };

  const toggleAll = () => {
    const allSelected = reviewRows.every((r) => r.selected);
    setReviewRows((prev) => prev.map((r) => ({ ...r, selected: !allSelected })));
  };

  const updateRow = (id: number, field: keyof ReviewRow, value: string | number) => {
    setReviewRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const markDuplicates = async (rows: ReviewRow[], acctId: string) => {
    if (!acctId) return rows;
    try {
      const dupes = await checkDuplicateTransactions(
        acctId,
        rows.map((r) => ({ date: r.date, amount: r.amount })),
      );
      if (dupes.size === 0) return rows;
      const updated = rows.map((r) => {
        const key = `${new Date(r.date).toISOString().split("T")[0]}|${r.amount}`;
        const isDup = dupes.has(key);
        return { ...r, isDuplicate: isDup, selected: isDup ? false : r.selected };
      });
      return updated;
    } catch {
      return rows;
    }
  };

  const handleImport = async () => {
    const selected = reviewRows.filter((r) => r.selected);
    if (selected.length === 0) {
      toast.error("No transactions selected");
      return;
    }
    if (!accountId) {
      toast.error("Please select an account");
      return;
    }
    setImporting(true);
    try {
      const rows = selected.map((row) => ({
        date: new Date(row.date).toISOString(),
        description: row.description,
        type: row.type,
        categoryName: row.categoryName,
        amount: row.amount,
        notes: row.notes,
        accountId,
      }));

      const res = await importTransactions(rows);
      setResult(res);

      if (res.imported > 0) {
        await checkTransactionAchievements({ type: "EXPENSE", amount: 0 });
      }

      setStep("result");
      onImported();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to import transactions");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "upload" && "Import Transactions"}
            {step === "mapping" && "Map Columns"}
            {step === "review" && "Review Transactions"}
            {step === "result" && "Import Complete"}
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            {parsing ? (
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <Loader2 className="w-10 h-10 mx-auto mb-3 text-muted-foreground animate-spin" />
                <p className="font-medium text-foreground">Parsing PDF...</p>
                <p className="text-sm text-muted-foreground mt-1">Extracting transactions from {fileName}</p>
              </div>
            ) : (
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <p className="font-medium text-foreground">Drop your file here</p>
                <p className="text-sm text-muted-foreground mt-1">CSV or PDF bank statement</p>
                <input ref={fileInputRef} type="file" accept=".csv,.pdf" className="hidden" onChange={handleFileInput} />
              </div>
            )}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium flex items-center gap-2">
                <FileText className="w-4 h-4" /> Supported formats
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc">
                <li>PDF bank statements (DBS/POSB, OCBC, UOB, and more)</li>
                <li>MoneyTracker export format (Date, Description, Type, Category, Account, Currency, Amount, Notes)</li>
                <li>Bank CSV exports with date, description, and amount columns</li>
                <li>Any CSV with headers — you&apos;ll map columns in the next step</li>
              </ul>
            </div>
          </div>
        )}

        {step === "mapping" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="w-4 h-4" />
              <span>{fileName}</span>
              <Badge variant="secondary">{rawRows.length} rows</Badge>
            </div>

            {!defaultAccountId && (
              <div className="space-y-2">
                <Label>Target Account *</Label>
                <Select value={accountId} onValueChange={(v) => v && setAccountId(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue>{(value: string) => accounts.find((a) => a.id === value)?.name || "Select account..."}</SelectValue>
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
            )}

            <div className="space-y-2">
              <Label>Default transaction type (when type column is not mapped)</Label>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant={defaultType === "EXPENSE" ? "default" : "outline"} onClick={() => setDefaultType("EXPENSE")}>
                  Expense
                </Button>
                <Button type="button" size="sm" variant={defaultType === "INCOME" ? "default" : "outline"} onClick={() => setDefaultType("INCOME")}>
                  Income
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Column Mapping</Label>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-1/3">CSV Column</TableHead>
                      <TableHead className="w-1/3">Map To</TableHead>
                      <TableHead className="w-1/3">Sample</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {headers.map((header, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium text-sm">{header}</TableCell>
                        <TableCell>
                          <Select
                            value={mapping[i]}
                            onValueChange={(v) => {
                              if (!v) return;
                              const newMapping = [...mapping];
                              newMapping[i] = v as ColumnMapping;
                              setMapping(newMapping);
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {COLUMN_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground truncate max-w-[150px]">{rawRows[0]?.[i] || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={reset}>
                Back
              </Button>
              <Button onClick={handleProceedToReview} disabled={!accountId || !hasRequiredMappings()}>
                Preview
              </Button>
            </div>
          </div>
        )}

        {step === "review" &&
          (() => {
            const selected = reviewRows.filter((r) => r.selected);
            const incomeCount = selected.filter((r) => r.type === "INCOME").length;
            const expenseCount = selected.filter((r) => r.type === "EXPENSE").length;
            const allSelected = reviewRows.length > 0 && reviewRows.every((r) => r.selected);
            const duplicateCount = reviewRows.filter((r) => r.isDuplicate).length;

            return (
              <div className="space-y-4">
                {fileType === "pdf" && !defaultAccountId && (
                  <div className="space-y-2">
                    <Label>Target Account *</Label>
                    <Select value={accountId} onValueChange={(v) => v && setAccountId(v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue>{(value: string) => accounts.find((a) => a.id === value)?.name || "Select account..."}</SelectValue>
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
                )}

                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold">{selected.length}</p>
                    <p className="text-xs text-muted-foreground">Selected</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold">{reviewRows.length}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-emerald-600">{incomeCount}</p>
                    <p className="text-xs text-muted-foreground">Income</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-red-500">{expenseCount}</p>
                    <p className="text-xs text-muted-foreground">Expenses</p>
                  </div>
                </div>

                {duplicateCount > 0 && (
                  <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>
                      {duplicateCount} potential duplicate{duplicateCount > 1 ? "s" : ""} found (auto-deselected). You can still re-select them if needed.
                    </span>
                  </div>
                )}

                <div className="border rounded-lg overflow-auto max-h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]">
                          <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded border-muted-foreground" />
                        </TableHead>
                        <TableHead className="w-[90px]">Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-[90px]">Type</TableHead>
                        <TableHead className="w-[100px] text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reviewRows.map((row) => (
                        <TableRow key={row.id} className={`${!row.selected ? "opacity-40" : ""} ${row.isDuplicate ? "bg-amber-50/50 dark:bg-amber-950/20" : ""}`}>
                          <TableCell>
                            <input type="checkbox" checked={row.selected} onChange={() => toggleRow(row.id)} className="rounded border-muted-foreground" />
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="flex items-center gap-1">
                              {row.date}
                              {row.isDuplicate && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-400 text-amber-600">
                                  DUPE
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input value={row.description} onChange={(e) => updateRow(row.id, "description", e.target.value)} className="h-7 text-sm" />
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={row.type === "INCOME" ? "default" : "secondary"}
                              className={`cursor-pointer select-none ${row.type === "INCOME" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : ""}`}
                              onClick={() => updateRow(row.id, "type", row.type === "INCOME" ? "EXPENSE" : "INCOME")}
                            >
                              {row.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={row.amount}
                              onChange={(e) => updateRow(row.id, "amount", Math.abs(parseFloat(e.target.value) || 0))}
                              className="h-7 text-sm text-right tabular-nums w-[90px] ml-auto"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => (fileType === "csv" ? setStep("mapping") : reset())}>
                    Back
                  </Button>
                  <Button onClick={handleImport} disabled={importing || selected.length === 0 || !accountId}>
                    {importing ? "Importing..." : `Import ${selected.length} Transactions`}
                  </Button>
                </div>
              </div>
            );
          })()}

        {step === "result" && result && (
          <div className="space-y-4 text-center py-4">
            <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500" />
            <div>
              <p className="text-lg font-semibold">{result.imported} transactions imported</p>
              {result.skipped > 0 && <p className="text-sm text-muted-foreground">{result.skipped} rows skipped</p>}
            </div>
            <Button onClick={() => handleClose(false)} className="w-full">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
