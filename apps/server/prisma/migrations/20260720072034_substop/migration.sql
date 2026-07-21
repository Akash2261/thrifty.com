-- CreateEnum
CREATE TYPE "BankProvider" AS ENUM ('plaid', 'account_aggregator');

-- CreateEnum
CREATE TYPE "SubscriptionCadence" AS ENUM ('weekly', 'monthly', 'yearly');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'flagged', 'cancelled');

-- CreateTable
CREATE TABLE "PendingBankLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "BankProvider" NOT NULL,
    "linkToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingBankLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkedBankAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "BankProvider" NOT NULL,
    "providerItemId" TEXT NOT NULL,
    "encryptedAccessToken" TEXT NOT NULL,
    "institutionName" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinkedBankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "linkedAccountId" TEXT NOT NULL,
    "providerTransactionId" TEXT NOT NULL,
    "merchantRaw" TEXT NOT NULL,
    "merchantNormalized" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetectedSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "merchantNormalized" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avgAmount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "cadence" "SubscriptionCadence" NOT NULL,
    "firstSeen" TIMESTAMP(3) NOT NULL,
    "lastSeen" TIMESTAMP(3) NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'active',
    "userConfirmedInUse" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DetectedSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PendingBankLink_linkToken_key" ON "PendingBankLink"("linkToken");

-- CreateIndex
CREATE INDEX "PendingBankLink_userId_idx" ON "PendingBankLink"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LinkedBankAccount_providerItemId_key" ON "LinkedBankAccount"("providerItemId");

-- CreateIndex
CREATE INDEX "LinkedBankAccount_userId_idx" ON "LinkedBankAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_providerTransactionId_key" ON "Transaction"("providerTransactionId");

-- CreateIndex
CREATE INDEX "Transaction_linkedAccountId_idx" ON "Transaction"("linkedAccountId");

-- CreateIndex
CREATE INDEX "Transaction_merchantNormalized_idx" ON "Transaction"("merchantNormalized");

-- CreateIndex
CREATE INDEX "DetectedSubscription_userId_idx" ON "DetectedSubscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DetectedSubscription_userId_merchantNormalized_key" ON "DetectedSubscription"("userId", "merchantNormalized");

-- AddForeignKey
ALTER TABLE "PendingBankLink" ADD CONSTRAINT "PendingBankLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkedBankAccount" ADD CONSTRAINT "LinkedBankAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_linkedAccountId_fkey" FOREIGN KEY ("linkedAccountId") REFERENCES "LinkedBankAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetectedSubscription" ADD CONSTRAINT "DetectedSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
