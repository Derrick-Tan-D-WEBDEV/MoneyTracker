/**
 * Generic bank statement PDF parser.
 *
 * Extracts text from PDF using pdfjs-dist (client-side),
 * then detects transactions via date + amount heuristics.
 * Works with DBS/POSB, OCBC, UOB, and most SG/international bank PDFs.
 */

export type BankFormat = "dbs" | "ocbc" | "uob" | "generic";

export const BANK_OPTIONS: { value: BankFormat; label: string }[] = [
  { value: "dbs", label: "DBS / POSB" },
  { value: "ocbc", label: "OCBC" },
  { value: "uob", label: "UOB" },
  { value: "generic", label: "Other" },
];

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

    // Group text items by Y position to reconstruct lines (with tolerance for sub-pixel differences)
    const items = content.items as { str: string; transform: number[] }[];
    const Y_TOLERANCE = 3;
    const lineGroups: { y: number; items: { x: number; text: string }[] }[] = [];

    for (const item of items) {
      // transform[5] is Y coordinate (inverted — higher Y = higher on page)
      const y = item.transform[5];
      const x = Math.round(item.transform[4]);
      let group = lineGroups.find((g) => Math.abs(g.y - y) <= Y_TOLERANCE);
      if (!group) {
        group = { y, items: [] };
        lineGroups.push(group);
      }
      group.items.push({ x, text: item.str });
    }

    // Sort lines by Y descending (top of page first), then items by X ascending
    const sortedLines = lineGroups
      .sort((a, b) => b.y - a.y)
      .map((g) =>
        g.items
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

// DD/MM/YYYY or DD-MM-YYYY (allow optional spaces around separators)
const DATE_DMY = /^(\d{1,2})\s*[/\-]\s*(\d{1,2})\s*[/\-]\s*(\d{4})/;
// DD MMM YYYY or DD-MMM-YYYY (allow multiple spaces/dashes)
const DATE_DMONTHY = /^(\d{1,2})[\s\-]+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s\-]+(\d{2,4})/i;
// DD MMM without year (common in DBS/POSB statements)
const DATE_DMONTH_NOYEAR = /^(\d{1,2})[\s\-]+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/i;
// YYYY-MM-DD
const DATE_ISO = /^(\d{4})-(\d{2})-(\d{2})/;

/** Try to parse a date from the beginning of a string. Returns YYYY-MM-DD or null. */
function parseDate(text: string, defaultYear?: number): string | null {
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

  // DD MMM without year (needs defaultYear)
  if (defaultYear) {
    m = trimmed.match(DATE_DMONTH_NOYEAR);
    if (m) {
      const day = m[1].padStart(2, "0");
      const month = MONTHS[m[2].toLowerCase().slice(0, 3)] || "01";
      return `${defaultYear}-${month}-${day}`;
    }
  }

  return null;
}

/** Strip any date prefix from a line. */
function stripDatePrefix(line: string): string {
  return line
    .replace(/^\d{1,2}\s*[/\-]\s*\d{1,2}\s*[/\-]\s*\d{4}\s*/, "")
    .replace(/^\d{1,2}[\s\-]+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?:[\s\-]+\d{2,4})?\s*/i, "")
    .replace(/^\d{4}-\d{2}-\d{2}\s*/, "")
    .trim();
}

