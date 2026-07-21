import { randomInt } from "node:crypto";
import { prisma } from "../../db/prisma";
import { AppError } from "../../lib/errors";
import { sendTextMessage, fetchMediaBytes } from "./whatsappClient";
import { extractReceiptFromImage, extractReceiptFromEmailText } from "../warranty/receiptExtraction.service";
import { createWarrantyItemFromExtractedData } from "../warranty/warranty.service";
import type { ExtractedReceipt } from "@thrifty/shared";

const LINK_CODE_TTL_MINUTES = 10;
const RECEIPT_ISH_HINT = /\b(order|purchase|receipt|invoice|payment|shipped|delivered|confirmation)\b/i;

const MIME_TO_MEDIA_TYPE: Record<string, "image/jpeg" | "image/png" | "image/webp"> = {
  "image/jpeg": "image/jpeg",
  "image/png": "image/png",
  "image/webp": "image/webp",
};

function generateCode(): string {
  return String(randomInt(100000, 1000000));
}

export async function createLinkingCode(userId: string) {
  const code = generateCode();
  const link = await prisma.whatsAppLinkCode.create({
    data: { userId, code, expiresAt: new Date(Date.now() + LINK_CODE_TTL_MINUTES * 60 * 1000) },
  });
  return {
    code: link.code,
    expiresAt: link.expiresAt.toISOString(),
    businessNumber: process.env.WHATSAPP_DISPLAY_PHONE_NUMBER || null,
  };
}

export async function getStatus(userId: string) {
  const connection = await prisma.whatsAppConnection.findUnique({ where: { userId } });
  return { linked: !!connection, phoneNumber: connection?.phoneNumber ?? null };
}

export async function disconnect(userId: string) {
  await prisma.whatsAppConnection.deleteMany({ where: { userId } });
}

// Sending a reply is always best-effort — a failed reply (no credentials configured yet, a
// transient Meta error) shouldn't fail message processing, since the receipt/link action itself
// already succeeded or failed independently of whether we could tell the user about it.
async function replyBestEffort(to: string, body: string) {
  try {
    await sendTextMessage(to, body);
  } catch (err) {
    console.error("WhatsApp reply failed (non-fatal)", err);
  }
}

interface InboundMessage {
  from: string;
  type: string;
  textBody: string | null;
  imageMediaId: string | null;
}

// Meta's webhook payload nests one or more messages several levels deep across entry/changes —
// this flattens it to the handful of fields the rest of this module cares about.
export function parseInboundMessages(payload: any): InboundMessage[] {
  const messages: InboundMessage[] = [];
  for (const entry of payload?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      for (const message of change?.value?.messages ?? []) {
        messages.push({
          from: message.from,
          type: message.type,
          textBody: message.type === "text" ? (message.text?.body ?? null) : null,
          imageMediaId: message.type === "image" ? (message.image?.id ?? null) : null,
        });
      }
    }
  }
  return messages;
}

async function tryLinkFromCode(from: string, textBody: string): Promise<boolean> {
  const code = textBody.trim();
  if (!/^\d{6}$/.test(code)) return false;

  const link = await prisma.whatsAppLinkCode.findFirst({
    where: { code, consumedAt: null, expiresAt: { gte: new Date() } },
  });
  if (!link) return false;

  const existing = await prisma.whatsAppConnection.findFirst({ where: { phoneNumber: from } });
  if (existing) {
    await prisma.whatsAppConnection.update({ where: { id: existing.id }, data: { userId: link.userId } });
  } else {
    await prisma.whatsAppConnection.create({ data: { userId: link.userId, phoneNumber: from } });
  }
  await prisma.whatsAppLinkCode.update({ where: { id: link.id }, data: { consumedAt: new Date() } });

  await replyBestEffort(from, "✅ You're linked! Send a photo of a receipt or forward an order confirmation and Thrifty will track it for you.");
  return true;
}

async function saveExtractedReceiptAndReply(userId: string, from: string, extracted: ExtractedReceipt) {
  const item = await createWarrantyItemFromExtractedData(userId, extracted);
  const deadline = item.returnWindowEndsAt ?? item.warrantyEndsAt;
  const deadlineText = deadline ? ` Return window closes ${deadline.toLocaleDateString()}.` : "";
  await replyBestEffort(from, `📦 Saved "${item.itemName}" to your Warranty Wallet.${deadlineText}`);
}

async function processImageMessage(userId: string, from: string, mediaId: string) {
  try {
    const { buffer, mimeType } = await fetchMediaBytes(mediaId);
    const mediaType = MIME_TO_MEDIA_TYPE[mimeType];
    if (!mediaType) {
      await replyBestEffort(from, "That image type isn't supported — try a JPEG, PNG, or WebP photo.");
      return;
    }
    const extracted = await extractReceiptFromImage(buffer, mediaType);
    await saveExtractedReceiptAndReply(userId, from, extracted);
  } catch (err) {
    const message = err instanceof AppError ? err.message : "Couldn't read that receipt. Try again.";
    await replyBestEffort(from, `⚠️ ${message}`);
  }
}

async function processTextMessage(userId: string, from: string, textBody: string) {
  if (!RECEIPT_ISH_HINT.test(textBody)) {
    await replyBestEffort(from, "Send a photo of your receipt, or forward the order confirmation text, and Thrifty will track it.");
    return;
  }
  try {
    const extracted = await extractReceiptFromEmailText(textBody);
    await saveExtractedReceiptAndReply(userId, from, extracted);
  } catch (err) {
    const message = err instanceof AppError ? err.message : "Couldn't read that receipt. Try again.";
    await replyBestEffort(from, `⚠️ ${message}`);
  }
}

export async function handleInboundMessage(message: InboundMessage): Promise<void> {
  const connection = await prisma.whatsAppConnection.findFirst({ where: { phoneNumber: message.from } });

  if (!connection) {
    if (message.type === "text" && message.textBody && (await tryLinkFromCode(message.from, message.textBody))) {
      return;
    }
    await replyBestEffort(
      message.from,
      "To connect this number, open the Thrifty app, tap \"Link WhatsApp\", and text the 6-digit code you're shown here.",
    );
    return;
  }

  if (message.type === "image" && message.imageMediaId) {
    await processImageMessage(connection.userId, message.from, message.imageMediaId);
  } else if (message.type === "text" && message.textBody) {
    await processTextMessage(connection.userId, message.from, message.textBody);
  }
}
