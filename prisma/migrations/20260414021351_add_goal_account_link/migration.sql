-- AlterTable
ALTER TABLE "Goal" ADD COLUMN     "accountId" UUID;

-- CreateIndex
CREATE INDEX "Goal_accountId_idx" ON "Goal"("accountId");

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
