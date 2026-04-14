// Singapore Individual Income Tax Calculator (YA 2024 onwards)
// Source: IRAS - https://www.iras.gov.sg/taxes/individual-income-tax

// Progressive tax brackets for Singapore tax residents (YA 2024+)
const SG_TAX_BRACKETS = [
  { upTo: 20_000, rate: 0 },
  { upTo: 30_000, rate: 0.02 },
  { upTo: 40_000, rate: 0.035 },
  { upTo: 80_000, rate: 0.07 },
  { upTo: 120_000, rate: 0.115 },
  { upTo: 160_000, rate: 0.15 },
  { upTo: 200_000, rate: 0.18 },
  { upTo: 240_000, rate: 0.19 },
  { upTo: 280_000, rate: 0.195 },
  { upTo: 320_000, rate: 0.2 },
  { upTo: 500_000, rate: 0.22 },
  { upTo: 1_000_000, rate: 0.23 },
  { upTo: Infinity, rate: 0.24 },
] as const;

// Earned Income Relief amounts by age group
const EARNED_INCOME_RELIEF = {
  below55: 1_000,
  age55to59: 6_000,
  age60plus: 8_000,
} as const;

// CPF rates (2026: employee ≤55 years old)
const CPF_EMPLOYEE_RATE = 0.2;
const CPF_OW_CEILING_MONTHLY = 8_000; // From Jan 2026
const CPF_ANNUAL_CEILING = 102_000; // Total OW + AW ceiling

// Personal relief cap
const PERSONAL_RELIEF_CAP = 80_000;

export interface TaxInput {
  annualIncome: number;
  ageGroup: "below55" | "age55to59" | "age60plus";
  isCpfContributor: boolean;
  srsContribution?: number; // SRS top-up amount
  cpfCashTopUp?: number; // CPF cash top-up
  spouseRelief?: boolean;
  parentRelief?: number; // total parent relief claimed
  additionalReliefs?: number; // any other reliefs
}

export interface TaxResult {
  grossIncome: number;
  totalReliefs: number;
  chargeableIncome: number;
  taxPayable: number;
  effectiveRate: number;
  monthlyTax: number;
  reliefBreakdown: { name: string; amount: number }[];
  bracketBreakdown: { bracket: string; income: number; tax: number; rate: number }[];
  takeHomeAfterTax: number;
  takeHomeMonthly: number;
}

function calculateCpfRelief(annualIncome: number): number {
  // Employee CPF contribution: 20% of wages up to OW ceiling
  const monthlyIncome = annualIncome / 12;
  const cappedMonthlyOW = Math.min(monthlyIncome, CPF_OW_CEILING_MONTHLY);
  const annualOW = cappedMonthlyOW * 12;

  // Additional wages (bonuses etc) - simplified: remaining income up to annual ceiling
  const totalSubjectToCpf = Math.min(annualIncome, CPF_ANNUAL_CEILING);
  const awSubject = Math.max(totalSubjectToCpf - annualOW, 0);

  const cpfEmployee = (annualOW + awSubject) * CPF_EMPLOYEE_RATE;
  return Math.round(cpfEmployee * 100) / 100;
}

function calculateProgressiveTax(chargeableIncome: number): { total: number; breakdown: TaxResult["bracketBreakdown"] } {
  let remaining = chargeableIncome;
  let total = 0;
  let prevUpTo = 0;
  const breakdown: TaxResult["bracketBreakdown"] = [];

  for (const bracket of SG_TAX_BRACKETS) {
    if (remaining <= 0) break;

    const bracketSize = bracket.upTo === Infinity ? remaining : bracket.upTo - prevUpTo;
    const taxableInBracket = Math.min(remaining, bracketSize);
    const taxForBracket = taxableInBracket * bracket.rate;

    if (taxableInBracket > 0) {
      const label = bracket.upTo === Infinity ? `Above $${prevUpTo.toLocaleString()}` : `$${prevUpTo.toLocaleString()} – $${bracket.upTo.toLocaleString()}`;

      breakdown.push({
        bracket: label,
        income: Math.round(taxableInBracket * 100) / 100,
        tax: Math.round(taxForBracket * 100) / 100,
        rate: bracket.rate * 100,
      });
    }

    total += taxForBracket;
    remaining -= taxableInBracket;
    prevUpTo = bracket.upTo;
  }

  return { total: Math.round(total * 100) / 100, breakdown };
}

