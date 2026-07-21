import { prisma } from "../../db/prisma";
import { saveReceiptImage, readReceiptImage } from "../../lib/receiptStorage";
import { extractReceiptFromImage, extractReceiptFromEmailText } from "./receiptExtraction.service";
import { computeWindows } from "./warranty.dates";
import { AppError } from "../../lib/errors";
import type { ExtractedReceipt, WarrantyItemPatch } from "@thrifty/shared";

export const FREE_TIER_ITEM_LIMIT = 5;

// Kept as `WarrantyError` for call sites in this module — it's the same class as AppError.
export const WarrantyError = AppError;

const MIME_TO_EXT: Record<string, "jpeg" | "png" | "webp"> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
};

async function assertUnderFreeTierLimit(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.tier === "free") {
    const count = await prisma.warrantyItem.count({ where: { userId } });
    if (count >= FREE_TIER_ITEM_LIMIT) {
      throw new WarrantyError(
        `Free plan is limited to ${FREE_TIER_ITEM_LIMIT} items. Upgrade to add more.`,
        402,
      );
    }
  }
}

async function saveExtractedReceipt(
  userId: string,
  extracted: ExtractedReceipt,
  sourceImageFilename: string | null,
) {
  const purchaseDate = extracted.purchaseDate ? new Date(extracted.purchaseDate) : new Date();
  const { returnWindowEndsAt, warrantyEndsAt } = await computeWindows(purchaseDate, extracted.retailer);

  return prisma.warrantyItem.create({
    data: {
      userId,
      itemName: extracted.itemName,
      retailer: extracted.retailer,
      purchaseDate,
      price: extracted.price,
      currency: extracted.currency,
      sourceImageUrl: sourceImageFilename,
      returnWindowEndsAt,
      warrantyEndsAt,
    },
  });
}

// Shared by the inbound-email-forward flow, the email-integration auto-save path (high-trust
// retailer template parses), and the review-before-save approval endpoint — anywhere a receipt's
// structured fields are already known and just need the free-tier check + persistence.
export async function createWarrantyItemFromExtractedData(userId: string, extracted: ExtractedReceipt) {
  await assertUnderFreeTierLimit(userId);
  return saveExtractedReceipt(userId, extracted, null);
}

export async function createWarrantyItemFromReceipt(
  userId: string,
  imageBuffer: Buffer,
  mimeType: string,
) {
  const extension = MIME_TO_EXT[mimeType];
  if (!extension) {
    throw new WarrantyError("Unsupported image type. Use JPEG, PNG, or WebP.", 415);
  }

  await assertUnderFreeTierLimit(userId);

  const extracted = await extractReceiptFromImage(imageBuffer, `image/${extension}` as any);
  const filename = await saveReceiptImage(imageBuffer, extension);

  return saveExtractedReceipt(userId, extracted, filename);
}

export async function createWarrantyItemFromEmail(
  userId: string,
  emailText: string,
  imageAttachment: { buffer: Buffer; mimeType: string } | null,
) {
  await assertUnderFreeTierLimit(userId);

  let filename: string | null = null;
  let extracted: ExtractedReceipt;

  const extension = imageAttachment ? MIME_TO_EXT[imageAttachment.mimeType] : undefined;
  if (imageAttachment && extension) {
    extracted = await extractReceiptFromImage(imageAttachment.buffer, `image/${extension}` as any);
    filename = await saveReceiptImage(imageAttachment.buffer, extension);
  } else {
    extracted = await extractReceiptFromEmailText(emailText);
  }

  return saveExtractedReceipt(userId, extracted, filename);
}

export async function listWarrantyItems(userId: string) {
  const items = await prisma.warrantyItem.findMany({ where: { userId } });
  return items.sort((a, b) => soonestDeadline(a) - soonestDeadline(b));
}

function soonestDeadline(item: { returnWindowEndsAt: Date | null; warrantyEndsAt: Date | null }) {
  const dates = [item.returnWindowEndsAt, item.warrantyEndsAt]
    .filter((d): d is Date => d !== null)
    .map((d) => d.getTime());
  return dates.length ? Math.min(...dates) : Infinity;
}

export async function getWarrantyItem(userId: string, id: string) {
  const item = await prisma.warrantyItem.findFirst({ where: { id, userId } });
  if (!item) {
    throw new WarrantyError("Warranty item not found", 404);
  }
  return item;
}

export async function getWarrantyItemImage(userId: string, id: string) {
  const item = await getWarrantyItem(userId, id);
  if (!item.sourceImageUrl) {
    throw new WarrantyError("This item has no receipt image", 404);
  }
  return readReceiptImage(item.sourceImageUrl);
}

export async function updateWarrantyItem(userId: string, id: string, patch: WarrantyItemPatch) {
  const existing = await getWarrantyItem(userId, id);

  const purchaseDate = patch.purchaseDate ? new Date(patch.purchaseDate) : existing.purchaseDate;
  const retailer = patch.retailer !== undefined ? patch.retailer : existing.retailer;
  const dateOrRetailerChanged =
    patch.purchaseDate !== undefined || patch.retailer !== undefined;

  const windows = dateOrRetailerChanged
    ? await computeWindows(purchaseDate, retailer)
    : { returnWindowEndsAt: existing.returnWindowEndsAt, warrantyEndsAt: existing.warrantyEndsAt };

  return prisma.warrantyItem.update({
    where: { id },
    data: {
      itemName: patch.itemName ?? existing.itemName,
      retailer,
      purchaseDate,
      price: patch.price !== undefined ? patch.price : existing.price,
      currency: patch.currency !== undefined ? patch.currency : existing.currency,
      returnWindowEndsAt: windows.returnWindowEndsAt,
      warrantyEndsAt: windows.warrantyEndsAt,
    },
  });
}
