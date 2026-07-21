import type { WarrantyItem as PrismaWarrantyItem } from "@prisma/client";
import type { WarrantyItem } from "@thrifty/shared";
import { computeStatus } from "./warranty.dates";

export function toPublicWarrantyItem(item: PrismaWarrantyItem): WarrantyItem {
  return {
    id: item.id,
    itemName: item.itemName,
    retailer: item.retailer,
    purchaseDate: item.purchaseDate.toISOString(),
    price: item.price,
    currency: item.currency,
    sourceImageUrl: item.sourceImageUrl ? `/warranty-items/${item.id}/image` : null,
    returnWindowEndsAt: item.returnWindowEndsAt?.toISOString() ?? null,
    warrantyEndsAt: item.warrantyEndsAt?.toISOString() ?? null,
    status: computeStatus(item.returnWindowEndsAt, item.warrantyEndsAt),
  };
}
