-- Thrifty is now India-only: drop the US/Country-conditional plumbing (Plaid, Stripe, the
-- Country enum and the User.country column, and the BankProvider distinction now that Account
-- Aggregator is the only bank-data provider).

-- DropColumn: User.country
ALTER TABLE "User" DROP COLUMN "country";

-- DropEnum: Country
DROP TYPE "Country";

-- DropColumn: PendingBankLink.provider, LinkedBankAccount.provider
ALTER TABLE "PendingBankLink" DROP COLUMN "provider";
ALTER TABLE "LinkedBankAccount" DROP COLUMN "provider";

-- DropEnum: BankProvider
DROP TYPE "BankProvider";

-- AlterEnum: ChargeProvider now has only 'razorpay' (Stripe removed). Postgres can't drop an enum
-- value directly, so swap in a new type. Any pre-existing 'stripe' rows fall back to 'razorpay'
-- rather than failing the cast.
UPDATE "CancellationSavingsCharge" SET "provider" = 'razorpay' WHERE "provider"::text = 'stripe';
ALTER TYPE "ChargeProvider" RENAME TO "ChargeProvider_old";
CREATE TYPE "ChargeProvider" AS ENUM ('razorpay');
ALTER TABLE "CancellationSavingsCharge" ALTER COLUMN "provider" TYPE "ChargeProvider" USING ("provider"::text::"ChargeProvider");
DROP TYPE "ChargeProvider_old";
