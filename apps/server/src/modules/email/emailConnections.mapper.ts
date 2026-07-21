import type { EmailConnection as PrismaEmailConnection, ScannedEmailMessage as PrismaScannedEmailMessage } from "@prisma/client";
import type { EmailConnection, ReviewEmailItem } from "@thrifty/shared";

export function toPublicConnection(connection: PrismaEmailConnection): EmailConnection {
  return {
    id: connection.id,
    provider: connection.provider,
    emailAddress: connection.emailAddress,
    historicalScanDepthDays: connection.historicalScanDepthDays,
    syncStatus: connection.syncStatus,
    syncError: connection.syncError,
    lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null,
    createdAt: connection.createdAt.toISOString(),
  };
}

export function toPublicReviewItem(item: PrismaScannedEmailMessage): ReviewEmailItem {
  return {
    id: item.id,
    fromAddress: item.fromAddress,
    subject: item.subject,
    extractedItemName: item.extractedItemName,
    extractedRetailer: item.extractedRetailer,
    extractedPurchaseDate: item.extractedPurchaseDate?.toISOString().slice(0, 10) ?? null,
    extractedPrice: item.extractedPrice,
    extractedCurrency: item.extractedCurrency,
    rawTextSnippet: item.rawTextSnippet,
    createdAt: item.createdAt.toISOString(),
  };
}
