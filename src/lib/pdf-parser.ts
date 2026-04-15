/**
 * Generic bank statement PDF parser.
 *
 * Extracts text from PDF using pdfjs-dist (client-side),
 * then detects transactions via date + amount heuristics.
 * Works with DBS/POSB, OCBC, UOB, and most SG/international bank PDFs.
 */

export interface ParsedTransaction {
  date: string; // ISO-ish date string e.g. "2026-03-01"
  description: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  notes: string | null;
  statementBalance: number | null;
}

// ─── Text Extraction ──────────────────────────────────────────

/** Extract all text from a PDF file as a single string per page. */
export async function extractTextFromPDF(file: File): Promise<string[]> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    // Group text items by Y position to reconstruct lines
    const items = content.items as { str: string; transform: number[] }[];
    const lines = new Map<number, { x: number; text: string }[]>();

    for (const item of items) {
      // transform[5] is Y coordinate (inverted — higher Y = higher on page)
      const y = Math.round(item.transform[5]);
      const x = Math.round(item.transform[4]);
      if (!lines.has(y)) lines.set(y, []);
      lines.get(y)!.push({ x, text: item.str });
    }

    // Sort lines by Y descending (top of page first), then items by X ascending
    const sortedLines = [...lines.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, items]) =>
        items
          .sort((a, b) => a.x - b.x)
          .map((i) => i.text)
          .join(" ")
          .trim(),
      )
      .filter((line) => line.length > 0);

    pages.push(sortedLines.join("\n"));
  }

  return pages;
}

// ─── Date Parsing ─────────────────────────────────────────────

const MONTHS: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

// DD/MM/YYYY or DD-MM-YYYY
const DATE_DMY = /^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})/;
// DD MMM YYYY or DD-MMM-YYYY
const DATE_DMONTHY = /^(\d{1,2})[\s\-](jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s\-](\d{2,4})/i;
// YYYY-MM-DD
const DATE_ISO = /^(\d{4})-(\d{2})-(\d{2})/;

/** Try to parse a date from the beginning of a string. Returns YYYY-MM-DD or null. */
function parseDate(text: string): string | null {
  const trimmed = text.trim();

  let m = trimmed.match(DATE_DMY);
  if (m) {
    const day = m[1].padStart(2, "0");
    const month = m[2].padStart(2, "0");
    const year = m[3];
    // Assume DD/MM/YYYY (most common outside US)
    return `${year}-${month}-${day}`;
  }

  m = trimmed.match(DATE_DMONTHY);
  if (m) {
    const day = m[1].padStart(2, "0");
    const month = MONTHS[m[2].toLowerCase().slice(0, 3)] || "01";
    let year = m[3];
    if (year.length === 2) year = "20" + year;
    return `${year}-${month}-${day}`;
  }

  m = trimmed.match(DATE_ISO);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  return null;
}

// ─── Amount Parsing ───────────────────────────────────────────

const AMOUNT_RE = /[\d,]+\.\d{2}/g;

/** Extract all amounts from a text string. */
function extractAmounts(text: string): number[] {
  const matches = text.match(AMOUNT_RE);
  if (!matches) return [];
  return matches.map((m) => parseFloat(m.replace(/,/g, ""))).filter((n) => !isNaN(n) && n > 0);
}

// ─── Noise Detection ──────────────────────────────────────────

