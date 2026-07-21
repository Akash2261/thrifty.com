import { describe, expect, it } from "vitest";
import { detectSubscriptionLanguage } from "./subscriptionCadence";

describe("detectSubscriptionLanguage", () => {
  it("recognizes a known subscription sender regardless of wording", () => {
    const match = detectSubscriptionLanguage(
      "info@netflix.com",
      "Your receipt",
      "Thanks for being a member. Amount charged: ₹199",
    );
    expect(match).toEqual({ merchantRaw: "Netflix", cadence: "monthly", amount: 199, currency: "INR" });
  });

  it("recognizes generic renewal language from an unknown sender", () => {
    const match = detectSubscriptionLanguage(
      "billing@example-gym.com",
      "Payment receipt",
      "Your monthly subscription has been renewed. Next billing date: Aug 20. Amount: ₹999",
    );
    expect(match).toEqual({ merchantRaw: "example-gym", cadence: "monthly", amount: 999, currency: "INR" });
  });

  it("returns null for a one-off purchase receipt", () => {
    const match = detectSubscriptionLanguage(
      "orders@amazon.in",
      "Your order has shipped",
      "Your item will arrive tomorrow. Order total: ₹499",
    );
    expect(match).toBeNull();
  });

  it("does not misclassify a normal Amazon order as a subscription even with renewal-sounding words nearby", () => {
    // Amazon is deliberately NOT in the known-sender list because it sends both orders and Prime
    // renewals from the same domain — this guards against a sender-only match ever firing for it.
    const match = detectSubscriptionLanguage(
      "orders@amazon.in",
      "Your order confirmation",
      "Thanks for your order. This subscribe-and-save item repeats monthly. Order total: ₹499",
    );
    expect(match).toBeNull();
  });

  it("parses an ISO-currency-code amount (no symbol)", () => {
    const match = detectSubscriptionLanguage(
      "billing@example-app.com",
      "Payment receipt",
      "Your monthly subscription has been renewed. Amount: INR 599.00",
    );
    expect(match).toEqual({ merchantRaw: "example-app", cadence: "monthly", amount: 599, currency: "INR" });
  });

  it("recognizes a newly-added known subscription sender (ZEE5)", () => {
    const match = detectSubscriptionLanguage(
      "no-reply@zee5.com",
      "Your ZEE5 receipt",
      "Thanks for your subscription. Amount charged: ₹149",
    );
    expect(match).toEqual({ merchantRaw: "ZEE5", cadence: "monthly", amount: 149, currency: "INR" });
  });
});
