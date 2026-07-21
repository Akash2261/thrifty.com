import type { CancellationSavingsCharge as PrismaSavingsCharge, DetectedSubscription as PrismaDetectedSubscription } from "@prisma/client";
import type { DetectedSubscription, SavingsCharge } from "@thrifty/shared";

export function toPublicSubscription(sub: PrismaDetectedSubscription): DetectedSubscription {
  return {
    id: sub.id,
    displayName: sub.displayName,
    avgAmount: sub.avgAmount,
    currency: sub.currency,
    cadence: sub.cadence,
    firstSeen: sub.firstSeen.toISOString(),
    lastSeen: sub.lastSeen.toISOString(),
    status: sub.status,
    userConfirmedInUse: sub.userConfirmedInUse,
    detectedFromBank: sub.detectedFromBank,
    detectedFromEmail: sub.detectedFromEmail,
  };
}

export function toPublicSavingsCharge(charge: PrismaSavingsCharge): SavingsCharge {
  return {
    id: charge.id,
    estimatedAnnualSavings: charge.estimatedAnnualSavings,
    chargeAmount: charge.chargeAmount,
    currency: charge.currency,
    status: charge.status,
  };
}
