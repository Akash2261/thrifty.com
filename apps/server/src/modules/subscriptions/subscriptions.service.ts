import { prisma } from "../../db/prisma";
import { AppError } from "../../lib/errors";
import { detectRecurringCharges } from "./recurringDetection";
import { razorpayProvider } from "../billing/razorpayProvider";
import type { SubscriptionCadence } from "@thrifty/shared";

// The cut Thrifty takes of a year's savings when a user is on the revenue-share pricing model
// (as opposed to flat Premium) and confirms a cancellation actually went through.
const REVENUE_SHARE_PERCENTAGE = 0.25;

const ANNUAL_MULTIPLIER: Record<SubscriptionCadence, number> = {
  weekly: 52,
  monthly: 12,
  yearly: 1,
};

export async function detectAndUpsertSubscriptions(userId: string) {
  const transactions = await prisma.transaction.findMany({
    where: { linkedAccount: { userId } },
  });

  const candidates = detectRecurringCharges(
    transactions.map((t) => ({
      merchantRaw: t.merchantRaw,
      amount: t.amount,
      currency: t.currency,
      date: t.date,
    })),
  );

  for (const candidate of candidates) {
    await prisma.detectedSubscription.upsert({
      where: { userId_merchantNormalized: { userId, merchantNormalized: candidate.merchantNormalized } },
      create: {
        userId,
        merchantNormalized: candidate.merchantNormalized,
        displayName: candidate.displayName,
        avgAmount: candidate.avgAmount,
        currency: candidate.currency,
        cadence: candidate.cadence,
        firstSeen: candidate.firstSeen,
        lastSeen: candidate.lastSeen,
      },
      update: {
        displayName: candidate.displayName,
        avgAmount: candidate.avgAmount,
        cadence: candidate.cadence,
        lastSeen: candidate.lastSeen,
        // A merchant first detected via email (detectedFromBank defaults false on that create
        // path) needs this flipped to true once bank data confirms the same subscription too —
        // otherwise multi-source provenance never reflects bank confirmation for email-first rows.
        detectedFromBank: true,
      },
    });
  }

  return candidates.length;
}

export async function listSubscriptions(userId: string) {
  return prisma.detectedSubscription.findMany({
    where: { userId },
    orderBy: { avgAmount: "desc" },
  });
}

export async function confirmInUse(userId: string, id: string, inUse: boolean) {
  const existing = await prisma.detectedSubscription.findFirst({ where: { id, userId } });
  if (!existing) {
    throw new AppError("Subscription not found", 404);
  }

  return prisma.detectedSubscription.update({
    where: { id },
    data: {
      userConfirmedInUse: inUse,
      status: inUse ? "active" : "flagged",
    },
  });
}

// Called once a user tells us a cancellation (self-service, email, or manual) actually worked.
// Premium subscribers already pay flat, so there's nothing more to charge — everyone else is on
// the revenue-share model, so this kicks off a one-time payment for a cut of the savings.
export async function confirmCancelled(userId: string, subscriptionId: string) {
  const sub = await prisma.detectedSubscription.findFirst({ where: { id: subscriptionId, userId } });
  if (!sub) {
    throw new AppError("Subscription not found", 404);
  }

  await prisma.detectedSubscription.update({ where: { id: sub.id }, data: { status: "cancelled" } });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.tier === "premium") {
    return { charge: null, checkoutUrl: null };
  }
  if (!user.email) {
    throw new AppError("Add an email address to your account to confirm a cancellation.", 400);
  }

  const estimatedAnnualSavings = sub.avgAmount * ANNUAL_MULTIPLIER[sub.cadence];
  const chargeAmount = Math.round(estimatedAnnualSavings * REVENUE_SHARE_PERCENTAGE * 100) / 100;

  const charge = await prisma.cancellationSavingsCharge.create({
    data: {
      userId,
      detectedSubscriptionId: sub.id,
      estimatedAnnualSavings,
      chargeAmount,
      currency: sub.currency,
      provider: "razorpay",
    },
  });

  const { checkoutUrl } = await razorpayProvider.createOneTimeCharge({
    reference: charge.id,
    userEmail: user.email,
    amount: chargeAmount,
    currency: sub.currency,
    description: `Thrifty cancellation savings — ${sub.displayName}`,
  });

  return { charge, checkoutUrl };
}
