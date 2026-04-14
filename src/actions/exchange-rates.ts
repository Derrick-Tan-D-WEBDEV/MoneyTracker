"use server";

import { getExchangeRates as fetchRates, type RateMap } from "@/lib/exchange-rates";

/**
 * Server action to get exchange rates for a base currency.
 * Can be called from client components.
 */
export async function getExchangeRates(base: string): Promise<RateMap> {
  return fetchRates(base);
}
