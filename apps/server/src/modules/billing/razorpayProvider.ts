import Razorpay from "razorpay";
import { AppError } from "../../lib/errors";
import type { PaymentProvider } from "./paymentProvider";

// Razorpay Subscriptions don't support a truly indefinite billing cycle count — a large
// total_count is the standard workaround for an "until cancelled" plan; the merchant can cancel
// the subscription via the API at any time regardless of how many cycles remain.
const EFFECTIVELY_INDEFINITE_CYCLES = 1200; // 100 years of monthly billing

let client: Razorpay | null = null;
function getClient(): Razorpay {
  if (!client) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      throw new AppError("Billing isn't set up yet on the server (missing Razorpay credentials).", 503);
    }
    client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }
  return client;
}

export const razorpayProvider: PaymentProvider = {
  async createCheckoutSession(userId, userEmail) {
    const planId = process.env.RAZORPAY_PLAN_ID;
    if (!planId) {
      throw new AppError("Billing isn't set up yet on the server (missing RAZORPAY_PLAN_ID).", 503);
    }

    const razorpay = getClient();
    try {
      const subscription = await razorpay.subscriptions.create({
        plan_id: planId,
        total_count: EFFECTIVELY_INDEFINITE_CYCLES,
        customer_notify: 1,
        notify_info: { notify_email: userEmail },
        notes: { userId },
      });

      if (!subscription.short_url) {
        throw new AppError("Razorpay did not return a payment URL", 502);
      }
      return { checkoutUrl: subscription.short_url };
    } catch (err) {
      if (err instanceof AppError) throw err;
      console.error("Razorpay subscription creation failed", err);
      throw new AppError("Couldn't start checkout. Try again.", 502);
    }
  },

  async createOneTimeCharge({ reference, userEmail, amount, currency, description }) {
    const razorpay = getClient();
    try {
      const paymentLink = await razorpay.paymentLink.create({
        amount: Math.round(amount * 100), // paise
        currency,
        description,
        notify: { sms: false, email: true },
        customer: { email: userEmail },
        notes: { chargeReference: reference },
      });

      if (!paymentLink.short_url) {
        throw new AppError("Razorpay did not return a payment URL", 502);
      }
      return { checkoutUrl: paymentLink.short_url };
    } catch (err) {
      if (err instanceof AppError) throw err;
      console.error("Razorpay payment link creation failed", err);
      throw new AppError("Couldn't start checkout. Try again.", 502);
    }
  },
};

export type RazorpayBillingEvent =
  | { type: "activated"; userId: string; customerId: string; subscriptionId: string }
  | { type: "cancelled"; customerId: string }
  | { type: "savings_charge_completed"; chargeReference: string; providerChargeId: string }
  | { type: "ignored" };

export function parseRazorpayWebhook(rawBody: Buffer, signature: string): RazorpayBillingEvent {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new AppError("Razorpay webhook isn't configured (missing RAZORPAY_WEBHOOK_SECRET).", 503);
  }

  const bodyString = rawBody.toString("utf8");
  const isValid = Razorpay.validateWebhookSignature(bodyString, signature, webhookSecret);
  if (!isValid) {
    throw new AppError("Invalid Razorpay webhook signature", 400);
  }

  const payload = JSON.parse(bodyString);
  const subscriptionEntity = payload?.payload?.subscription?.entity;

  if (payload.event === "subscription.activated" && subscriptionEntity) {
    const userId = subscriptionEntity.notes?.userId;
    if (!userId) return { type: "ignored" };
    return {
      type: "activated",
      userId,
      customerId: subscriptionEntity.customer_id,
      subscriptionId: subscriptionEntity.id,
    };
  }

  if (payload.event === "subscription.cancelled" && subscriptionEntity) {
    return { type: "cancelled", customerId: subscriptionEntity.customer_id };
  }

  if (payload.event === "payment_link.paid") {
    const paymentLinkEntity = payload?.payload?.payment_link?.entity;
    const paymentEntity = payload?.payload?.payment?.entity;
    const chargeReference = paymentLinkEntity?.notes?.chargeReference;
    if (!chargeReference || !paymentEntity?.id) {
      return { type: "ignored" };
    }
    return { type: "savings_charge_completed", chargeReference, providerChargeId: paymentEntity.id };
  }

  return { type: "ignored" };
}
