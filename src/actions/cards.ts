"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewUserId } from "@/lib/partner-view";
import { getEncryptionKey, encrypt, decrypt, encryptAmount, decryptAmount } from "@/lib/encryption";
import { CardGame, CardFinish, CardCondition } from "@/generated/prisma/enums";
import { searchCards as lorcastSearchCards, getCardById, parsePrice, fullCardName } from "@/lib/lorcast";
import { syncLorcanaCatalog, refreshLorcanaPrices } from "@/lib/card-catalog-sync";
import Papa from "papaparse";

// ─── Schemas ─────────────────────────────────────────────────────────

const collectionItemSchema = z.object({
  catalogId: z.string().uuid(),
  finish: z.enum(["NORMAL", "FOIL", "ENCHANTED"]).default("NORMAL"),
  condition: z.enum(["NM", "LP", "MP", "HP", "DMG"]).default("NM"),
  language: z.string().default("EN"),
  quantity: z.number().int().min(1).max(100000),
  acquiredPrice: z.number().min(0),
  currency: z.string().default("USD"),
  acquiredDate: z
    .string()
    .optional()
    .nullable()
    .transform((s) => (s ? new Date(s) : null)),
  notes: z.string().optional().nullable(),
});

const wishlistItemSchema = z.object({
  catalogId: z.string().uuid(),
  finish: z.enum(["NORMAL", "FOIL", "ENCHANTED"]).default("NORMAL"),
  targetMaxPrice: z.number().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
});

// ─── Catalog read / search ───────────────────────────────────────────

export type CatalogCard = {
  id: string;
  externalId: string;
  setCode: string;
  setName: string;
  cardNumber: string;
  name: string;
  subtitle: string | null;
  rarity: string | null;
  inkCost: number | null;
  cardType: string | null;
  ink: string | null;
  imageSmall: string | null;
  imageNormal: string | null;
  priceUsd: number | null;
  priceUsdFoil: number | null;
  lastPricedAt: string | null;
};

function toCatalogCard(row: {
  id: string;
  externalId: string;
  setCode: string;
  setName: string;
  cardNumber: string;
  name: string;
  subtitle: string | null;
  rarity: string | null;
  inkCost: number | null;
  cardType: string | null;
  ink: string | null;
  imageSmall: string | null;
  imageNormal: string | null;
  priceUsd: string | null;
  priceUsdFoil: string | null;
  lastPricedAt: Date | null;
}): CatalogCard {
  return {
    id: row.id,
    externalId: row.externalId,
    setCode: row.setCode,
    setName: row.setName,
    cardNumber: row.cardNumber,
    name: row.name,
    subtitle: row.subtitle,
    rarity: row.rarity,
    inkCost: row.inkCost,
    cardType: row.cardType,
    ink: row.ink,
    imageSmall: row.imageSmall,
    imageNormal: row.imageNormal,
    priceUsd: row.priceUsd ? parseFloat(row.priceUsd) : null,
    priceUsdFoil: row.priceUsdFoil ? parseFloat(row.priceUsdFoil) : null,
    lastPricedAt: row.lastPricedAt?.toISOString() ?? null,
  };
}

/** True if the catalog is empty for this game — UI calls this to show first-run banner. */
export async function isCatalogEmpty(game: CardGame = CardGame.LORCANA): Promise<boolean> {
  // Read-only / public — does not require auth.
  const count = await db.cardCatalog.count({ where: { game } });
  return count === 0;
}

/** Trigger a full Lorcana catalog sync. Authenticated users only. */
export async function syncCatalog() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const result = await syncLorcanaCatalog();
  revalidatePath("/cards");
  return result;
}

/** List distinct sets in the catalog. */
export async function listSets(game: CardGame = CardGame.LORCANA): Promise<{ code: string; name: string; count: number }[]> {
  const grouped = await db.cardCatalog.groupBy({
    by: ["setCode", "setName"],
    where: { game },
    _count: { _all: true },
  });
  return grouped.map((g) => ({ code: g.setCode, name: g.setName, count: g._count._all })).sort((a, b) => a.code.localeCompare(b.code));
}