const NOISE_PATTERNS = [
  /balance brought forward/i,
  /balance carried forward/i,
  /total balance carried forward/i,
  /page \d+ of \d+/i,
  /transaction details as/i,
  /account summary/i,
  /^date\s+description/i,
  /withdrawal.*deposit.*balance/i,
  /^currency:/i,
  /pds_mmcon/i,
  /sg\d+\s+\(/i,
  /co\.\s*reg\.\s*no/i,
  /gst reg no/i,
  /messages for you/i,
  /for your information/i,
  /deposit insurance scheme/i,
  /consolidated statement/i,
];

function isNoiseLine(line: string): boolean {
  return NOISE_PATTERNS.some((p) => p.test(line));
}

// ─── Description Cleaning ─────────────────────────────────────

/** Extract a clean description from multi-line transaction detail. */
function cleanDescription(lines: string[]): { description: string; notes: string | null } {
  if (lines.length === 0) return { description: "Unknown transaction", notes: null };

  // Look for "TO:" or "FROM:" lines — these have the merchant/person name
  let merchant = "";
  let txType = lines[0]; // First line is usually the transaction type (e.g. "Advice FAST Payment / Receipt")

  for (const line of lines) {
    const toMatch = line.match(/TO:\s*(.+)/i);
    if (toMatch) {
      merchant = toMatch[1].trim();
      break;
    }
    const fromMatch = line.match(/FROM:\s*(.+)/i);
    if (fromMatch) {
      merchant = fromMatch[1].trim();
      break;
    }
  }

  // If we found a merchant, use it as description
  if (merchant) {
    return {
      description: merchant,
      notes: txType !== merchant ? txType : null,
    };
  }

  // Otherwise, use the first non-empty detail line
  return {
    description: txType || lines.join(" ").slice(0, 100),
    notes: lines.length > 1 ? lines.slice(1).join(" ").slice(0, 200) : null,
  };
}

// ─── DBS/POSB-specific Parser ─────────────────────────────────

/**
 * Parse DBS/POSB statement text.
 * Uses the Balance column to determine INCOME vs EXPENSE:
 * if balance increased from previous → INCOME, if decreased → EXPENSE.
 * Amount is derived from the balance difference for accuracy.
 */
function parseDBS(allText: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  const lines = allText.split("\n");

  let previousBalance: number | null = null;
  let currentDate: string | null = null;
  let currentDescLines: string[] = [];
  let currentAmounts: number[] = [];

  const flushTransaction = () => {
    if (currentDate && currentAmounts.length > 0) {
      const { description, notes } = cleanDescription(currentDescLines);

      let amount: number;
      let statementBalance: number | null = null;
      let type: "INCOME" | "EXPENSE" = "EXPENSE";

      // Last amount is always the balance in DBS statements
      if (currentAmounts.length >= 2) {
        statementBalance = currentAmounts[currentAmounts.length - 1];

        if (previousBalance !== null) {
          // Determine type from balance change — this is definitive
          const diff = statementBalance - previousBalance;
          type = diff >= 0 ? "INCOME" : "EXPENSE";
          amount = Math.round(Math.abs(diff) * 100) / 100;
        } else {
          amount = currentAmounts[0];
        }

        previousBalance = statementBalance;
      } else {
        // Single amount — no balance column available
        amount = currentAmounts[0];
      }

      if (amount > 0) {
        transactions.push({
          date: currentDate,
          description,
          amount,
          type,
          notes,
          statementBalance,
        });
      }
    }
    currentDate = null;
    currentDescLines = [];
    currentAmounts = [];
  };

  for (const line of lines) {
    // Extract starting balance from "Balance Brought Forward" lines
    if (/balance brought forward/i.test(line)) {
      const amounts = extractAmounts(line);
      if (amounts.length > 0) {
        previousBalance = amounts[amounts.length - 1];
      }
      continue;
    }

    // Skip balance carried forward and other noise
    if (/balance carried forward/i.test(line)) continue;
    if (isNoiseLine(line)) continue;

    const date = parseDate(line);
    if (date) {
      flushTransaction();
      currentDate = date;

      const amounts = extractAmounts(line);
      if (amounts.length > 0) {
        currentAmounts = amounts;
      }

      const afterDate = line.replace(DATE_DMY, "").trim();
      const descPart = afterDate.replace(AMOUNT_RE, "").trim();
      if (descPart) {
        currentDescLines.push(descPart);
      }
    } else if (currentDate) {
      const amounts = extractAmounts(line);
      const textWithoutAmounts = line.replace(AMOUNT_RE, "").trim();

      if (amounts.length > 0 && currentAmounts.length === 0) {
        currentAmounts = amounts;
      } else if (amounts.length > 0) {
        currentAmounts.push(...amounts);
      }

      if (textWithoutAmounts && !isNoiseLine(textWithoutAmounts)) {
        currentDescLines.push(textWithoutAmounts);
      }
    }
  }
  flushTransaction();

  return transactions;
}

// ─── Generic Parser ───────────────────────────────────────────

/**
 * Generic bank statement parser.
 * Scans for date lines, collects description + amounts,
 * determines income/expense from context.
 */
function parseGeneric(allText: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  const lines = allText.split("\n");

  let currentDate: string | null = null;
  let currentDescLines: string[] = [];
  let currentAmounts: number[] = [];

  const flushTransaction = () => {
    if (currentDate && currentAmounts.length > 0) {
      const { description, notes } = cleanDescription(currentDescLines);

      // Use first amount (skip balance if multiple)
      const amount = currentAmounts[0];
      const statementBalance = currentAmounts.length >= 2 ? currentAmounts[currentAmounts.length - 1] : null;
      if (amount > 0) {
        transactions.push({
          date: currentDate,
          description,
          amount,
          type: "EXPENSE", // Default, will be refined after
          notes,
          statementBalance,
        });
      }
    }
    currentDate = null;
    currentDescLines = [];
    currentAmounts = [];
  };

  for (const line of lines) {
    if (isNoiseLine(line)) continue;

    const date = parseDate(line);
    if (date) {
      flushTransaction();
      currentDate = date;

      const amounts = extractAmounts(line);
      if (amounts.length > 0) currentAmounts = amounts;

      const descPart = line.replace(DATE_DMY, "").replace(DATE_DMONTHY, "").replace(DATE_ISO, "").replace(AMOUNT_RE, "").trim();
      if (descPart) currentDescLines.push(descPart);
    } else if (currentDate) {
      const amounts = extractAmounts(line);
      const textPart = line.replace(AMOUNT_RE, "").trim();

      if (amounts.length > 0 && currentAmounts.length === 0) {
        currentAmounts = amounts;
      } else if (amounts.length > 0) {
        currentAmounts.push(...amounts);
      }

      if (textPart && !isNoiseLine(textPart)) {
        currentDescLines.push(textPart);
      }
    }
  }
  flushTransaction();

  // Refine type based on keywords
  for (const tx of transactions) {
    const text = tx.description + " " + (tx.notes || "");
    if (/incoming|deposit|credit|refund|cashback|interest earned|salary|send back/i.test(text)) {
      tx.type = "INCOME";
    }
  }

  return transactions;
}

// ─── Main Entry Point ─────────────────────────────────────────

/** Parse a bank statement PDF and extract transactions. */
export async function parseBankStatementPDF(file: File): Promise<ParsedTransaction[]> {
  const pages = await extractTextFromPDF(file);
  const allText = pages.join("\n");

  // Detect bank for specialized parsing
  if (/dbs|posb/i.test(allText)) {
    return parseDBS(allText);
  }

  return parseGeneric(allText);
}
