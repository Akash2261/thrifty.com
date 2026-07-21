import { prisma } from "../../db/prisma";
import { AppError } from "../../lib/errors";
import { encryptSecret, decryptSecret } from "../../lib/encryption";
import { getEmailProvider, type RawEmailMessage } from "./emailProvider";
import { findRetailerParser, type ParsedReceipt } from "./retailerParsers";
import { detectSubscriptionLanguage } from "./subscriptionCadence";
import { extractReceiptFromEmailText, extractReceiptFromImage } from "../warranty/receiptExtraction.service";
import { createWarrantyItemFromExtractedData } from "../warranty/warranty.service";
import { normalizeMerchant } from "../subscriptions/recurringDetection";
import type { EmailProvider, ReviewDecisionRequest } from "@thrifty/shared";

// A message must look at least plausibly like a purchase/order email before it's worth a Claude
// API call for the low-confidence fallback path — otherwise every newsletter would burn a call
// and clutter the review queue. An attached image is itself a strong enough signal to skip this
// gate (see processMessage below) — a receipt scan rarely comes with receipt-ish subject text.
const RECEIPT_ISH_HINT = /\b(order|purchase|receipt|invoice|payment|shipped|delivered|confirmation)\b/i;
const DUPLICATE_WINDOW_DAYS = 5;

const MIME_TO_MEDIA_TYPE: Record<string, "image/jpeg" | "image/png" | "image/webp"> = {
  "image/jpeg": "image/jpeg",
  "image/png": "image/png",
  "image/webp": "image/webp",
};

function getRedirectUri(provider: EmailProvider): string {
  const base = process.env.SERVER_PUBLIC_URL || `http://localhost:${process.env.PORT || 4000}`;
  return `${base}/email-connections/callback/${provider}`;
}

export async function createAuthorizeUrl(userId: string, provider: EmailProvider, historicalScanDepthDays: number) {
  const client = getEmailProvider(provider); // throws a clear 503 if that provider isn't configured
  const pending = await prisma.pendingEmailOAuth.create({
    data: { userId, provider, historicalScanDepthDays },
  });
  return { authUrl: client.getAuthUrl(pending.id, getRedirectUri(provider)) };
}

export async function handleOAuthCallback(provider: EmailProvider, code: string, state: string) {
  const pending = await prisma.pendingEmailOAuth.findFirst({ where: { id: state, provider } });
  if (!pending) {
    throw new AppError("This connection link has expired. Start over from the app.", 400);
  }
  await prisma.pendingEmailOAuth.delete({ where: { id: pending.id } }).catch(() => {});

  const client = getEmailProvider(provider);
  const exchanged = await client.exchangeCode(code, getRedirectUri(provider));

  const connection = await prisma.emailConnection.upsert({
    where: {
      userId_provider_emailAddress: { userId: pending.userId, provider, emailAddress: exchanged.emailAddress },
    },
    create: {
      userId: pending.userId,
      provider,
      emailAddress: exchanged.emailAddress,
      encryptedAccessToken: encryptSecret(exchanged.accessToken),
      encryptedRefreshToken: exchanged.refreshToken ? encryptSecret(exchanged.refreshToken) : null,
      tokenExpiresAt: exchanged.expiresAt,
      scope: exchanged.scope,
      historicalScanDepthDays: pending.historicalScanDepthDays,
      syncStatus: "pending",
    },
    update: {
      encryptedAccessToken: encryptSecret(exchanged.accessToken),
      encryptedRefreshToken: exchanged.refreshToken ? encryptSecret(exchanged.refreshToken) : undefined,
      tokenExpiresAt: exchanged.expiresAt,
      scope: exchanged.scope,
      syncStatus: "pending",
      syncError: null,
    },
  });

  return { userId: pending.userId, connectionId: connection.id };
}

export async function listConnections(userId: string) {
  return prisma.emailConnection.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
}

export async function disconnectConnection(userId: string, id: string) {
  const connection = await prisma.emailConnection.findFirst({ where: { id, userId } });
  if (!connection) {
    throw new AppError("Email connection not found", 404);
  }
  await prisma.emailConnection.delete({ where: { id } });
}

async function getFreshAccessToken(connection: {
  id: string;
  provider: EmailProvider;
  encryptedAccessToken: string;
  encryptedRefreshToken: string | null;
  tokenExpiresAt: Date | null;
}): Promise<string> {
  const isExpiringSoon = connection.tokenExpiresAt && connection.tokenExpiresAt.getTime() < Date.now() + 2 * 60 * 1000;
  if (!isExpiringSoon) {
    return decryptSecret(connection.encryptedAccessToken);
  }
  if (!connection.encryptedRefreshToken) {
    throw new AppError("This email connection expired. Reconnect it in Settings.", 401);
  }

  const client = getEmailProvider(connection.provider);
  const refreshed = await client.refreshAccessToken(decryptSecret(connection.encryptedRefreshToken));
  await prisma.emailConnection.update({
    where: { id: connection.id },
    data: { encryptedAccessToken: encryptSecret(refreshed.accessToken), tokenExpiresAt: refreshed.expiresAt },
  });
  return refreshed.accessToken;
}