/** List cards in a set. */
export async function listCardsInSet(setCode: string, game: CardGame = CardGame.LORCANA): Promise<CatalogCard[]> {
  const rows = await db.cardCatalog.findMany({
    where: { game, setCode },
    orderBy: [{ cardNumber: "asc" }],
    take: 1000,
  });
  return rows.map(toCatalogCard);
}

/** Catalog search — local DB first, falls back to Lorcast (and upserts results). */
export async function searchCatalog(query: string, opts?: { setCode?: string; limit?: number }): Promise<CatalogCard[]> {
  const trimmed = query.trim();
  const limit = opts?.limit ?? 50;
  if (trimmed.length < 2) return [];

  const where: Record<string, unknown> = {
    game: CardGame.LORCANA,
    name: { contains: trimmed, mode: "insensitive" },
  };
  if (opts?.setCode) where.setCode = opts.setCode;

  const local = await db.cardCatalog.findMany({
    where,
    orderBy: [{ setCode: "asc" }, { cardNumber: "asc" }],
    take: limit,
  });

  if (local.length >= 3) return local.map(toCatalogCard);

  // Fall back to Lorcast and upsert any new finds
  const remote = await lorcastSearchCards(trimmed);
  if (remote.length === 0) return local.map(toCatalogCard);

  const upserted: CatalogCard[] = [];
  for (const c of remote) {
    if (opts?.setCode && c.set.code !== opts.setCode) continue;
    const data = {
      game: CardGame.LORCANA,
      externalId: c.id,
      setCode: c.set.code,
      setName: c.set.name,
      cardNumber: c.collector_number,
      name: c.name,
      subtitle: c.version ?? null,
      rarity: c.rarity ?? null,
      inkCost: typeof c.cost === "number" ? c.cost : typeof c.ink_cost === "number" ? c.ink_cost : null,
      cardType: Array.isArray(c.type) ? c.type.join(", ") : typeof c.type === "string" ? c.type : null,
      ink: c.ink ?? null,
      imageSmall: c.image_uris?.digital?.small ?? null,
      imageNormal: c.image_uris?.digital?.normal ?? null,
      priceUsd: parsePrice(c.prices?.usd),
      priceUsdFoil: parsePrice(c.prices?.usd_foil),
      lastPricedAt: new Date(),
    };
    const row = await db.cardCatalog.upsert({
      where: { externalId: c.id },
      update: data,
      create: data,
    });
    upserted.push(toCatalogCard(row));
  }
  // Merge results, deduping by id
  const merged = new Map<string, CatalogCard>();
  for (const r of [...local.map(toCatalogCard), ...upserted]) merged.set(r.id, r);
  return Array.from(merged.values()).slice(0, limit);
}

// ─── Collection (per-user, encrypted) ────────────────────────────────

export type CollectionItem = {
  id: string;
  catalog: CatalogCard;
  finish: CardFinish;
  condition: CardCondition;
  language: string;
  quantity: number;
  acquiredPrice: number;
  currency: string;
  acquiredDate: string | null;
  notes: string | null;
  // computed
  unitMarketUsd: number | null;
  totalMarketUsd: number | null;
  gainLossUsd: number | null;
  createdAt: string;
};

