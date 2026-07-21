import { prisma } from "../../db/prisma";
import { env } from "../../config/env";
import { daysUntil, type WarrantyItemStatus } from "@thrifty/shared";

const NOTIFY_WINDOW_DAYS = 3;

export async function computeWindows(purchaseDate: Date, retailer: string | null) {
  let returnWindowDays = env.DEFAULT_RETURN_WINDOW_DAYS;
  let warrantyWindowDays = env.DEFAULT_WARRANTY_WINDOW_DAYS;

  if (retailer) {
    const rule = await prisma.retailerRule.findFirst({
      where: { retailerName: { equals: retailer, mode: "insensitive" } },
    });
    if (rule) {
      returnWindowDays = rule.returnWindowDays;
      warrantyWindowDays = rule.warrantyWindowDays;
    }
  }

  return {
    returnWindowEndsAt: addDays(purchaseDate, returnWindowDays),
    warrantyEndsAt: addDays(purchaseDate, warrantyWindowDays),
  };
}

export function computeStatus(
  returnWindowEndsAt: Date | null,
  warrantyEndsAt: Date | null,
  now: Date = new Date(),
): WarrantyItemStatus {
  const returnExpired = returnWindowEndsAt ? returnWindowEndsAt.getTime() < now.getTime() : true;
  const warrantyExpired = warrantyEndsAt ? warrantyEndsAt.getTime() < now.getTime() : true;

  if (returnExpired && warrantyExpired) {
    return "expired";
  }
  if (!returnExpired && daysUntil(returnWindowEndsAt!, now) <= NOTIFY_WINDOW_DAYS) {
    return "return_expiring";
  }
  if (!warrantyExpired && daysUntil(warrantyEndsAt!, now) <= NOTIFY_WINDOW_DAYS) {
    return "warranty_expiring";
  }
  return "active";
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
