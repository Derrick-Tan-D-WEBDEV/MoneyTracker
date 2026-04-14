-- AlterTable
ALTER TABLE "Goal" ADD COLUMN     "interestRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "monthlyContribution" DECIMAL(19,4) NOT NULL DEFAULT 0;