export async function getCollection(): Promise<CollectionItem[]> {
  const userId = await getViewUserId();
  const encKey = await getEncryptionKey();

  const rows = await db.cardCollectionItem.findMany({
    where: { userId },
    include: { catalog: true },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((r) => {
    const catalog = toCatalogCard(r.catalog);
    const quantity = decryptAmount(r.quantity, encKey);
    const acquiredPrice = decryptAmount(r.acquiredPrice, encKey);
    const unitMarketUsd = r.finish === CardFinish.FOIL ? catalog.priceUsdFoil : r.finish === CardFinish.ENCHANTED ? (catalog.priceUsdFoil ?? catalog.priceUsd) : catalog.priceUsd;
    const totalMarketUsd = unitMarketUsd != null ? unitMarketUsd * quantity : null;
    const gainLossUsd = totalMarketUsd != null ? totalMarketUsd - acquiredPrice * quantity : null;
    return {
      id: r.id,
      catalog,
      finish: r.finish,
      condition: r.condition,
      language: r.language,
      quantity,
      acquiredPrice,
      currency: r.currency,
      acquiredDate: r.acquiredDate?.toISOString() ?? null,
      notes: r.notes ? decrypt(r.notes, encKey) : null,
      unitMarketUsd,
      totalMarketUsd,
      gainLossUsd,
      createdAt: r.createdAt.toISOString(),
    };
  });
}

export async function addCollectionItem(input: z.input<typeof collectionItemSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const encKey = await getEncryptionKey();
  const parsed = collectionItemSchema.parse(input);

  // Verify catalog row exists
  const catalog = await db.cardCatalog.findUnique({ where: { id: parsed.catalogId } });
  if (!catalog) throw new Error("Card not found in catalog");

  const item = await db.cardCollectionItem.create({
    data: {
      userId: session.user.id,
      catalogId: parsed.catalogId,
      finish: parsed.finish,
      condition: parsed.condition,
      language: parsed.language,
      quantity: encryptAmount(parsed.quantity, encKey),
      acquiredPrice: encryptAmount(parsed.acquiredPrice, encKey),
      currency: parsed.currency,
      acquiredDate: parsed.acquiredDate,
      notes: parsed.notes ? encrypt(parsed.notes, encKey) : null,
    },
  });

  revalidatePath("/");
  revalidatePath("/cards");
  return { id: item.id };
}

export async function updateCollectionItem(id: string, input: z.input<typeof collectionItemSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const encKey = await getEncryptionKey();

  const existing = await db.cardCollectionItem.findFirst({ where: { id, userId: session.user.id } });
  if (!existing) throw new Error("Card not found");

  const parsed = collectionItemSchema.parse(input);
  await db.cardCollectionItem.update({
    where: { id },
    data: {
      catalogId: parsed.catalogId,
      finish: parsed.finish,
      condition: parsed.condition,
      language: parsed.language,
      quantity: encryptAmount(parsed.quantity, encKey),
      acquiredPrice: encryptAmount(parsed.acquiredPrice, encKey),
      currency: parsed.currency,
      acquiredDate: parsed.acquiredDate,
      notes: parsed.notes ? encrypt(parsed.notes, encKey) : null,
    },
  });

  revalidatePath("/");
  revalidatePath("/cards");
}

export async function deleteCollectionItem(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const existing = await db.cardCollectionItem.findFirst({ where: { id, userId: session.user.id } });
  if (!existing) throw new Error("Card not found");

  await db.cardCollectionItem.delete({ where: { id } });

  revalidatePath("/");
  revalidatePath("/cards");
}

// ─── Price history ───────────────────────────────────────────────────

export type PriceHistoryPoint = { date: string; priceUsd: number; finish: CardFinish };

export async function getCardPriceHistory(catalogId: string, days = 180): Promise<PriceHistoryPoint[]> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  since.setUTCHours(0, 0, 0, 0);

  const rows = await db.cardPriceSnapshot.findMany({
    where: { catalogId, recordedOn: { gte: since } },
    orderBy: { recordedOn: "asc" },
  });

  return rows.map((r) => ({
    date: r.recordedOn.toISOString().slice(0, 10),
    priceUsd: parseFloat(r.priceUsd),
    finish: r.finish,
  }));
}

// ─── Refresh prices for the user's collection ────────────────────────

export async function refreshCollectionPrices() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const result = await refreshLorcanaPrices({ userId: session.user.id });
  revalidatePath("/");
  revalidatePath("/cards");
  return result;
}

// ─── Wishlist ────────────────────────────────────────────────────────

