/**
 * Lorcast API client (https://lorcast.com).
 *
 * Lorcast is the standard free Disney Lorcana TCG card data provider, exposing
 * TCGPlayer USD prices that update once per day. We follow their guidance:
 *   - 100ms minimum delay between requests
 *   - Cache results for at least 24h
 *   - Tolerate failures gracefully (UI must not break on outage)
 *
 * Endpoints used:
 *   GET /v0/sets                       → list of sets
 *   GET /v0/sets/{code}/cards          → all cards in a set
 *   GET /v0/cards/search?q={query}     → free-text search
 *   GET /v0/cards/{id}                 → single card
 */

const API_BASE = "https://api.lorcast.com/v0";
const REQUEST_SPACING_MS = 110; // > 100ms per Lorcast rate-limit guidance
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h matches Lorcast's price update cadence

// ─── Types (subset of Lorcast response we care about) ────────────────

export interface LorcastSet {
  id: string;
  code: string;
  name: string;
  released_at?: string;
}

export interface LorcastCard {
  id: string;
  name: string;
  version?: string | null;
  collector_number: string;
  rarity?: string;
  ink_cost?: number;
  type?: string[];
  ink?: string;
  set: { code: string; name: string };
  image_uris?: {
    digital?: { small?: string; normal?: string; large?: string };
  };
  prices?: { usd?: string | null; usd_foil?: string | null };
  tcgplayer_id?: number;
}

interface ListResponse<T> {
  results: T[];
  has_more?: boolean;
  next_page?: string | null;
}

// ─── Throttle + cache ────────────────────────────────────────────────

let nextRequestAt = 0;
async function throttle() {
  const now = Date.now();
  const wait = nextRequestAt - now;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  nextRequestAt = Date.now() + REQUEST_SPACING_MS;
}

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}
const cache = new Map<string, CacheEntry<unknown>>();

async function cachedFetch<T>(url: string, ttlMs = CACHE_TTL_MS): Promise<T | null> {
  const cached = cache.get(url) as CacheEntry<T> | undefined;
  if (cached && Date.now() - cached.fetchedAt < ttlMs) return cached.data;

  await throttle();
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      // Next.js data-cache layer in addition to our in-memory cache
      next: { revalidate: 60 * 60 * 24 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as T;
    cache.set(url, { data, fetchedAt: Date.now() });
    return data;
  } catch {
    return null;
  }
}

// ─── Public API ──────────────────────────────────────────────────────

export async function getAllSets(): Promise<LorcastSet[]> {
  const data = await cachedFetch<ListResponse<LorcastSet>>(`${API_BASE}/sets`);
  return data?.results ?? [];
}

export async function getCardsBySetCode(code: string): Promise<LorcastCard[]> {
  // Lorcast supports pagination; iterate until exhausted.
  const cards: LorcastCard[] = [];
  let url: string | null = `${API_BASE}/sets/${encodeURIComponent(code)}/cards`;
  while (url) {
    const data: ListResponse<LorcastCard> | null = await cachedFetch<ListResponse<LorcastCard>>(url);
    if (!data) break;
    cards.push(...(data.results ?? []));
    url = data.has_more && data.next_page ? data.next_page : null;
  }
  return cards;
}

export async function searchCards(query: string): Promise<LorcastCard[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const data = await cachedFetch<ListResponse<LorcastCard>>(`${API_BASE}/cards/search?q=${encodeURIComponent(trimmed)}`);
  return data?.results ?? [];
}

export async function getCardById(id: string): Promise<LorcastCard | null> {
  return await cachedFetch<LorcastCard>(`${API_BASE}/cards/${encodeURIComponent(id)}`);
}

// ─── Helpers ─────────────────────────────────────────────────────────

export function parsePrice(value: string | null | undefined): string | null {
  if (!value) return null;
  const n = parseFloat(value);
  if (!isFinite(n) || n < 0) return null;
  return n.toFixed(2);
}

/** Best display name combining card name + version subtitle. */
export function fullCardName(card: { name: string; subtitle?: string | null }): string {
  return card.subtitle ? `${card.name} – ${card.subtitle}` : card.name;
}
