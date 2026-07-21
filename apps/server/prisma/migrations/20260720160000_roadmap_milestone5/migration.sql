-- CreateEnum
CREATE TYPE "ClaimType" AS ENUM ('warranty_defect', 'return_assistance');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('draft', 'submitted', 'resolved');

-- CreateEnum
CREATE TYPE "ChargeProvider" AS ENUM ('stripe', 'razorpay');

-- CreateEnum
CREATE TYPE "ChargeStatus" AS ENUM ('pending', 'charged', 'failed');

-- AlterTable
ALTER TABLE "Household" ADD COLUMN     "inviteCode" TEXT;

-- CreateTable
CREATE TABLE "ServiceCenterContact" (
    "id" TEXT NOT NULL,
    "merchantPattern" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "contactMethod" TEXT NOT NULL,
    "contactValue" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,

    CONSTRAINT "ServiceCenterContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "warrantyItemId" TEXT NOT NULL,
    "type" "ClaimType" NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'draft',
    "description" TEXT,
    "serviceCenterContactId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CancellationSavingsCharge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "detectedSubscriptionId" TEXT NOT NULL,
    "estimatedAnnualSavings" DOUBLE PRECISION NOT NULL,
    "chargeAmount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "ChargeStatus" NOT NULL DEFAULT 'pending',
    "provider" "ChargeProvider",
    "providerChargeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CancellationSavingsCharge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCenterContact_merchantPattern_key" ON "ServiceCenterContact"("merchantPattern");

-- CreateIndex
CREATE INDEX "Claim_userId_idx" ON "Claim"("userId");

-- CreateIndex
CREATE INDEX "CancellationSavingsCharge_userId_idx" ON "CancellationSavingsCharge"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Household_inviteCode_key" ON "Household"("inviteCode");

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_warrantyItemId_fkey" FOREIGN KEY ("warrantyItemId") REFERENCES "WarrantyItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_serviceCenterContactId_fkey" FOREIGN KEY ("serviceCenterContactId") REFERENCES "ServiceCenterContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationSavingsCharge" ADD CONSTRAINT "CancellationSavingsCharge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationSavingsCharge" ADD CONSTRAINT "CancellationSavingsCharge_detectedSubscriptionId_fkey" FOREIGN KEY ("detectedSubscriptionId") REFERENCES "DetectedSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

