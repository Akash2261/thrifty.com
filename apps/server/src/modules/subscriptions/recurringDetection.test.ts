import { describe, expect, it } from "vitest";
import { detectRecurringCharges, normalizeMerchant } from "./recurringDetection";

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

describe("normalizeMerchant", () => {
  it("strips punctuation, numbers, and case differences", () => {
    expect(normalizeMerchant("NETFLIX.COM 4152")).toBe("netflix com");
    expect(normalizeMerchant("Netflix.com")).toBe("netflix com");
    expect(normalizeMerchant("SQ *COFFEE SHOP #12")).toBe("sq coffee shop");
  });
});

describe("detectRecurringCharges", () => {
  it("flags a monthly charge with a consistent amount", () => {
    const transactions = [
      { merchantRaw: "NETFLIX.COM", amount: 15.99, currency: "USD", date: daysAgo(90) },
      { merchantRaw: "NETFLIX.COM", amount: 15.99, currency: "USD", date: daysAgo(60) },
      { merchantRaw: "NETFLIX.COM", amount: 15.99, currency: "USD", date: daysAgo(30) },
    ];

    const result = detectRecurringCharges(transactions);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      merchantNormalized: "netflix com",
      cadence: "monthly",
      avgAmount: 15.99,
    });
  });

  it("does not flag a single one-off purchase", () => {
    const transactions = [
      { merchantRaw: "Best Buy", amount: 349.99, currency: "USD", date: daysAgo(10) },
    ];
    expect(detectRecurringCharges(transactions)).toHaveLength(0);
  });

  it("does not flag irregular, non-cadenced charges", () => {
    const transactions = [
      { merchantRaw: "Corner Store", amount: 12.5, currency: "USD", date: daysAgo(88) },
      { merchantRaw: "Corner Store", amount: 8.2, currency: "USD", date: daysAgo(51) },
      { merchantRaw: "Corner Store", amount: 40.0, currency: "USD", date: daysAgo(3) },
    ];
    expect(detectRecurringCharges(transactions)).toHaveLength(0);
  });

  it("does not flag same-cadence charges with wildly different amounts", () => {
    const transactions = [
      { merchantRaw: "Amazon", amount: 10, currency: "USD", date: daysAgo(90) },
      { merchantRaw: "Amazon", amount: 85, currency: "USD", date: daysAgo(60) },
      { merchantRaw: "Amazon", amount: 22, currency: "USD", date: daysAgo(30) },
    ];
    expect(detectRecurringCharges(transactions)).toHaveLength(0);
  });

  it("detects weekly cadence", () => {
    const transactions = [
      { merchantRaw: "Spotify", amount: 4.99, currency: "USD", date: daysAgo(21) },
      { merchantRaw: "Spotify", amount: 4.99, currency: "USD", date: daysAgo(14) },
      { merchantRaw: "Spotify", amount: 4.99, currency: "USD", date: daysAgo(7) },
    ];
    const result = detectRecurringCharges(transactions);
    expect(result).toHaveLength(1);
    expect(result[0].cadence).toBe("weekly");
  });
});
