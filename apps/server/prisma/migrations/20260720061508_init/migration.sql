-- CreateEnum
CREATE TYPE "Country" AS ENUM ('US', 'IN');

-- CreateEnum
CREATE TYPE "Tier" AS ENUM ('free', 'premium');

-- CreateEnum
CREATE TYPE "WarrantyItemStatus" AS ENUM ('active', 'return_expiring', 'warranty_expiring', 'expired');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "country" "Country" NOT NULL,
    "tier" "Tier" NOT NULL DEFAULT 'free',
    "pushToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetailerRule" (
    "id" TEXT NOT NULL,
    "retailerName" TEXT NOT NULL,
    "returnWindowDays" INTEGER NOT NULL,
    "warrantyWindowDays" INTEGER NOT NULL,

    CONSTRAINT "RetailerRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarrantyItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "retailer" TEXT,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "price" DOUBLE PRECISION,
    "currency" TEXT,
    "sourceImageUrl" TEXT,
    "returnWindowEndsAt" TIMESTAMP(3),
    "warrantyEndsAt" TIMESTAMP(3),
    "notifiedReturn" BOOLEAN NOT NULL DEFAULT false,
    "notifiedWarranty" BOOLEAN NOT NULL DEFAULT false,
    "status" "WarrantyItemStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarrantyItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RetailerRule_retailerName_key" ON "RetailerRule"("retailerName");

-- CreateIndex
CREATE INDEX "WarrantyItem_userId_idx" ON "WarrantyItem"("userId");

-- AddForeignKey
ALTER TABLE "WarrantyItem" ADD CONSTRAINT "WarrantyItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
