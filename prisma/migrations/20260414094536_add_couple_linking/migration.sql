-- CreateEnum
CREATE TYPE "CoupleLinkStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "CoupleLink" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "partnerId" UUID,
    "inviteCode" TEXT NOT NULL,
    "inviteEmail" TEXT,
    "status" "CoupleLinkStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "CoupleLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CoupleLink_inviteCode_key" ON "CoupleLink"("inviteCode");

-- CreateIndex
CREATE INDEX "CoupleLink_userId_idx" ON "CoupleLink"("userId");

-- CreateIndex
CREATE INDEX "CoupleLink_partnerId_idx" ON "CoupleLink"("partnerId");

-- CreateIndex
CREATE INDEX "CoupleLink_inviteCode_idx" ON "CoupleLink"("inviteCode");

-- CreateIndex
CREATE UNIQUE INDEX "CoupleLink_userId_partnerId_key" ON "CoupleLink"("userId", "partnerId");

-- AddForeignKey
ALTER TABLE "CoupleLink" ADD CONSTRAINT "CoupleLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoupleLink" ADD CONSTRAINT "CoupleLink_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
