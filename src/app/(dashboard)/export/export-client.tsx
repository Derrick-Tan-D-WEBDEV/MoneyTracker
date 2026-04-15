"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Download, FileText, Table2, Loader2 } from "lucide-react";
import { getExportData } from "@/actions/export";
import { toast } from "sonner";

export function ExportClient() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [exporting, setExporting] = useState(false);

  const handleCSVExport = async () => {
    setExporting(true);
    try {
      const data = await getExportData({ startDate, endDate, type: typeFilter });
      const rows = [
        ["Date", "Description", "Type", "Category", "Account", "Currency", "Amount", "Amount (" + data.userCurrency + ")", "Tags", "Notes"],
        ...data.transactions.map((t) => [
          new Date(t.date).toLocaleDateString("en-US"),
          t.description,
          t.type,
          t.category,
          t.account,
          t.accountCurrency,
          String(t.amount),
          String(t.amountInUserCurrency.toFixed(2)),
          t.tags,
          t.notes,
        ]),
      ];
      const csvContent = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
      downloadFile(csvContent, `moneytracker-export-${new Date().toISOString().split("T")[0]}.csv`, "text/csv;charset=utf-8;");
      toast.success(`Exported ${data.transactions.length} transactions`);
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  const handlePDFExport = async () => {
    setExporting(true);
    try {
      const data = await getExportData({ startDate, endDate, type: typeFilter });

      // Build HTML for PDF
      const totalIncome = data.transactions.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amountInUserCurrency, 0);
      const totalExpenses = data.transactions.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amountInUserCurrency, 0);

      const html = `
<!DOCTYPE html>
<html>
<head>
<title>Financial Report</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a; }
  h1 { font-size: 24px; margin-bottom: 4px; }
  .subtitle { color: #666; margin-bottom: 24px; }
  .summary { display: flex; gap: 20px; margin-bottom: 32px; }
  .summary-card { flex: 1; padding: 16px; border: 1px solid #e5e5e5; border-radius: 8px; }
  .summary-card .label { font-size: 12px; color: #666; text-transform: uppercase; }
  .summary-card .value { font-size: 24px; font-weight: 700; margin-top: 4px; }
  .income { color: #059669; }
  .expense { color: #dc2626; }
  .net { color: #2563eb; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
  th { text-align: left; padding: 8px 12px; background: #f5f5f5; border-bottom: 2px solid #e5e5e5; font-weight: 600; }
  td { padding: 8px 12px; border-bottom: 1px solid #f0f0f0; }
  tr:hover td { background: #fafafa; }
  .amount { text-align: right; font-variant-numeric: tabular-nums; font-weight: 500; }
  .accounts { margin-top: 32px; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #999; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<h1>Financial Report</h1>
<p class="subtitle">Exported on ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}${startDate ? ` | From ${startDate}` : ""}${endDate ? ` to ${endDate}` : ""}</p>

<div class="summary">
  <div class="summary-card"><div class="label">Income</div><div class="value income">${data.userCurrency} ${totalIncome.toFixed(2)}</div></div>
  <div class="summary-card"><div class="label">Expenses</div><div class="value expense">${data.userCurrency} ${totalExpenses.toFixed(2)}</div></div>
  <div class="summary-card"><div class="label">Net</div><div class="value ${totalIncome - totalExpenses >= 0 ? "net" : "expense"}">${data.userCurrency} ${(totalIncome - totalExpenses).toFixed(2)}</div></div>
</div>

<h2>Transactions (${data.transactions.length})</h2>
<table>
<thead><tr><th>Date</th><th>Description</th><th>Type</th><th>Category</th><th>Account</th><th class="amount">Amount</th></tr></thead>
<tbody>
${data.transactions
  .map(
    (t) => `<tr>
    <td>${new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
    <td>${escapeHtml(t.description)}</td>
    <td>${t.type}</td>
    <td>${escapeHtml(t.category)}</td>
    <td>${escapeHtml(t.account)}</td>
    <td class="amount ${t.type === "INCOME" ? "income" : "expense"}">${t.type === "INCOME" ? "+" : "-"}${t.accountCurrency} ${t.amount.toFixed(2)}</td>
  </tr>`,
  )
  .join("")}
</tbody>
</table>

<div class="accounts">
<h2>Accounts</h2>
<table>
<thead><tr><th>Account</th><th>Type</th><th>Currency</th><th class="amount">Balance</th><th class="amount">Reserved</th></tr></thead>
<tbody>
${data.accounts.map((a) => `<tr><td>${escapeHtml(a.name)}</td><td>${a.type}</td><td>${a.currency}</td><td class="amount">${a.currency} ${a.balance.toFixed(2)}</td><td class="amount">${a.currency} ${(a.reservedAmount || 0).toFixed(2)}</td></tr>`).join("")}
</tbody>
</table>
</div>

<div class="footer">Generated by MoneyTracker · ${new Date().toISOString()}</div>
</body>
</html>`;

      // Open in new window for printing as PDF
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 500);
      }
      toast.success("PDF ready - use Print dialog to save");
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Export Data</h1>
        <p className="text-muted-foreground">Download your financial data as CSV or PDF</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Export Options</CardTitle>
          <CardDescription>Filter the data you want to export</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={typeFilter} onValueChange={(v) => v && setTypeFilter(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Types</SelectItem>
                  <SelectItem value="INCOME">Income</SelectItem>
                  <SelectItem value="EXPENSE">Expense</SelectItem>
                  <SelectItem value="TRANSFER">Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Export Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors" onClick={!exporting ? handleCSVExport : undefined}>
          <CardContent className="flex items-center gap-4 py-6">
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/40 rounded-xl flex items-center justify-center shrink-0">
              <Table2 className="w-6 h-6 text-emerald-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Export as CSV</h3>
              <p className="text-sm text-muted-foreground">Spreadsheet format, compatible with Excel and Google Sheets</p>
            </div>
            {exporting ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : <Download className="w-5 h-5 text-muted-foreground" />}
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 transition-colors" onClick={!exporting ? handlePDFExport : undefined}>
          <CardContent className="flex items-center gap-4 py-6">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-950/40 rounded-xl flex items-center justify-center shrink-0">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Export as PDF</h3>
              <p className="text-sm text-muted-foreground">Print-ready report with summary and transactions</p>
            </div>
            {exporting ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : <Download className="w-5 h-5 text-muted-foreground" />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function escapeHtml(str: string) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
