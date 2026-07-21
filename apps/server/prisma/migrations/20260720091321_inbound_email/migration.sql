-- Ensure gen_random_uuid() is available for the backfill below
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "inboundEmailToken" TEXT;

-- Backfill existing rows before enforcing NOT NULL
UPDATE "User" SET "inboundEmailToken" = gen_random_uuid()::text WHERE "inboundEmailToken" IS NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "inboundEmailToken" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_inboundEmailToken_key" ON "User"("inboundEmailToken");
