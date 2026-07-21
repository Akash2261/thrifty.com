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
      { merchantRaw: "NETFLIX.COM", amount: 199, currency: "INR", date: daysAgo(90) },
      { merchantRaw: "NETFLIX.COM", amount: 199, currency: "INR", date: daysAgo(60) },
      { merchantRaw: "NETFLIX.COM", amount: 199, currency: "INR", date: daysAgo(30) },
    ];

    const result = detectRecurringCharges(transactions);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      merchantNormalized: "netflix com",
      cadence: "monthly",
      avgAmount: 199,
    });
  });

  it("does not flag a single one-off purchase", () => {
    const transactions = [
      { merchantRaw: "Croma", amount: 34999, currency: "INR", date: daysAgo(10) },
    ];
    expect(detectRecurringCharges(transactions)).toHaveLength(0);
  });

  it("does not flag irregular, non-cadenced charges", () => {
    const transactions = [
      { merchantRaw: "Corner Store", amount: 125, currency: "INR", date: daysAgo(88) },
      { merchantRaw: "Corner Store", amount: 82, currency: "INR", date: daysAgo(51) },
      { merchantRaw: "Corner Store", amount: 400, currency: "INR", date: daysAgo(3) },
    ];
    expect(detectRecurringCharges(transactions)).toHaveLength(0);
  });

  it("does not flag same-cadence charges with wildly different amounts", () => {
    const transactions = [
      { merchantRaw: "Amazon", amount: 100, currency: "INR", date: daysAgo(90) },
      { merchantRaw: "Amazon", amount: 850, currency: "INR", date: daysAgo(60) },
      { merchantRaw: "Amazon", amount: 220, currency: "INR", date: daysAgo(30) },
    ];
    expect(detectRecurringCharges(transactions)).toHaveLength(0);
  });

  it("detects weekly cadence", () => {
    const transactions = [
      { merchantRaw: "Spotify", amount: 119, currency: "INR", date: daysAgo(21) },
      { merchantRaw: "Spotify", amount: 119, currency: "INR", date: daysAgo(14) },
      { merchantRaw: "Spotify", amount: 119, currency: "INR", date: daysAgo(7) },
    ];
    const result = detectRecurringCharges(transactions);
    expect(result).toHaveLength(1);
    expect(result[0].cadence).toBe("weekly");
  });
});