async function upsertSubscriptionFromEmail(
  userId: string,
  merchantRaw: string,
  cadence: "weekly" | "monthly" | "yearly",
  amount: number,
  currency: string,
) {
  const merchantNormalized = normalizeMerchant(merchantRaw);
  if (!merchantNormalized) return;

  await prisma.detectedSubscription.upsert({
    where: { userId_merchantNormalized: { userId, merchantNormalized } },
    create: {
      userId,
      merchantNormalized,
      displayName: merchantRaw,
      avgAmount: amount,
      currency,
      cadence,
      firstSeen: new Date(),
      lastSeen: new Date(),
      detectedFromBank: false,
      detectedFromEmail: true,
    },
    update: {
      displayName: merchantRaw,
      cadence,
      lastSeen: new Date(),
      detectedFromEmail: true,
    },
  });
}

// Same order across a confirmation + shipping email shouldn't become two warranty items.
// Prefers matching on the retailer's own order number when the parser found one; falls back to a
// (retailer, item name) match within a short window when it didn't. `createdAt` is used as a
// stand-in for "when we saw this email" — close enough since syncs run periodically rather than
// long after the fact.
async function findDuplicateMessage(userId: string, parsed: ParsedReceipt) {
  if (parsed.orderIdentifier) {
    const byOrder = await prisma.scannedEmailMessage.findFirst({
      where: {
        orderIdentifier: parsed.orderIdentifier,
        status: "saved",
        emailConnection: { userId },
      },
    });
    if (byOrder) return byOrder;
  }

  const windowStart = new Date(Date.now() - DUPLICATE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return prisma.scannedEmailMessage.findFirst({
    where: {
      status: "saved",
      extractedRetailer: parsed.retailer,
      extractedItemName: parsed.itemName,
      createdAt: { gte: windowStart },
      emailConnection: { userId },
    },
  });
}

export async function processMessage(
  connection: { id: string; userId: string },
  message: RawEmailMessage,
): Promise<void> {
  const existing = await prisma.scannedEmailMessage.findUnique({
    where: {
      emailConnectionId_providerMessageId: {
        emailConnectionId: connection.id,
        providerMessageId: message.providerMessageId,
      },
    },
  });
  if (existing) return;

  const base = {
    emailConnectionId: connection.id,
    providerMessageId: message.providerMessageId,
    fromAddress: message.fromAddress,
    subject: message.subject,
  };

  const subscriptionMatch = detectSubscriptionLanguage(message.fromAddress, message.subject, message.textBody);
  if (subscriptionMatch && subscriptionMatch.amount != null) {
    await upsertSubscriptionFromEmail(
      connection.userId,
      subscriptionMatch.merchantRaw,
      subscriptionMatch.cadence,
      subscriptionMatch.amount,
      subscriptionMatch.currency ?? "INR",
    );
    await prisma.scannedEmailMessage.create({ data: { ...base, status: "saved" } });
    return;
  }

  const parser = findRetailerParser(message.fromAddress);
  const parsed = parser?.parse(message.subject, message.textBody) ?? null;

  if (parsed) {
    const duplicate = await findDuplicateMessage(connection.userId, parsed);
    if (duplicate) {
      await prisma.scannedEmailMessage.create({
        data: {
          ...base,
          status: "duplicate",
          orderIdentifier: parsed.orderIdentifier,
          duplicateOfMessageId: duplicate.id,
        },
      });
      return;
    }

    const item = await createWarrantyItemFromExtractedData(connection.userId, {
      itemName: parsed.itemName,
      retailer: parsed.retailer,
      purchaseDate: (parsed.purchaseDate ?? message.receivedAt).toISOString().slice(0, 10),
      price: parsed.price,
      currency: parsed.currency,
    });

    await prisma.scannedEmailMessage.create({
      data: {
        ...base,
        status: "saved",
        orderIdentifier: parsed.orderIdentifier,
        extractedItemName: parsed.itemName,
        extractedRetailer: parsed.retailer,
        extractedPrice: parsed.price,
        extractedCurrency: parsed.currency,
        createdWarrantyItemId: item.id,
      },
    });
    return;
  }

  const hasImageAttachment = !!message.imageAttachment;
  const mediaType = message.imageAttachment ? MIME_TO_MEDIA_TYPE[message.imageAttachment.mimeType] : undefined;

  // A receipt scanned/forwarded as an image attachment rarely has receipt-ish subject text of its
  // own (often just "Fwd:" or blank), so an attached image is treated as its own strong signal —
  // otherwise gate on the subject/body looking at least plausibly like a purchase email before
  // spending a Claude call.
  if (!hasImageAttachment && !RECEIPT_ISH_HINT.test(`${message.subject} ${message.textBody}`)) {
    await prisma.scannedEmailMessage.create({ data: { ...base, status: "ignored" } });
    return;
  }

  // Unrecognized sender but looks receipt-like — lower trust, so route to the review queue
  // instead of auto-saving. Requires ANTHROPIC_API_KEY; if it's missing or extraction fails,
  // just leave the message ignored rather than failing the whole sync.
  try {
    const extracted =
      message.imageAttachment && mediaType
        ? await extractReceiptFromImage(message.imageAttachment.buffer, mediaType)
        : await extractReceiptFromEmailText(message.textBody || message.subject);
    await prisma.scannedEmailMessage.create({
      data: {
        ...base,
        status: "pending_review",
        extractedItemName: extracted.itemName,
        extractedRetailer: extracted.retailer,
        extractedPurchaseDate: extracted.purchaseDate ? new Date(extracted.purchaseDate) : null,
        extractedPrice: extracted.price,
        extractedCurrency: extracted.currency,
        rawTextSnippet: message.textBody.slice(0, 500),
      },
    });
  } catch (err) {
    await prisma.scannedEmailMessage.create({ data: { ...base, status: "ignored" } });
  }
}

export async function syncConnection(connection: {
  id: string;
  userId: string;
  provider: EmailProvider;
  encryptedAccessToken: string;
  encryptedRefreshToken: string | null;
  tokenExpiresAt: Date | null;
  lastSyncToken: string | null;
  historicalScanDepthDays: number;
}) {
  const client = getEmailProvider(connection.provider);
  const accessToken = await getFreshAccessToken(connection);
  const sinceDate = new Date(Date.now() - connection.historicalScanDepthDays * 24 * 60 * 60 * 1000);

  const { messages, nextSyncToken } = await client.listNewMessages({
    accessToken,
    syncToken: connection.lastSyncToken,
    sinceDate,
  });

  for (const message of messages) {
    await processMessage(connection, message);
  }

  await prisma.emailConnection.update({
    where: { id: connection.id },
    data: {
      lastSyncToken: nextSyncToken,
      lastSyncedAt: new Date(),
      syncStatus: "active",
      syncError: null,
    },
  });

  return { messagesSeen: messages.length };
}

export async function syncConnectionById(userId: string, id: string) {
  const connection = await prisma.emailConnection.findFirst({ where: { id, userId } });
  if (!connection) {
    throw new AppError("Email connection not found", 404);
  }
  try {
    return await syncConnection(connection);
  } catch (err) {
    const message = err instanceof AppError ? err.message : "Sync failed. Try again later.";
    await prisma.emailConnection.update({
      where: { id: connection.id },
      data: { syncStatus: "error", syncError: message },
    });
    throw err;
  }
}

export async function listReviewQueue(userId: string) {
  return prisma.scannedEmailMessage.findMany({
    where: { status: "pending_review", emailConnection: { userId } },
    orderBy: { createdAt: "desc" },
  });
}

export async function resolveReviewItem(
  userId: string,
  id: string,
  decision: "approve" | "reject",
  patch?: ReviewDecisionRequest,
) {
  const item = await prisma.scannedEmailMessage.findFirst({
    where: { id, status: "pending_review", emailConnection: { userId } },
  });
  if (!item) {
    throw new AppError("Review item not found", 404);
  }

  if (decision === "reject") {
    await prisma.scannedEmailMessage.update({ where: { id }, data: { status: "ignored" } });
    return { created: false };
  }

  const itemName = patch?.itemName ?? item.extractedItemName;
  if (!itemName) {
    throw new AppError("An item name is required to save this receipt.", 400);
  }

  const purchaseDate =
    patch?.purchaseDate ?? item.extractedPurchaseDate?.toISOString().slice(0, 10) ?? new Date().toISOString().slice(0, 10);

  const created = await createWarrantyItemFromExtractedData(userId, {
    itemName,
    retailer: patch?.retailer !== undefined ? patch.retailer : item.extractedRetailer,
    purchaseDate,
    price: patch?.price !== undefined ? patch.price : item.extractedPrice,
    currency: patch?.currency !== undefined ? patch.currency : item.extractedCurrency,
  });

  await prisma.scannedEmailMessage.update({
    where: { id },
    data: { status: "saved", createdWarrantyItemId: created.id },
  });

  return { created: true, warrantyItemId: created.id };
}

export async function syncAllActiveConnections() {
  const connections = await prisma.emailConnection.findMany({
    where: { syncStatus: { in: ["active", "pending"] } },
  });

  let synced = 0;
  for (const connection of connections) {
    try {
      await syncConnection(connection);
      synced += 1;
    } catch (err) {
      const message = err instanceof AppError ? err.message : "Sync failed";
      await prisma.emailConnection
        .update({ where: { id: connection.id }, data: { syncStatus: "error", syncError: message } })
        .catch(() => {});
    }
  }
  return { connectionsSynced: synced, connectionsTotal: connections.length };
}
