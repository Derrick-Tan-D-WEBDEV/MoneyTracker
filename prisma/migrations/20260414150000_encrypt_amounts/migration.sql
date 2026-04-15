-- Convert all Decimal columns to Text for amount-level encryption

-- FinancialAccount
ALTER TABLE "FinancialAccount" ALTER COLUMN "balance" DROP DEFAULT;
ALTER TABLE "FinancialAccount" ALTER COLUMN "balance" TYPE TEXT USING "balance"::TEXT;
ALTER TABLE "FinancialAccount" ALTER COLUMN "balance" SET DEFAULT '0';

ALTER TABLE "FinancialAccount" ALTER COLUMN "reservedAmount" DROP DEFAULT;
ALTER TABLE "FinancialAccount" ALTER COLUMN "reservedAmount" TYPE TEXT USING "reservedAmount"::TEXT;
ALTER TABLE "FinancialAccount" ALTER COLUMN "reservedAmount" SET DEFAULT '0';

ALTER TABLE "FinancialAccount" ALTER COLUMN "creditLimit" TYPE TEXT USING "creditLimit"::TEXT;

-- Transaction
ALTER TABLE "Transaction" ALTER COLUMN "amount" TYPE TEXT USING "amount"::TEXT;

-- Budget
ALTER TABLE "Budget" ALTER COLUMN "amount" TYPE TEXT USING "amount"::TEXT;

-- Investment
ALTER TABLE "Investment" ALTER COLUMN "quantity" TYPE TEXT USING "quantity"::TEXT;
ALTER TABLE "Investment" ALTER COLUMN "buyPrice" TYPE TEXT USING "buyPrice"::TEXT;
ALTER TABLE "Investment" ALTER COLUMN "currentPrice" TYPE TEXT USING "currentPrice"::TEXT;

-- Goal
ALTER TABLE "Goal" ALTER COLUMN "targetAmount" TYPE TEXT USING "targetAmount"::TEXT;

ALTER TABLE "Goal" ALTER COLUMN "currentAmount" DROP DEFAULT;
ALTER TABLE "Goal" ALTER COLUMN "currentAmount" TYPE TEXT USING "currentAmount"::TEXT;
ALTER TABLE "Goal" ALTER COLUMN "currentAmount" SET DEFAULT '0';

ALTER TABLE "Goal" ALTER COLUMN "interestRate" DROP DEFAULT;
ALTER TABLE "Goal" ALTER COLUMN "interestRate" TYPE TEXT USING "interestRate"::TEXT;
ALTER TABLE "Goal" ALTER COLUMN "interestRate" SET DEFAULT '0';

ALTER TABLE "Goal" ALTER COLUMN "monthlyContribution" DROP DEFAULT;
ALTER TABLE "Goal" ALTER COLUMN "monthlyContribution" TYPE TEXT USING "monthlyContribution"::TEXT;
ALTER TABLE "Goal" ALTER COLUMN "monthlyContribution" SET DEFAULT '0';

-- Debt
ALTER TABLE "Debt" ALTER COLUMN "originalAmount" TYPE TEXT USING "originalAmount"::TEXT;
ALTER TABLE "Debt" ALTER COLUMN "remainingAmount" TYPE TEXT USING "remainingAmount"::TEXT;

ALTER TABLE "Debt" ALTER COLUMN "interestRate" DROP DEFAULT;
ALTER TABLE "Debt" ALTER COLUMN "interestRate" TYPE TEXT USING "interestRate"::TEXT;
ALTER TABLE "Debt" ALTER COLUMN "interestRate" SET DEFAULT '0';

ALTER TABLE "Debt" ALTER COLUMN "minimumPayment" DROP DEFAULT;
ALTER TABLE "Debt" ALTER COLUMN "minimumPayment" TYPE TEXT USING "minimumPayment"::TEXT;
ALTER TABLE "Debt" ALTER COLUMN "minimumPayment" SET DEFAULT '0';

-- Installment
ALTER TABLE "Installment" ALTER COLUMN "totalAmount" TYPE TEXT USING "totalAmount"::TEXT;
ALTER TABLE "Installment" ALTER COLUMN "monthlyPayment" TYPE TEXT USING "monthlyPayment"::TEXT;

ALTER TABLE "Installment" ALTER COLUMN "interestRate" DROP DEFAULT;
ALTER TABLE "Installment" ALTER COLUMN "interestRate" TYPE TEXT USING "interestRate"::TEXT;
ALTER TABLE "Installment" ALTER COLUMN "interestRate" SET DEFAULT '0';

-- Asset
ALTER TABLE "Asset" ALTER COLUMN "purchasePrice" TYPE TEXT USING "purchasePrice"::TEXT;
ALTER TABLE "Asset" ALTER COLUMN "currentValue" TYPE TEXT USING "currentValue"::TEXT;

-- Subscription
ALTER TABLE "Subscription" ALTER COLUMN "amount" TYPE TEXT USING "amount"::TEXT;

-- WishlistItem
ALTER TABLE "WishlistItem" ALTER COLUMN "estimatedCost" TYPE TEXT USING "estimatedCost"::TEXT;

-- NetWorthSnapshot
ALTER TABLE "NetWorthSnapshot" ALTER COLUMN "netWorth" TYPE TEXT USING "netWorth"::TEXT;
