-- CreateEnum
CREATE TYPE "EmailProvider" AS ENUM ('gmail', 'outlook', 'yahoo');

-- CreateEnum
CREATE TYPE "EmailSyncStatus" AS ENUM ('pending', 'active', 'error', 'disconnected');

-- CreateEnum
CREATE TYPE "ScannedEmailStatus" AS ENUM ('saved', 'pending_review', 'duplicate', 'ignored');

-- AlterTable
ALTER TABLE "DetectedSubscription" ADD COLUMN     "detectedFromBank" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "detectedFromEmail" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PendingEmailOAuth" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "EmailProvider" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingEmailOAuth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "EmailProvider" NOT NULL,
    "emailAddress" TEXT NOT NULL,
    "encryptedAccessToken" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "historicalScanDepthDays" INTEGER NOT NULL DEFAULT 30,
    "syncStatus" "EmailSyncStatus" NOT NULL DEFAULT 'pending',
    "syncError" TEXT,
    "lastSyncToken" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScannedEmailMessage" (
    "id" TEXT NOT NULL,
    "emailConnectionId" TEXT NOT NULL,
    "providerMessageId" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "orderIdentifier" TEXT,
    "status" "ScannedEmailStatus" NOT NULL,
    "extractedItemName" TEXT,
    "extractedRetailer" TEXT,
    "extractedPurchaseDate" TIMESTAMP(3),
    "extractedPrice" DOUBLE PRECISION,
    "extractedCurrency" TEXT,
    "rawTextSnippet" TEXT,
    "createdWarrantyItemId" TEXT,
    "duplicateOfMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScannedEmailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PendingEmailOAuth_userId_idx" ON "PendingEmailOAuth"("userId");

-- CreateIndex
CREATE INDEX "EmailConnection_userId_idx" ON "EmailConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailConnection_userId_provider_emailAddress_key" ON "EmailConnection"("userId", "provider", "emailAddress");

-- CreateIndex
CREATE INDEX "ScannedEmailMessage_orderIdentifier_idx" ON "ScannedEmailMessage"("orderIdentifier");

-- CreateIndex
CREATE UNIQUE INDEX "ScannedEmailMessage_emailConnectionId_providerMessageId_key" ON "ScannedEmailMessage"("emailConnectionId", "providerMessageId");

-- AddForeignKey
ALTER TABLE "PendingEmailOAuth" ADD CONSTRAINT "PendingEmailOAuth_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailConnection" ADD CONSTRAINT "EmailConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScannedEmailMessage" ADD CONSTRAINT "ScannedEmailMessage_emailConnectionId_fkey" FOREIGN KEY ("emailConnectionId") REFERENCES "EmailConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