/** Extract the statement year from PDF text header. */
function extractStatementYear(allText: string): number {
  // Look for a 4-digit year in the first ~20 lines (statement header area)
  const headerLines = allText.split("\n").slice(0, 30);
  for (const line of headerLines) {
    const m = line.match(/\b(20\d{2})\b/);
    if (m) return parseInt(m[1]);
  }
  return new Date().getFullYear();
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
 * Handles multiple transactions on the same date (date only shown once).
 */
function parseDBS(allText: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  const lines = allText.split("\n");
  const statementYear = extractStatementYear(allText);

  let previousBalance: number | null = null;
  let currentDate: string | null = null;
  let lastDate: string | null = null; // Track last used date for same-date transactions
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
    lastDate = currentDate || lastDate;
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

    const date = parseDate(line, statementYear);
    if (date) {
      flushTransaction();
      currentDate = date;

      const amounts = extractAmounts(line);
      if (amounts.length > 0) {
        currentAmounts = amounts;
      }

      const descPart = stripDatePrefix(line).replace(AMOUNT_RE, "").trim();
      if (descPart) {
        currentDescLines.push(descPart);
      }
    } else if (currentDate || lastDate) {
      const amounts = extractAmounts(line);
      const textWithoutAmounts = line.replace(AMOUNT_RE, "").trim();

      // Detect a new transaction on the same date:
      // If this line has >= 2 amounts (transaction amount + balance)
      // and we already collected >= 2 amounts for the current transaction,
      // this is a separate transaction sharing the same date.
      if (amounts.length >= 2 && currentAmounts.length >= 2) {
        flushTransaction();
        currentDate = lastDate; // Reuse the last date
        currentAmounts = amounts;
        if (textWithoutAmounts && !isNoiseLine(textWithoutAmounts)) {
          currentDescLines.push(textWithoutAmounts);
        }
      } else if (amounts.length > 0 && currentAmounts.length === 0) {
        // First amounts for this transaction
        if (!currentDate) currentDate = lastDate;
        currentAmounts = amounts;
        if (textWithoutAmounts && !isNoiseLine(textWithoutAmounts)) {
          currentDescLines.push(textWithoutAmounts);
        }
      } else if (amounts.length > 0) {
        currentAmounts.push(...amounts);
        if (textWithoutAmounts && !isNoiseLine(textWithoutAmounts)) {
          currentDescLines.push(textWithoutAmounts);
        }
      } else {
        if (textWithoutAmounts && !isNoiseLine(textWithoutAmounts)) {
          currentDescLines.push(textWithoutAmounts);
        }
      }
    }
  }
  flushTransaction();

  return transactions;
}

// ─── OCBC-specific Parser ─────────────────────────────────────

