/**
 * Exchange rate fetcher with in-memory caching.
 * Uses the free exchangerate-api.com (no key required for open endpoint).
 * Falls back to static rates if API is unavailable.
 */

export type RateMap = Record<string, number>;

interface CacheEntry {
  rates: RateMap;
  fetchedAt: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const rateCache = new Map<string, CacheEntry>();

// Fallback static rates (approximate, updated April 2026)
const STATIC_RATES: Record<string, RateMap> = {
  MYR: { USD: 0.22, EUR: 0.2, GBP: 0.17, SGD: 0.29, JPY: 33.5, AUD: 0.34, CAD: 0.31, INR: 18.5, CNY: 1.58, MYR: 1 },
  SGD: { USD: 0.75, EUR: 0.69, GBP: 0.59, MYR: 3.45, JPY: 115, AUD: 1.16, CAD: 1.05, INR: 63.5, CNY: 5.45, SGD: 1 },
  USD: { EUR: 0.92, GBP: 0.79, MYR: 4.55, SGD: 1.34, JPY: 153, AUD: 1.54, CAD: 1.37, INR: 84, CNY: 7.25, USD: 1 },
};

/**
 * Fetch exchange rates for a base currency.
 * Returns a map of currency code → rate (how many units of target per 1 base).
 */
export async function getExchangeRates(base: string): Promise<RateMap> {
  const cached = rateCache.get(base);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.rates;
  }

  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${base}`, {
      next: { revalidate: 3600 },
    });

    if (!res.ok) throw new Error(`API returned ${res.status}`);

    const data = await res.json();
    if (data.result !== "success") throw new Error("API error");

    const rates: RateMap = data.rates;
    rateCache.set(base, { rates, fetchedAt: Date.now() });
    return rates;
  } catch {
    // Fall back to static rates
    if (STATIC_RATES[base]) {
      return { [base]: 1, ...STATIC_RATES[base] };
    }
    // If we have no static rates for this base, return identity
    return { [base]: 1 };
  }
}

/**
 * Convert an amount from one currency to another using a pre-fetched rate map.
 * The rateMap should be keyed from the `from` currency's perspective.
 */
export function convertCurrency(amount: number, from: string, to: string, rateMap: RateMap): number {
  if (from === to) return amount;

  const fromRate = rateMap[from];
  const toRate = rateMap[to];

  // Both rates available — use cross-rate formula (works regardless of which currency the map is based on)
  if (fromRate && toRate) {
    return (amount * toRate) / fromRate;
  }

  // Only target rate: rateMap is based on `from`, so multiply
  if (toRate) {
    return amount * toRate;
  }

  // Only source rate: rateMap is based on `to`, so divide
  if (fromRate) {
    return amount / fromRate;
  }

  // No conversion possible — return as-is
  return amount;
}
