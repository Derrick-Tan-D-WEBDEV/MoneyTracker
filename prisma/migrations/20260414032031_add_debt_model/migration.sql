-- CreateEnum
CREATE TYPE "DebtType" AS ENUM ('PERSONAL_LOAN', 'CAR_LOAN', 'MORTGAGE', 'STUDENT_LOAN', 'CREDIT_CARD', 'MEDICAL', 'OTHER');

-- CreateTable
CREATE TABLE "Debt" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DebtType" NOT NULL DEFAULT 'OTHER',
    "lender" TEXT,
    "originalAmount" DECIMAL(19,4) NOT NULL,
    "remainingAmount" DECIMAL(19,4) NOT NULL,
    "interestRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "minimumPayment" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "dueDay" INTEGER,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "icon" TEXT NOT NULL DEFAULT 'landmark',
    "color" TEXT NOT NULL DEFAULT '#EF4444',
    "isPaidOff" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Debt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Debt_userId_idx" ON "Debt"("userId");

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