/** OCBC uses dual dates per transaction: Transaction Date + Value Date (DD MMM DD MMM). */
const OCBC_DUAL_DATE = /^(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i;

/** Parse an OCBC dual-date line and return the transaction date + remaining text. */
function parseOCBCDateLine(line: string, year: number): { date: string; rest: string } | null {
  const m = line.match(OCBC_DUAL_DATE);
  if (!m) return null;
  const day = m[1].padStart(2, "0");
  const month = MONTHS[m[2].toLowerCase().slice(0, 3)] || "01";
  const rest = line.replace(OCBC_DUAL_DATE, "").trim();
  return { date: `${year}-${month}-${day}`, rest };
}

/** Extract clean description from OCBC multi-line transaction detail. */
function cleanOCBCDescription(lines: string[]): { description: string; notes: string | null } {
  if (lines.length === 0) return { description: "Unknown transaction", notes: null };

  const txType = lines[0]; // e.g. "FAST PAYMENT", "NETS QR", "BONUS INTEREST"

  // Look for "to Name" or "from Name" (OCBC style — no colon)
  for (const line of lines) {
    const toMatch = line.match(/^to\s+(.+)/i);
    if (toMatch) {
      return { description: toMatch[1].trim(), notes: txType };
    }
    const fromMatch = line.match(/^from\s+(.+)/i);
    if (fromMatch) {
      return { description: fromMatch[1].trim(), notes: txType };
    }
  }

  // NETS QR: merchant name is the last non-reference, non-"NETS QR" line
  if (/NETS QR/i.test(txType) && lines.length >= 3) {
    for (let i = lines.length - 1; i >= 1; i--) {
      if (!/^\d+$/.test(lines[i]) && !/NETS QR/i.test(lines[i])) {
        return { description: lines[i], notes: txType };
      }
    }
  }

  // Filter noise from notes: OTHR- refs, reference numbers, via PayNow
  const noteLines = lines.slice(1).filter((l) => !/^OTHR[-\s]/i.test(l) && !/^\d{5,}$/.test(l) && !/^via PayNow/i.test(l));

  return {
    description: txType,
    notes: noteLines.length > 0 ? noteLines.join("; ").slice(0, 200) : null,
  };
}

/**
 * Parse OCBC bank statement.
 * Processes pages individually to avoid noise from non-transaction pages (e.g. transaction code reference).
 * Uses balance-diff method for accurate INCOME/EXPENSE detection.
 */
function parseOCBC(pages: string[]): ParsedTransaction[] {
  const allText = pages.join("\n");
  const statementYear = extractStatementYear(allText);
  const transactions: ParsedTransaction[] = [];
  let previousBalance: number | null = null;

  for (const pageText of pages) {
    const lines = pageText.split("\n");

    // Only process pages that contain actual transactions or opening balance
    const hasTransactions = lines.some((l) => OCBC_DUAL_DATE.test(l));
    const hasOpeningBalance = lines.some((l) => /balance b\/f/i.test(l));
    if (!hasTransactions && !hasOpeningBalance) continue;

    let currentDate: string | null = null;
    let lastDate: string | null = null;
    let currentDescLines: string[] = [];
    let currentAmounts: number[] = [];

    const flushTransaction = () => {
      if (currentDate && currentAmounts.length > 0) {
        const { description, notes } = cleanOCBCDescription(currentDescLines);

        let amount: number;
        let statementBalance: number | null = null;
        let type: "INCOME" | "EXPENSE" = "EXPENSE";

        // Last amount is balance; use balance-diff for type detection
        if (currentAmounts.length >= 2) {
          statementBalance = currentAmounts[currentAmounts.length - 1];

          if (previousBalance !== null) {
            const diff = statementBalance - previousBalance;
            type = diff >= 0 ? "INCOME" : "EXPENSE";
            amount = Math.round(Math.abs(diff) * 100) / 100;
          } else {
            amount = currentAmounts[0];
          }

          previousBalance = statementBalance;
        } else {
          amount = currentAmounts[0];
        }

        if (amount > 0) {
          transactions.push({ date: currentDate, description, amount, type, notes, statementBalance });
        }
      }
      lastDate = currentDate || lastDate;
      currentDate = null;
      currentDescLines = [];
      currentAmounts = [];
    };

    for (const line of lines) {
      // Opening balance
      if (/balance b\/f/i.test(line)) {
        const amounts = extractAmounts(line);
        if (amounts.length > 0) previousBalance = amounts[amounts.length - 1];
        continue;
      }

      // Closing balance — skip
      if (/balance c\/f/i.test(line)) continue;

      // Skip noise lines
      if (isNoiseLine(line)) continue;

      const parsed = parseOCBCDateLine(line, statementYear);
      if (parsed) {
        flushTransaction();
        currentDate = parsed.date;

        const amounts = extractAmounts(parsed.rest);
        if (amounts.length > 0) currentAmounts = amounts;

        const descPart = parsed.rest.replace(AMOUNT_RE, "").trim();
        if (descPart) currentDescLines.push(descPart);
      } else if (currentDate || lastDate) {
        const amounts = extractAmounts(line);
        const textWithoutAmounts = line.replace(AMOUNT_RE, "").trim();

        // New transaction on same date (has both amount + balance while current already has them)
        if (amounts.length >= 2 && currentAmounts.length >= 2) {
          flushTransaction();
          currentDate = lastDate;
          currentAmounts = amounts;
          if (textWithoutAmounts && !isNoiseLine(textWithoutAmounts)) {
            currentDescLines.push(textWithoutAmounts);
          }
        } else if (amounts.length > 0 && currentAmounts.length === 0) {
          if (!currentDate) currentDate = lastDate;
          currentAmounts = amounts;
          if (textWithoutAmounts && !isNoiseLine(textWithoutAmounts)) {
            currentDescLines.push(textWithoutAmounts);
          }
        } else if (amounts.length > 0) {
          currentAmounts.push(...amounts);
          if (textWithoutAmounts && !isNoiseLine(textWithoutAmounts)) {
            currentDescLines.push(textWithoutAmounts);
          }
        } else {
          if (textWithoutAmounts && !isNoiseLine(textWithoutAmounts)) {
            currentDescLines.push(textWithoutAmounts);
          }
        }
      }
    }
    flushTransaction();
  }

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
  const statementYear = extractStatementYear(allText);

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

    const date = parseDate(line, statementYear);
    if (date) {
      flushTransaction();
      currentDate = date;

      const amounts = extractAmounts(line);
      if (amounts.length > 0) currentAmounts = amounts;

      const descPart = stripDatePrefix(line).replace(AMOUNT_RE, "").trim();
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
export async function parseBankStatementPDF(file: File, bank: BankFormat = "generic"): Promise<ParsedTransaction[]> {
  const pages = await extractTextFromPDF(file);
  const allText = pages.join("\n");

  switch (bank) {
    case "dbs":
      return parseDBS(allText);
    case "ocbc":
      return parseOCBC(pages);
    case "uob":
    default:
      return parseGeneric(allText);
  }
}
