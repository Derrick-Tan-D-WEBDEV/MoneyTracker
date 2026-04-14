"use client";

import { useState, useCallback, useRef } from "react";
import Papa from "papaparse";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, AlertCircle, CheckCircle2, X } from "lucide-react";
import { importTransactions, checkTransactionAchievements } from "@/actions/transactions";
import { toast } from "sonner";

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

interface CSVImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
  onImported: () => void;
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

export function CSVImportDialog({ open, onOpenChange, accounts, onImported }: CSVImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "mapping" | "preview" | "result">("upload");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ColumnMapping[]>([]);
  const [accountId, setAccountId] = useState("");
  const [defaultType, setDefaultType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; total: number } | null>(null);

  const reset = () => {
    setStep("upload");
    setFileName("");
    setHeaders([]);
    setRawRows([]);
    setMapping([]);
    setAccountId("");
    setDefaultType("EXPENSE");
    setImporting(false);
    setResult(null);
  };

  const handleClose = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith(".csv")) {
      toast.error("Please select a CSV file");
      return;
    }

    setFileName(file.name);
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

  const handleProceedToPreview = () => {
    if (!accountId) {
      toast.error("Please select an account");
      return;
    }
    if (!hasRequiredMappings()) {
      toast.error("Please map at least Amount and either Description or Date");
      return;
    }
    setStep("preview");
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const rows = parsedRows().map((row) => ({
        ...row,
        accountId,
        date: new Date(row.date).toISOString(),
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
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "upload" && "Import CSV"}
            {step === "mapping" && "Map Columns"}
            {step === "preview" && "Preview Import"}
            {step === "result" && "Import Complete"}
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <p className="font-medium text-foreground">Drop your CSV file here</p>
              <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
              <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileInput} />
            </div>
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium flex items-center gap-2">
                <FileText className="w-4 h-4" /> Supported formats
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc">
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
              <Button onClick={handleProceedToPreview} disabled={!accountId || !hasRequiredMappings()}>
                Preview
              </Button>
            </div>
          </div>
        )}

        {step === "preview" &&
          (() => {
            const rows = parsedRows();
            const previewRows = rows.slice(0, 20);
            const incomeCount = rows.filter((r) => r.type === "INCOME").length;
            const expenseCount = rows.filter((r) => r.type === "EXPENSE").length;
            const total = rows.reduce((s, r) => s + (r.type === "INCOME" ? r.amount : -r.amount), 0);

            return (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold">{rows.length}</p>
                    <p className="text-xs text-muted-foreground">Transactions</p>
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

                {rawRows.length - rows.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{rawRows.length - rows.length} rows will be skipped (invalid amount)</span>
                  </div>
                )}

                <div className="border rounded-lg overflow-auto max-h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewRows.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm">{row.date}</TableCell>
                          <TableCell className="text-sm font-medium max-w-[200px] truncate">{row.description}</TableCell>
                          <TableCell>
                            <Badge
                              variant={row.type === "INCOME" ? "default" : "secondary"}
                              className={row.type === "INCOME" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : ""}
                            >
                              {row.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{row.categoryName || "—"}</TableCell>
                          <TableCell className={`text-right text-sm font-semibold tabular-nums ${row.type === "INCOME" ? "text-emerald-600" : ""}`}>
                            {row.type === "INCOME" ? "+" : "-"}
                            {row.amount.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {rows.length > 20 && <p className="text-sm text-muted-foreground text-center">Showing 20 of {rows.length} transactions</p>}

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep("mapping")}>
                    Back
                  </Button>
                  <Button onClick={handleImport} disabled={importing || rows.length === 0}>
                    {importing ? "Importing..." : `Import ${rows.length} Transactions`}
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
