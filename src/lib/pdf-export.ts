import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { type DebtPayoffResult } from "./debt-strategies";

export function generateDebtPayoffPDF(
  result: DebtPayoffResult,
  comparison: { avalanche: DebtPayoffResult; snowball: DebtPayoffResult } | { avalanche: DebtPayoffResult; snowball: DebtPayoffResult; custom: DebtPayoffResult; bestInterest: string; bestMonths: string },
  userCurrency: string,
) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = 60;

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Title
  doc.setFontSize(22);
  doc.setTextColor(16, 185, 129); // emerald-500
  doc.text("MoneyTracker", margin, y);
  y += 24;

  doc.setFontSize(14);
  doc.setTextColor(60, 60, 60);
  doc.text("Debt Payoff Plan", margin, y);
  y += 14;

  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text(`Generated on ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`, margin, y);
  y += 30;

  // Strategy badge
  doc.setFillColor(16, 185, 129);
  doc.setTextColor(255, 255, 255);
  doc.roundedRect(margin, y, 120, 22, 4, 4, "F");
  doc.setFontSize(10);
  doc.text(result.strategy.toUpperCase(), margin + 12, y + 15);
  y += 36;

  // Summary boxes
  const boxW = (pageWidth - margin * 2 - 20) / 3;
  const boxes = [
    { label: "Debt-Free Date", value: result.payoffDate },
    { label: "Total Interest", value: `${userCurrency} ${fmt(result.totalInterest)}` },
    { label: "Total Cost", value: `${userCurrency} ${fmt(result.totalPaid)}` },
  ];

  boxes.forEach((box, i) => {
    const x = margin + i * (boxW + 10);
    doc.setDrawColor(220, 220, 220);
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(x, y, boxW, 50, 4, 4, "FD");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(box.label, x + 8, y + 18);
    doc.setFontSize(12);
    doc.setTextColor(40, 40, 40);
    doc.text(box.value, x + 8, y + 38);
  });
  y += 70;

  // Debt summary table
  doc.setFontSize(12);
  doc.setTextColor(40, 40, 40);
  doc.text("Debt Summary", margin, y);
  y += 16;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Priority", "Debt Name", "Balance", "Rate", "Min Payment", "Payoff Month", "Total Interest"]],
    body: result.debtSchedules.map((s, i) => [
      String(i + 1),
      s.name,
      `${userCurrency} ${fmt(result.startingBalance > 0 ? s.monthlyBreakdown[0]?.startingBalance ?? 0 : 0)}`,
      `${s.monthlyBreakdown[0] ? ((s.monthlyBreakdown[0].interest / Math.max(s.monthlyBreakdown[0].startingBalance, 0.01)) * 12 * 100).toFixed(2) : "0.00"}%`,
      `${userCurrency} ${fmt(s.monthlyBreakdown[0]?.payment ?? 0)}`,
      `Month ${s.payoffMonth}`,
      `${userCurrency} ${fmt(s.totalInterest)}`,
    ]),
    headStyles: { fillColor: [16, 185, 129], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [248, 248, 248] },
  });

  // @ts-expect-error autoTable adds lastAutoTable to doc
  y = (doc.lastAutoTable?.finalY ?? y) + 30;

  // Strategy comparison
  doc.setFontSize(12);
  doc.setTextColor(40, 40, 40);
  doc.text("Strategy Comparison", margin, y);
  y += 16;

  const compRows = [
    ["Strategy", "Payoff Date", "Months", "Total Interest", "Total Cost"],
    [
      "Avalanche",
      comparison.avalanche.payoffDate,
      String(comparison.avalanche.months),
      `${userCurrency} ${fmt(comparison.avalanche.totalInterest)}`,
      `${userCurrency} ${fmt(comparison.avalanche.totalPaid)}`,
    ],
    [
      "Snowball",
      comparison.snowball.payoffDate,
      String(comparison.snowball.months),
      `${userCurrency} ${fmt(comparison.snowball.totalInterest)}`,
      `${userCurrency} ${fmt(comparison.snowball.totalPaid)}`,
    ],
  ];

  if ("custom" in comparison) {
    compRows.push([
      "Custom",
      comparison.custom.payoffDate,
      String(comparison.custom.months),
      `${userCurrency} ${fmt(comparison.custom.totalInterest)}`,
      `${userCurrency} ${fmt(comparison.custom.totalPaid)}`,
    ]);
  }

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [compRows[0]],
    body: compRows.slice(1),
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [248, 248, 248] },
  });

  // @ts-expect-error
  y = (doc.lastAutoTable?.finalY ?? y) + 30;

  // Amortization schedule (first debt only, to keep PDF reasonable)
  const firstSchedule = result.debtSchedules[0];
  if (firstSchedule && y < 600) {
    doc.setFontSize(12);
    doc.setTextColor(40, 40, 40);
    doc.text(`Amortization: ${firstSchedule.name}`, margin, y);
    y += 16;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Month", "Starting Balance", "Payment", "Interest", "Principal", "Ending Balance"]],
      body: firstSchedule.monthlyBreakdown.map((m) => [
        String(m.month),
        `${userCurrency} ${fmt(m.startingBalance)}`,
        `${userCurrency} ${fmt(m.payment)}`,
        `${userCurrency} ${fmt(m.interest)}`,
        `${userCurrency} ${fmt(m.principalPaid)}`,
        `${userCurrency} ${fmt(Math.max(m.endingBalance, 0))}`,
      ]),
      headStyles: { fillColor: [100, 100, 100], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 248, 248] },
    });
  }

  doc.save(`moneytracker-payoff-plan-${result.strategy}-${new Date().toISOString().split("T")[0]}.pdf`);
}