export type WishlistEntry = {
  id: string;
  catalog: CatalogCard;
  finish: CardFinish;
  targetMaxPrice: number | null;
  notes: string | null;
  createdAt: string;
};

export async function getCardWishlist(): Promise<WishlistEntry[]> {
  const userId = await getViewUserId();
  const encKey = await getEncryptionKey();

  const rows = await db.cardWishlistItem.findMany({
    where: { userId },
    include: { catalog: true },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((r) => ({
    id: r.id,
    catalog: toCatalogCard(r.catalog),
    finish: r.finish,
    targetMaxPrice: r.targetMaxPrice ? decryptAmount(r.targetMaxPrice, encKey) : null,
    notes: r.notes ? decrypt(r.notes, encKey) : null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function addCardWishlistItem(input: z.input<typeof wishlistItemSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const encKey = await getEncryptionKey();
  const parsed = wishlistItemSchema.parse(input);

  const catalog = await db.cardCatalog.findUnique({ where: { id: parsed.catalogId } });
  if (!catalog) throw new Error("Card not found in catalog");

  // Upsert via the unique (userId, catalogId, finish) key
  await db.cardWishlistItem.upsert({
    where: {
      userId_catalogId_finish: {
        userId: session.user.id,
        catalogId: parsed.catalogId,
        finish: parsed.finish,
      },
    },
    update: {
      targetMaxPrice: parsed.targetMaxPrice != null ? encryptAmount(parsed.targetMaxPrice, encKey) : null,
      notes: parsed.notes ? encrypt(parsed.notes, encKey) : null,
    },
    create: {
      userId: session.user.id,
      catalogId: parsed.catalogId,
      finish: parsed.finish,
      targetMaxPrice: parsed.targetMaxPrice != null ? encryptAmount(parsed.targetMaxPrice, encKey) : null,
      notes: parsed.notes ? encrypt(parsed.notes, encKey) : null,
    },
  });

  revalidatePath("/cards");
}

export async function removeCardWishlistItem(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const existing = await db.cardWishlistItem.findFirst({ where: { id, userId: session.user.id } });
  if (!existing) throw new Error("Wishlist item not found");

  await db.cardWishlistItem.delete({ where: { id } });
  revalidatePath("/cards");
}

// ─── CSV import ──────────────────────────────────────────────────────

interface CsvRow {
  set_code?: string;
  "set code"?: string;
  card_number?: string;
  "card number"?: string;
  quantity?: string;
  finish?: string;
  condition?: string;
  acquired_price?: string;
  "acquired price"?: string;
  acquired_date?: string;
  "acquired date"?: string;
  notes?: string;
}

function pick(row: CsvRow, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const lower = k.toLowerCase();
    for (const rk of Object.keys(row)) {
      if (rk.toLowerCase() === lower) {
        const v = (row as Record<string, unknown>)[rk];
        if (typeof v === "string" && v.trim().length > 0) return v.trim();
      }
    }
  }
  return undefined;
}

function parseFinish(s: string | undefined): CardFinish {
  const v = (s ?? "").trim().toUpperCase();
  if (v === "FOIL") return CardFinish.FOIL;
  if (v === "ENCHANTED") return CardFinish.ENCHANTED;
  return CardFinish.NORMAL;
}

function parseCondition(s: string | undefined): CardCondition {
  const v = (s ?? "").trim().toUpperCase();
  if (v === "LP") return CardCondition.LP;
  if (v === "MP") return CardCondition.MP;
  if (v === "HP") return CardCondition.HP;
  if (v === "DMG" || v === "DAMAGED") return CardCondition.DMG;
  return CardCondition.NM;
}

export async function importCollectionCsv(csvText: string): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const encKey = await getEncryptionKey();

  const parsed = Papa.parse<CsvRow>(csvText, { header: true, skipEmptyLines: true });
  const errors: string[] = [...(parsed.errors?.map((e) => `Row ${e.row}: ${e.message}`) ?? [])];
  let imported = 0;
  let skipped = 0;

  for (const [i, row] of parsed.data.entries()) {
    try {
      const setCode = pick(row, "set_code", "set code", "set");
      const cardNumber = pick(row, "card_number", "card number", "number");
      const qtyStr = pick(row, "quantity", "qty");
      if (!setCode || !cardNumber || !qtyStr) {
        skipped++;
        errors.push(`Row ${i + 2}: missing required fields (set_code, card_number, quantity)`);
        continue;
      }
      const quantity = parseInt(qtyStr, 10);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        skipped++;
        errors.push(`Row ${i + 2}: invalid quantity "${qtyStr}"`);
        continue;
      }

      // Find catalog row
      let catalog = await db.cardCatalog.findFirst({
        where: { game: CardGame.LORCANA, setCode, cardNumber },
      });
      if (!catalog) {
        // Try fuzzy lookup via Lorcast — search by card_number in set
        const remote = await lorcastSearchCards(`set:${setCode} number:${cardNumber}`);
        const match = remote.find((c) => c.set.code === setCode && c.collector_number === cardNumber);
        if (match) {
          const lookup = await getCardById(match.id);
          if (lookup) {
            const data = {
              game: CardGame.LORCANA,
              externalId: lookup.id,
              setCode: lookup.set.code,
              setName: lookup.set.name,
              cardNumber: lookup.collector_number,
              name: lookup.name,
              subtitle: lookup.version ?? null,
              rarity: lookup.rarity ?? null,
              inkCost: typeof lookup.cost === "number" ? lookup.cost : typeof lookup.ink_cost === "number" ? lookup.ink_cost : null,
              cardType: Array.isArray(lookup.type) ? lookup.type.join(", ") : typeof lookup.type === "string" ? lookup.type : null,
              ink: lookup.ink ?? null,
              imageSmall: lookup.image_uris?.digital?.small ?? null,
              imageNormal: lookup.image_uris?.digital?.normal ?? null,
              priceUsd: parsePrice(lookup.prices?.usd),
              priceUsdFoil: parsePrice(lookup.prices?.usd_foil),
              lastPricedAt: new Date(),
            };
            catalog = await db.cardCatalog.upsert({
              where: { externalId: lookup.id },
              update: data,
              create: data,
            });
          }
        }
      }
      if (!catalog) {
        skipped++;
        errors.push(`Row ${i + 2}: no catalog match for set=${setCode} number=${cardNumber}`);
        continue;
      }

      const acquiredPriceStr = pick(row, "acquired_price", "acquired price", "price");
      const acquiredPrice = acquiredPriceStr ? parseFloat(acquiredPriceStr) : 0;
      const acquiredDateStr = pick(row, "acquired_date", "acquired date", "date");
      const acquiredDate = acquiredDateStr ? new Date(acquiredDateStr) : null;
      const notes = pick(row, "notes");

      await db.cardCollectionItem.create({
        data: {
          userId: session.user.id,
          catalogId: catalog.id,
          finish: parseFinish(pick(row, "finish")),
          condition: parseCondition(pick(row, "condition")),
          language: pick(row, "language") ?? "EN",
          quantity: encryptAmount(quantity, encKey),
          acquiredPrice: encryptAmount(isFinite(acquiredPrice) && acquiredPrice >= 0 ? acquiredPrice : 0, encKey),
          currency: "USD",
          acquiredDate: acquiredDate && !isNaN(acquiredDate.getTime()) ? acquiredDate : null,
          notes: notes ? encrypt(notes, encKey) : null,
        },
      });
      imported++;
    } catch (e) {
      skipped++;
      errors.push(`Row ${i + 2}: ${(e as Error).message}`);
    }
  }

  revalidatePath("/cards");
  revalidatePath("/");
  return { imported, skipped, errors };
}

// Re-export display helper for client-side use without importing lib/lorcast there
export async function displayCardName(name: string, subtitle: string | null) {
  return fullCardName({ name, subtitle: subtitle ?? undefined });
}
