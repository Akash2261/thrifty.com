-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('pending', 'active', 'paused', 'rejected', 'revoked', 'expired');

-- AlterTable
ALTER TABLE "LinkedBankAccount" ADD COLUMN     "aaSessionId" TEXT,
ADD COLUMN     "bankConsentId" TEXT,
ADD COLUMN     "fipId" TEXT;

-- CreateTable
CREATE TABLE "BankConsent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "consentHandle" TEXT NOT NULL,
    "consentId" TEXT,
    "status" "ConsentStatus" NOT NULL DEFAULT 'pending',
    "purposeCode" TEXT NOT NULL,
    "fetchType" TEXT NOT NULL,
    "consentExpiry" TIMESTAMP(3),
    "fipIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankConsent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BankConsent_consentHandle_key" ON "BankConsent"("consentHandle");

-- CreateIndex
CREATE UNIQUE INDEX "BankConsent_consentId_key" ON "BankConsent"("consentId");

-- CreateIndex
CREATE INDEX "BankConsent_userId_idx" ON "BankConsent"("userId");

-- AddForeignKey
ALTER TABLE "LinkedBankAccount" ADD CONSTRAINT "LinkedBankAccount_bankConsentId_fkey" FOREIGN KEY ("bankConsentId") REFERENCES "BankConsent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankConsent" ADD CONSTRAINT "BankConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

