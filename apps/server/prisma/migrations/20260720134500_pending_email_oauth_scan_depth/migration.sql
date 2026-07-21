-- AlterTable
ALTER TABLE "PendingEmailOAuth" ADD COLUMN     "historicalScanDepthDays" INTEGER NOT NULL DEFAULT 30;

