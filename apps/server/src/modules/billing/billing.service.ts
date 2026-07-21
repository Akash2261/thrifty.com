import { prisma } from "../../db/prisma";
import { AppError } from "../../lib/errors";
import { track } from "../../lib/analytics";
import { getPaymentProvider } from "./paymentProvider";
import { parseStripeWebhook } from "./stripeProvider";
import { parseRazorpayWebhook } from "./razorpayProvider";

export async function createCheckoutSession(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.email) {
    // Stripe/Razorpay checkout notifications need an email; phone-only accounts don't have one yet.
    throw new AppError("Add an email address to your account before upgrading.", 400);
  }
  const provider = getPaymentProvider(user.country);
  return provider.createCheckoutSession(userId, user.email);
}

async function markSavingsChargeCompleted(chargeReference: string, providerChargeId: string) {
  await prisma.cancellationSavingsCharge
    .update({
      where: { id: chargeReference },
      data: { status: "charged", providerChargeId },
    })
    .catch((err) => {
      console.error(`Savings charge webhook for unknown charge ${chargeReference}`, err);
    });
}

export async function handleStripeWebhook(rawBody: Buffer, signature: string) {
  const event = parseStripeWebhook(rawBody, signature);

  if (event.type === "activated") {
    await prisma.user.update({
      where: { id: event.userId },
      data: {
        tier: "premium",
        billingCustomerId: event.customerId,
        billingSubscriptionId: event.subscriptionId,
      },
    });
    track(event.userId, "premium_activated");
  }

  if (event.type === "cancelled") {
    await prisma.user.updateMany({
      where: { billingCustomerId: event.customerId },
      data: { tier: "free" },
    });
  }

  if (event.type === "savings_charge_completed") {
    await markSavingsChargeCompleted(event.chargeReference, event.providerChargeId);
  }
}

export async function handleRazorpayWebhook(rawBody: Buffer, signature: string) {
  const event = parseRazorpayWebhook(rawBody, signature);

  if (event.type === "activated") {
    await prisma.user.update({
      where: { id: event.userId },
      data: {
        tier: "premium",
        billingCustomerId: event.customerId,
        billingSubscriptionId: event.subscriptionId,
      },
    });
    track(event.userId, "premium_activated");
  }

  if (event.type === "cancelled") {
    await prisma.user.updateMany({
      where: { billingCustomerId: event.customerId },
      data: { tier: "free" },
    });
  }

  if (event.type === "savings_charge_completed") {
    await markSavingsChargeCompleted(event.chargeReference, event.providerChargeId);
  }
}
