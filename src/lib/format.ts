const CURRENCY_LOCALES: Record<string, string> = {
  MYR: "ms-MY",
  SGD: "en-SG",
  USD: "en-US",
  EUR: "de-DE",
  GBP: "en-GB",
  JPY: "ja-JP",
  AUD: "en-AU",
  CAD: "en-CA",
  INR: "en-IN",
  CNY: "zh-CN",
};

/**
 * Create a currency formatter using user's preferred currency.
 * Usage: const fmt = currencyFormatter("MYR"); fmt(1234.56) => "RM1,235"
 */
export function currencyFormatter(currency = "USD") {
  const locale = CURRENCY_LOCALES[currency] || "en-US";
  return (value: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
}

/** Fixed USD formatter for backward compat */
export function formatCurrency(value: number) {
  return currencyFormatter("USD")(value);
}
