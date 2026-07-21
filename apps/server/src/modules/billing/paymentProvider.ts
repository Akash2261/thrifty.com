import type { Country } from "@thrifty/shared";
import { stripeProvider } from "./stripeProvider";
import { razorpayProvider } from "./razorpayProvider";

export interface CheckoutSessionResult {
  checkoutUrl: string;
}

export interface PaymentProvider {
  createCheckoutSession(userId: string, userEmail: string): Promise<CheckoutSessionResult>;
  // For revenue-share cancellation pricing — a one-off charge (not a recurring subscription).
  // `reference` round-trips through the checkout so the webhook can match the payment back to
  // the CancellationSavingsCharge row that requested it.
  createOneTimeCharge(params: {
    reference: string;
    userEmail: string;
    amount: number;
    currency: string;
    description: string;
  }): Promise<CheckoutSessionResult>;
}

export function getPaymentProvider(country: Country): PaymentProvider {
  return country === "US" ? stripeProvider : razorpayProvider;
}
