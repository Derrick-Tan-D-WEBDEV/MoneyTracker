-- Add Card Collection feature: catalog, owned items, daily price snapshots, wishlist.

-- CreateEnum
CREATE TYPE "CardGame" AS ENUM ('LORCANA');

-- CreateEnum
CREATE TYPE "CardFinish" AS ENUM ('NORMAL', 'FOIL', 'ENCHANTED');

-- CreateEnum
CREATE TYPE "CardCondition" AS ENUM ('NM', 'LP', 'MP', 'HP', 'DMG');

-- AlterTable: add collectiblesValue to NetWorthSnapshot
ALTER TABLE "NetWorthSnapshot" ADD COLUMN "collectiblesValue" TEXT;

-- CreateTable: CardCatalog (global, plaintext)
CREATE TABLE "CardCatalog" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "game" "CardGame" NOT NULL,
    "externalId" TEXT NOT NULL,
    "setCode" TEXT NOT NULL,
    "setName" TEXT NOT NULL,
    "cardNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subtitle" TEXT,
    "rarity" TEXT,
    "inkCost" INTEGER,
    "cardType" TEXT,
    "ink" TEXT,
    "imageSmall" TEXT,
    "imageNormal" TEXT,
    "priceUsd" TEXT,
    "priceUsdFoil" TEXT,
    "lastPricedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CardCatalog_externalId_key" ON "CardCatalog"("externalId");
CREATE INDEX "CardCatalog_game_setCode_idx" ON "CardCatalog"("game", "setCode");
CREATE INDEX "CardCatalog_game_name_idx" ON "CardCatalog"("game", "name");

-- CreateTable: CardCollectionItem (per-user, encrypted fields)
CREATE TABLE "CardCollectionItem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "catalogId" UUID NOT NULL,
    "finish" "CardFinish" NOT NULL DEFAULT 'NORMAL',
    "condition" "CardCondition" NOT NULL DEFAULT 'NM',
    "language" TEXT NOT NULL DEFAULT 'EN',
    "quantity" TEXT NOT NULL,
    "acquiredPrice" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "acquiredDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardCollectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CardCollectionItem_userId_idx" ON "CardCollectionItem"("userId");
CREATE INDEX "CardCollectionItem_userId_catalogId_idx" ON "CardCollectionItem"("userId", "catalogId");
CREATE INDEX "CardCollectionItem_catalogId_idx" ON "CardCollectionItem"("catalogId");

-- AddForeignKey
ALTER TABLE "CardCollectionItem" ADD CONSTRAINT "CardCollectionItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CardCollectionItem" ADD CONSTRAINT "CardCollectionItem_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "CardCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: CardPriceSnapshot (global, plaintext, daily)
CREATE TABLE "CardPriceSnapshot" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "catalogId" UUID NOT NULL,
    "finish" "CardFinish" NOT NULL DEFAULT 'NORMAL',
    "priceUsd" TEXT NOT NULL,
    "recordedOn" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardPriceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CardPriceSnapshot_catalogId_finish_recordedOn_key" ON "CardPriceSnapshot"("catalogId", "finish", "recordedOn");
CREATE INDEX "CardPriceSnapshot_catalogId_recordedOn_idx" ON "CardPriceSnapshot"("catalogId", "recordedOn");

-- AddForeignKey
ALTER TABLE "CardPriceSnapshot" ADD CONSTRAINT "CardPriceSnapshot_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "CardCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: CardWishlistItem
CREATE TABLE "CardWishlistItem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "catalogId" UUID NOT NULL,
    "finish" "CardFinish" NOT NULL DEFAULT 'NORMAL',
    "targetMaxPrice" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardWishlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CardWishlistItem_userId_catalogId_finish_key" ON "CardWishlistItem"("userId", "catalogId", "finish");
CREATE INDEX "CardWishlistItem_userId_idx" ON "CardWishlistItem"("userId");

-- AddForeignKey
ALTER TABLE "CardWishlistItem" ADD CONSTRAINT "CardWishlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CardWishlistItem" ADD CONSTRAINT "CardWishlistItem_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "CardCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