export function calculateSGTax(input: TaxInput): TaxResult {
  const reliefBreakdown: { name: string; amount: number }[] = [];

  // 1. Earned Income Relief (auto-granted)
  const eirAmount = EARNED_INCOME_RELIEF[input.ageGroup];
  const earnedIncomeRelief = Math.min(eirAmount, input.annualIncome);
  reliefBreakdown.push({ name: "Earned Income Relief", amount: earnedIncomeRelief });

  // 2. CPF Relief (employee's mandatory contribution)
  let cpfRelief = 0;
  if (input.isCpfContributor) {
    cpfRelief = calculateCpfRelief(input.annualIncome);
    reliefBreakdown.push({ name: "CPF Relief (Employee)", amount: cpfRelief });
  }

  // 3. SRS Relief (up to $15,300 for citizens/PR)
  if (input.srsContribution && input.srsContribution > 0) {
    const srs = Math.min(input.srsContribution, 15_300);
    reliefBreakdown.push({ name: "SRS Relief", amount: srs });
  }

  // 4. CPF Cash Top-up Relief (up to $16,000: $8,000 self + $8,000 family)
  if (input.cpfCashTopUp && input.cpfCashTopUp > 0) {
    const topUp = Math.min(input.cpfCashTopUp, 16_000);
    reliefBreakdown.push({ name: "CPF Cash Top-up Relief", amount: topUp });
  }

  // 5. Spouse Relief
  if (input.spouseRelief) {
    reliefBreakdown.push({ name: "Spouse Relief", amount: 2_000 });
  }

  // 6. Parent Relief
  if (input.parentRelief && input.parentRelief > 0) {
    reliefBreakdown.push({ name: "Parent Relief", amount: input.parentRelief });
  }

  // 7. Additional reliefs
  if (input.additionalReliefs && input.additionalReliefs > 0) {
    reliefBreakdown.push({ name: "Other Reliefs", amount: input.additionalReliefs });
  }

  // Total reliefs (capped at $80,000)
  const rawTotalReliefs = reliefBreakdown.reduce((s, r) => s + r.amount, 0);
  const totalReliefs = Math.min(rawTotalReliefs, PERSONAL_RELIEF_CAP);

  // Chargeable income
  const chargeableIncome = Math.max(input.annualIncome - totalReliefs, 0);

  // Calculate progressive tax
  const { total: taxPayable, breakdown: bracketBreakdown } = calculateProgressiveTax(chargeableIncome);

  const effectiveRate = input.annualIncome > 0 ? (taxPayable / input.annualIncome) * 100 : 0;
  const monthlyTax = taxPayable / 12;
  const takeHomeAfterTax = input.annualIncome - taxPayable - cpfRelief;
  const takeHomeMonthly = takeHomeAfterTax / 12;

  return {
    grossIncome: input.annualIncome,
    totalReliefs,
    chargeableIncome,
    taxPayable: Math.round(taxPayable * 100) / 100,
    effectiveRate: Math.round(effectiveRate * 100) / 100,
    monthlyTax: Math.round(monthlyTax * 100) / 100,
    reliefBreakdown,
    bracketBreakdown,
    takeHomeAfterTax: Math.round(takeHomeAfterTax * 100) / 100,
    takeHomeMonthly: Math.round(takeHomeMonthly * 100) / 100,
  };
}

export { SG_TAX_BRACKETS, EARNED_INCOME_RELIEF, PERSONAL_RELIEF_CAP, CPF_EMPLOYEE_RATE, CPF_OW_CEILING_MONTHLY, CPF_ANNUAL_CEILING };
