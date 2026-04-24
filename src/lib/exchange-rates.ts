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
// Covers 30 major currencies for robust offline/multi-currency support
const STATIC_RATES: Record<string, RateMap> = {
  AED: { USD: 0.272, EUR: 0.25, GBP: 0.215, SGD: 0.365, MYR: 1.24, JPY: 41.7, AUD: 0.42, CAD: 0.375, INR: 22.9, CNY: 1.97, CHF: 0.236, HKD: 2.12, KRW: 371, THB: 9.35, NZD: 0.455, PHP: 15.4, IDR: 4430, VND: 6780, TRY: 8.8, ZAR: 4.95, BRL: 1.38, MXN: 4.55, AED: 1 },
  AUD: { USD: 0.65, EUR: 0.595, GBP: 0.51, SGD: 0.87, MYR: 2.95, JPY: 99.5, CAD: 0.89, INR: 54.5, CNY: 4.7, CHF: 0.562, HKD: 5.05, KRW: 884, THB: 22.3, NZD: 1.085, PHP: 36.7, IDR: 10550, VND: 16150, TRY: 21.0, ZAR: 11.8, BRL: 3.28, MXN: 10.8, AED: 2.38, AUD: 1 },
  BRL: { USD: 0.198, EUR: 0.182, GBP: 0.156, SGD: 0.265, MYR: 0.90, JPY: 30.3, AUD: 0.305, CAD: 0.272, INR: 16.6, CNY: 1.43, CHF: 0.171, HKD: 1.54, KRW: 269, THB: 6.78, NZD: 0.33, PHP: 11.2, IDR: 3215, VND: 4925, TRY: 6.38, ZAR: 3.59, MXN: 3.29, AED: 0.725, BRL: 1 },
  CAD: { USD: 0.728, EUR: 0.668, GBP: 0.573, SGD: 0.975, MYR: 3.31, JPY: 111.5, AUD: 1.12, INR: 61.2, CNY: 5.28, CHF: 0.631, HKD: 5.67, KRW: 992, THB: 25.0, NZD: 1.218, PHP: 41.2, IDR: 11830, VND: 18120, TRY: 23.5, ZAR: 13.2, BRL: 3.67, MXN: 12.1, AED: 2.66, CAD: 1 },
  CHF: { USD: 1.154, EUR: 1.059, GBP: 0.908, SGD: 1.545, MYR: 5.25, JPY: 176.5, AUD: 1.778, CAD: 1.585, INR: 86.7, CNY: 7.48, HKD: 8.01, KRW: 1402, THB: 35.3, NZD: 1.722, PHP: 58.3, IDR: 16720, VND: 25620, TRY: 33.2, ZAR: 18.7, BRL: 5.19, MXN: 17.1, AED: 4.23, CHF: 1 },
  CNY: { USD: 0.138, EUR: 0.127, GBP: 0.109, SGD: 0.184, MYR: 0.625, JPY: 21.0, AUD: 0.213, CAD: 0.189, INR: 11.6, CHF: 0.134, HKD: 1.07, KRW: 188, THB: 4.74, NZD: 0.231, PHP: 7.82, IDR: 2240, VND: 3430, TRY: 4.45, ZAR: 2.50, BRL: 0.696, MXN: 2.29, AED: 0.507, CNY: 1 },
  EUR: { USD: 1.09, GBP: 0.857, SGD: 1.46, MYR: 4.95, JPY: 166.5, AUD: 1.68, CAD: 1.50, INR: 82.0, CNY: 7.08, CHF: 0.944, HKD: 8.51, KRW: 1489, THB: 37.5, NZD: 1.83, PHP: 61.9, IDR: 17730, VND: 27170, TRY: 35.2, ZAR: 19.8, BRL: 5.50, MXN: 18.1, AED: 4.00, EUR: 1 },
  GBP: { USD: 1.27, EUR: 1.167, SGD: 1.70, MYR: 5.77, JPY: 194.0, AUD: 1.96, CAD: 1.75, INR: 95.6, CNY: 8.26, CHF: 1.10, HKD: 9.92, KRW: 1736, THB: 43.7, NZD: 2.13, PHP: 72.2, IDR: 20670, VND: 31680, TRY: 41.1, ZAR: 23.1, BRL: 6.42, MXN: 21.1, AED: 4.65, GBP: 1 },
  HKD: { USD: 0.128, EUR: 0.117, GBP: 0.101, SGD: 0.172, MYR: 0.582, JPY: 19.6, AUD: 0.198, CAD: 0.176, INR: 9.63, CNY: 0.832, CHF: 0.125, KRW: 174.8, THB: 4.40, NZD: 0.215, PHP: 7.27, IDR: 2081, VND: 3190, TRY: 4.14, ZAR: 2.33, BRL: 0.648, MXN: 2.13, AED: 0.471, HKD: 1 },
  IDR: { USD: 0.0000615, EUR: 0.0000564, GBP: 0.0000484, SGD: 0.0000824, MYR: 0.000279, JPY: 0.00942, AUD: 0.0000948, CAD: 0.0000845, INR: 0.00462, CNY: 0.000446, CHF: 0.0000598, HKD: 0.000480, KRW: 0.0840, THB: 0.00212, NZD: 0.000103, PHP: 0.00349, VND: 1.53, TRY: 0.00198, ZAR: 0.00112, BRL: 0.000311, MXN: 0.00102, AED: 0.000226, IDR: 1 },
  INR: { USD: 0.0119, EUR: 0.0122, GBP: 0.0105, SGD: 0.0178, MYR: 0.0604, JPY: 2.03, AUD: 0.0183, CAD: 0.0163, CNY: 0.0861, CHF: 0.0115, HKD: 0.104, KRW: 18.15, THB: 0.457, NZD: 0.0223, PHP: 0.755, IDR: 216, VND: 331, TRY: 0.429, ZAR: 0.241, BRL: 0.0671, MXN: 0.221, AED: 0.0487, INR: 1 },
  JPY: { USD: 0.00654, EUR: 0.00601, GBP: 0.00515, SGD: 0.00874, MYR: 0.0297, AUD: 0.01005, CAD: 0.00897, INR: 0.493, CNY: 0.0476, CHF: 0.00567, HKD: 0.0510, KRW: 8.93, THB: 0.225, NZD: 0.0110, PHP: 0.371, IDR: 106, VND: 163, TRY: 0.211, ZAR: 0.119, BRL: 0.0330, MXN: 0.109, AED: 0.0240, JPY: 1 },
  KRW: { USD: 0.000732, EUR: 0.000672, GBP: 0.000576, SGD: 0.000978, MYR: 0.00333, JPY: 0.112, AUD: 0.00113, CAD: 0.00101, INR: 0.0551, CNY: 0.00532, CHF: 0.000713, HKD: 0.00572, THB: 0.0252, NZD: 0.00123, PHP: 0.0416, IDR: 11.9, VND: 18.2, TRY: 0.0236, ZAR: 0.0133, BRL: 0.00370, MXN: 0.0122, AED: 0.00269, KRW: 1 },
  MXN: { USD: 0.0601, EUR: 0.0552, GBP: 0.0474, SGD: 0.0805, MYR: 0.274, JPY: 9.20, AUD: 0.0926, CAD: 0.0826, INR: 4.52, CNY: 0.436, CHF: 0.0585, HKD: 0.469, KRW: 82.1, THB: 2.07, NZD: 0.101, PHP: 3.41, IDR: 975, VND: 1495, TRY: 1.94, ZAR: 1.09, BRL: 0.304, AED: 0.220, MXN: 1 },
  MYR: { USD: 0.22, EUR: 0.202, GBP: 0.173, SGD: 0.294, JPY: 33.7, AUD: 0.339, CAD: 0.302, INR: 16.6, CNY: 1.60, CHF: 0.190, HKD: 1.72, KRW: 301, THB: 7.57, NZD: 0.369, PHP: 12.5, IDR: 3570, VND: 5470, TRY: 7.10, ZAR: 3.99, BRL: 1.11, MXN: 3.65, AED: 0.806, MYR: 1 },
  NZD: { USD: 0.598, EUR: 0.547, GBP: 0.469, SGD: 0.797, MYR: 2.71, JPY: 91.0, AUD: 0.922, CAD: 0.821, INR: 45.0, CNY: 4.33, CHF: 0.580, HKD: 4.65, KRW: 815, THB: 20.5, PHP: 33.8, IDR: 9660, VND: 14810, TRY: 19.2, ZAR: 10.8, BRL: 3.01, MXN: 9.92, AED: 2.19, NZD: 1 },
  PHP: { USD: 0.0177, EUR: 0.0162, GBP: 0.0139, SGD: 0.0236, MYR: 0.0801, JPY: 2.69, AUD: 0.0272, CAD: 0.0243, INR: 1.32, CNY: 0.128, CHF: 0.0171, HKD: 0.137, KRW: 24.0, THB: 0.605, NZD: 0.0296, IDR: 286, VND: 439, TRY: 0.568, ZAR: 0.320, BRL: 0.0891, MXN: 0.293, AED: 0.0649, PHP: 1 },
  SGD: { USD: 0.75, EUR: 0.685, GBP: 0.588, MYR: 3.40, JPY: 114.5, AUD: 1.15, CAD: 1.025, INR: 56.2, CNY: 5.43, CHF: 0.647, HKD: 5.82, KRW: 1021, THB: 25.7, NZD: 1.255, PHP: 42.3, IDR: 12100, VND: 18550, TRY: 24.1, ZAR: 13.6, BRL: 3.77, MXN: 12.4, AED: 2.74, SGD: 1 },
  THB: { USD: 0.0292, EUR: 0.0267, GBP: 0.0229, SGD: 0.0389, MYR: 0.132, JPY: 4.45, AUD: 0.0448, CAD: 0.0400, INR: 2.19, CNY: 0.211, CHF: 0.0283, HKD: 0.227, KRW: 39.7, NZD: 0.0488, PHP: 1.65, IDR: 471, VND: 722, TRY: 0.936, ZAR: 0.527, BRL: 0.147, MXN: 0.483, AED: 0.107, THB: 1 },
  TRY: { USD: 0.0312, EUR: 0.0284, GBP: 0.0243, SGD: 0.0415, MYR: 0.141, JPY: 4.74, AUD: 0.0476, CAD: 0.0426, INR: 2.33, CNY: 0.225, CHF: 0.0301, HKD: 0.242, KRW: 42.4, THB: 1.07, NZD: 0.0521, PHP: 1.76, IDR: 504, VND: 772, ZAR: 0.563, BRL: 0.157, MXN: 0.516, AED: 0.114, TRY: 1 },
  USD: { EUR: 0.918, GBP: 0.787, SGD: 1.34, MYR: 4.55, JPY: 153.0, AUD: 1.54, CAD: 1.37, INR: 84.0, CNY: 7.25, CHF: 0.867, HKD: 7.80, KRW: 1368, THB: 34.4, NZD: 1.67, PHP: 56.5, IDR: 16150, VND: 24750, TRY: 32.1, ZAR: 18.1, BRL: 5.05, MXN: 16.6, AED: 3.68, USD: 1 },
  VND: { USD: 0.0000404, EUR: 0.0000368, GBP: 0.0000316, SGD: 0.0000539, MYR: 0.000183, JPY: 0.00614, AUD: 0.0000619, CAD: 0.0000552, INR: 0.00302, CNY: 0.000292, CHF: 0.0000390, HKD: 0.000313, KRW: 0.0549, THB: 0.00139, NZD: 0.0000675, PHP: 0.00228, IDR: 0.653, TRY: 0.00130, ZAR: 0.000731, BRL: 0.000203, MXN: 0.000669, AED: 0.000147, VND: 1 },
  ZAR: { USD: 0.0553, EUR: 0.0505, GBP: 0.0433, SGD: 0.0735, MYR: 0.251, JPY: 8.40, AUD: 0.0847, CAD: 0.0756, INR: 4.15, CNY: 0.400, CHF: 0.0535, HKD: 0.429, KRW: 75.3, THB: 1.90, NZD: 0.0926, PHP: 3.13, IDR: 895, VND: 1370, TRY: 1.78, BRL: 0.495, MXN: 1.63, AED: 0.362, ZAR: 1 },
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
