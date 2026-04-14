-- AlterTable
ALTER TABLE "Debt" ADD COLUMN     "accountId" UUID;

-- AlterTable
ALTER TABLE "FinancialAccount" ADD COLUMN     "creditLimit" DECIMAL(19,4),
ADD COLUMN     "repaymentDay" INTEGER;

-- CreateIndex
CREATE INDEX "Debt_accountId_idx" ON "Debt"("accountId");

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
