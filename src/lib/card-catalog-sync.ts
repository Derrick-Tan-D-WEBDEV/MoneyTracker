/**
 * Card catalog sync service.
 *
 * - syncLorcanaCatalog(): full sync — iterate all Lorcana sets, upsert every card.
 * - refreshLorcanaPrices(): lighter pass — refresh prices for cards already in catalog,
 *   and write a daily CardPriceSnapshot row per card+finish.
 *
 * Both functions are idempotent and safe to re-run. They never throw on network errors —
 * they return counters so callers can surface partial results.
 */

import { db } from "@/lib/db";
import { CardGame, CardFinish } from "@/generated/prisma/enums";
import { getAllSets, getCardsBySetCode, getCardById, parsePrice, type LorcastCard } from "@/lib/lorcast";

interface SyncResult {
  setsProcessed: number;
  cardsUpserted: number;
  pricesRecorded: number;
  errors: string[];
}

function startOfUtcDay(d = new Date()): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

/** Map a Lorcast card → fields we persist in CardCatalog. */
function mapCardToCatalog(card: LorcastCard) {
  const ink = typeof card.cost === "number" ? card.cost : typeof card.ink_cost === "number" ? card.ink_cost : null;
  const cardType = Array.isArray(card.type) ? card.type.join(", ") : typeof card.type === "string" ? card.type : null;
  return {
    game: CardGame.LORCANA,
    externalId: card.id,
    setCode: card.set.code,
    setName: card.set.name,
    cardNumber: card.collector_number,
    name: card.name,
    subtitle: card.version ?? null,
    rarity: card.rarity ?? null,
    inkCost: ink,
    cardType,
    ink: card.ink ?? null,
    imageSmall: card.image_uris?.digital?.small ?? null,
    imageNormal: card.image_uris?.digital?.normal ?? null,
    priceUsd: parsePrice(card.prices?.usd),
    priceUsdFoil: parsePrice(card.prices?.usd_foil),
    lastPricedAt: new Date(),
  };
}

/** Record a daily price snapshot if the catalog row has a price. Dedupes by (card, finish, day). */
async function recordPriceSnapshots(catalogId: string, priceUsd: string | null, priceUsdFoil: string | null): Promise<number> {
  const today = startOfUtcDay();
  let recorded = 0;

  if (priceUsd) {
    await db.cardPriceSnapshot.upsert({
      where: { catalogId_finish_recordedOn: { catalogId, finish: CardFinish.NORMAL, recordedOn: today } },
      update: { priceUsd },
      create: { catalogId, finish: CardFinish.NORMAL, priceUsd, recordedOn: today },
    });
    recorded++;
  }
  if (priceUsdFoil) {
    await db.cardPriceSnapshot.upsert({
      where: { catalogId_finish_recordedOn: { catalogId, finish: CardFinish.FOIL, recordedOn: today } },
      update: { priceUsd: priceUsdFoil },
      create: { catalogId, finish: CardFinish.FOIL, priceUsd: priceUsdFoil, recordedOn: today },
    });
    recorded++;
  }
  return recorded;
}

/**
 * Full catalog sync — fetches all Lorcana sets and upserts every card.
 * Use on first install or when new sets release.
 */
export async function syncLorcanaCatalog(): Promise<SyncResult> {
  const result: SyncResult = { setsProcessed: 0, cardsUpserted: 0, pricesRecorded: 0, errors: [] };

  const sets = await getAllSets();
  if (sets.length === 0) {
    result.errors.push("Lorcast returned no sets (network or API issue)");
    return result;
  }

  for (const set of sets) {
    try {
      const cards = await getCardsBySetCode(set.code);
      for (const card of cards) {
        const data = mapCardToCatalog(card);
        const upserted = await db.cardCatalog.upsert({
          where: { externalId: card.id },
          update: data,
          create: data,
        });
        result.cardsUpserted++;
        result.pricesRecorded += await recordPriceSnapshots(upserted.id, data.priceUsd, data.priceUsdFoil);
      }
      result.setsProcessed++;
    } catch (e) {
      result.errors.push(`set ${set.code}: ${(e as Error).message}`);
    }
  }
  return result;
}

/**
 * Refresh prices only — re-fetches each card already in the catalog by external id,
 * updates priceUsd/priceUsdFoil/lastPricedAt, and writes a daily snapshot row.
 *
 * @param scope - if "user", only refreshes cards present in this user's collection
 */
export async function refreshLorcanaPrices(opts?: { userId?: string }): Promise<SyncResult> {
  const result: SyncResult = { setsProcessed: 0, cardsUpserted: 0, pricesRecorded: 0, errors: [] };

  const where = opts?.userId ? { game: CardGame.LORCANA, collectionItems: { some: { userId: opts.userId } } } : { game: CardGame.LORCANA };

  const rows = await db.cardCatalog.findMany({ where, select: { id: true, externalId: true } });
  if (rows.length === 0) return result;

  for (const row of rows) {
    try {
      const card = await getCardById(row.externalId);
      if (!card) continue;
      const priceUsd = parsePrice(card.prices?.usd);
      const priceUsdFoil = parsePrice(card.prices?.usd_foil);
      await db.cardCatalog.update({
        where: { id: row.id },
        data: { priceUsd, priceUsdFoil, lastPricedAt: new Date() },
      });
      result.cardsUpserted++;
      result.pricesRecorded += await recordPriceSnapshots(row.id, priceUsd, priceUsdFoil);
    } catch (e) {
      result.errors.push(`card ${row.externalId}: ${(e as Error).message}`);
    }
  }
  return result;
}

/** Prune CardPriceSnapshot rows older than `days` (default 365). */
export async function pruneOldPriceSnapshots(days = 365): Promise<number> {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  cutoff.setUTCHours(0, 0, 0, 0);
  const { count } = await db.cardPriceSnapshot.deleteMany({ where: { recordedOn: { lt: cutoff } } });
  return count;
}
