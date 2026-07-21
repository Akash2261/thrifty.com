import { describe, expect, it } from "vitest";
import { findRetailerParser } from "./retailerParsers";

describe("retailerParsers", () => {
  it("parses an Amazon.in order confirmation", () => {
    const parser = findRetailerParser("auto-confirm@amazon.in");
    expect(parser?.displayName).toBe("Amazon");

    const parsed = parser!.parse(
      'Your Amazon.in order of "Sony WH-1000XM5 Headphones" has been placed.',
      'Order #406-1234567-7654321\nOrder Total: ₹24,990.00\nThanks for shopping with us.',
    );

    expect(parsed).toEqual({
      itemName: "Sony WH-1000XM5 Headphones",
      retailer: "Amazon",
      orderIdentifier: "406-1234567-7654321",
      purchaseDate: null,
      price: 24990,
      currency: "INR",
    });
  });

  it("parses a Flipkart order confirmation", () => {
    const parser = findRetailerParser("order-update@flipkart.com");
    const parsed = parser!.parse(
      "Order Confirmation - OD123456789012345",
      'Your order for "Boat Airdopes 141" has been confirmed.\nOrder ID: OD123456789012345\nAmount Paid: ₹1,299',
    );

    expect(parsed?.retailer).toBe("Flipkart");
    expect(parsed?.orderIdentifier).toBe("OD123456789012345");
    expect(parsed?.price).toBe(1299);
    expect(parsed?.currency).toBe("INR");
  });

  it("returns null for a matched sender whose subject isn't an order email", () => {
    const parser = findRetailerParser("newsletter@amazon.in");
    const parsed = parser!.parse("Today's deals just for you", "Check out these discounts!");
    expect(parsed).toBeNull();
  });

  it("returns null for an unrecognized sender", () => {
    expect(findRetailerParser("orders@some-random-shop.example")).toBeNull();
  });
});
