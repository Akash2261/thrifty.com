import Stripe from "stripe";
import { AppError } from "../../lib/errors";
import type { PaymentProvider } from "./paymentProvider";

let client: Stripe | null = null;
function getClient(): Stripe {
  if (!client) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new AppError("Billing isn't set up yet on the server (missing Stripe credentials).", 503);
    }
    client = new Stripe(secretKey);
  }
  return client;
}

export const stripeProvider: PaymentProvider = {
  async createCheckoutSession(userId, userEmail) {
    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId) {
      throw new AppError("Billing isn't set up yet on the server (missing STRIPE_PRICE_ID).", 503);
    }

    const stripe = getClient();
    try {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        customer_email: userEmail,
        client_reference_id: userId,
        success_url: "thrifty://billing/success",
        cancel_url: "thrifty://billing/cancel",
      });

      if (!session.url) {
        throw new AppError("Stripe did not return a checkout URL", 502);
      }
      return { checkoutUrl: session.url };
    } catch (err) {
      if (err instanceof AppError) throw err;
      console.error("Stripe checkout session creation failed", err);
      throw new AppError("Couldn't start checkout. Try again.", 502);
    }
  },

  async createOneTimeCharge({ reference, userEmail, amount, currency, description }) {
    const stripe = getClient();
    try {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: currency.toLowerCase(),
              product_data: { name: description },
              // Stripe amounts are in the currency's smallest unit (cents/paise).
              unit_amount: Math.round(amount * 100),
            },
            quantity: 1,
          },
        ],
        customer_email: userEmail,
        // Prefixed so the webhook can tell a one-time savings charge apart from a subscription
        // checkout, which uses a plain userId here instead.
        client_reference_id: `savings:${reference}`,
        success_url: "thrifty://billing/success",
        cancel_url: "thrifty://billing/cancel",
      });

      if (!session.url) {
        throw new AppError("Stripe did not return a checkout URL", 502);
      }
      return { checkoutUrl: session.url };
    } catch (err) {
      if (err instanceof AppError) throw err;
      console.error("Stripe one-time charge creation failed", err);
      throw new AppError("Couldn't start checkout. Try again.", 502);
    }
  },
};

export type StripeBillingEvent =
  | { type: "activated"; userId: string; customerId: string; subscriptionId: string }
  | { type: "cancelled"; customerId: string }
  | { type: "savings_charge_completed"; chargeReference: string; providerChargeId: string }
  | { type: "ignored" };

export function parseStripeWebhook(rawBody: Buffer, signature: string): StripeBillingEvent {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new AppError("Stripe webhook isn't configured (missing STRIPE_WEBHOOK_SECRET).", 503);
  }

  // Signature verification is pure crypto over the webhook secret — it never calls the Stripe
  // API — so this throwaway client just needs a non-empty string to satisfy the constructor.
  const stripe = new Stripe("sk_unused_webhook_verification_only");
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    throw new AppError("Invalid Stripe webhook signature", 400);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    if (session.mode === "payment") {
      const reference = session.client_reference_id;
      if (!reference?.startsWith("savings:") || !session.payment_intent) {
        return { type: "ignored" };
      }
      return {
        type: "savings_charge_completed",
        chargeReference: reference.slice("savings:".length),
        providerChargeId: String(session.payment_intent),
      };
    }

    if (session.mode !== "subscription" || !session.client_reference_id || !session.customer || !session.subscription) {
      return { type: "ignored" };
    }
    return {
      type: "activated",
      userId: session.client_reference_id,
      customerId: String(session.customer),
      subscriptionId: String(session.subscription),
    };
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    return { type: "cancelled", customerId: String(subscription.customer) };
  }

  return { type: "ignored" };
}
