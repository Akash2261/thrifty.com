export interface ParsedReceipt {
  itemName: string;
  retailer: string;
  orderIdentifier: string | null;
  purchaseDate: Date | null;
  price: number | null;
  currency: string | null;
}

export interface RetailerParser {
  displayName: string;
  matchesSender(fromAddress: string): boolean;
  // Returns null if the sender matched but this specific message doesn't look like an order
  // confirmation/shipping email (e.g. a newsletter from the same domain) — falls through to the
  // Claude-based extractor rather than fabricating a receipt from unrelated content.
  parse(subject: string, textBody: string): ParsedReceipt | null;
}

function firstMatch(pattern: RegExp, text: string): string | null {
  return text.match(pattern)?.[1]?.trim() ?? null;
}

function firstPrice(text: string, symbolPattern: string, currency: string): { price: number; currency: string } | null {
  const match = text.match(new RegExp(`(?:${symbolPattern})\\s?([\\d,]+(?:\\.\\d{1,2})?)`));
  if (!match) return null;
  const price = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(price) ? { price, currency } : null;
}

// Order-confirmation subjects are the reliable "this is a receipt" signal; a shipping/delivery
// notice from the same sender still counts (it just means we might see the same order twice,
// which duplicate detection handles), but a promo/newsletter subject should fall through instead.
const ORDER_SUBJECT_HINT = /\b(order|shipped|shipping|delivered|invoice|receipt|confirmation)\b/i;

const amazonParser: RetailerParser = {
  displayName: "Amazon",
  matchesSender: (from) => /@(amazon\.(in|com))/i.test(from),
  parse(subject, textBody) {
    if (!ORDER_SUBJECT_HINT.test(subject)) return null;

    const itemName =
      firstMatch(/order of ["“]([^"”]+)["”]/i, subject) ??
      firstMatch(/["“]([^"”]{3,80})["”]/i, textBody) ??
      "Amazon order";
    const orderIdentifier = firstMatch(/Order\s*#\s*([\d-]{10,})/i, textBody);
    const inr = firstPrice(textBody, "₹|Rs\\.?", "INR");
    const usd = firstPrice(textBody, "\\$", "USD");
    const priceInfo = inr ?? usd;

    return {
      itemName,
      retailer: "Amazon",
      orderIdentifier,
      purchaseDate: null,
      price: priceInfo?.price ?? null,
      currency: priceInfo?.currency ?? null,
    };
  },
};

const flipkartParser: RetailerParser = {
  displayName: "Flipkart",
  matchesSender: (from) => /@(flipkart\.com|(mail\.)?flipkart\.com)/i.test(from),
  parse(subject, textBody) {
    if (!ORDER_SUBJECT_HINT.test(subject)) return null;

    const orderIdentifier = firstMatch(/\b(OD\d{15,})\b/i, textBody);
    const itemName = firstMatch(/["“]([^"”]{3,80})["”]/i, textBody) ?? "Flipkart order";
    const priceInfo = firstPrice(textBody, "₹|Rs\\.?", "INR");

    return {
      itemName,
      retailer: "Flipkart",
      orderIdentifier,
      purchaseDate: null,
      price: priceInfo?.price ?? null,
      currency: priceInfo?.currency ?? null,
    };
  },
};

const myntraParser: RetailerParser = {
  displayName: "Myntra",
  matchesSender: (from) => /@myntra\.com/i.test(from),
  parse(subject, textBody) {
    if (!ORDER_SUBJECT_HINT.test(subject)) return null;

    const orderIdentifier = firstMatch(/Order\s*ID\s*[:#]?\s*(\d{8,})/i, textBody);
    const itemName = firstMatch(/["“]([^"”]{3,80})["”]/i, textBody) ?? "Myntra order";
    const priceInfo = firstPrice(textBody, "₹|Rs\\.?", "INR");

    return {
      itemName,
      retailer: "Myntra",
      orderIdentifier,
      purchaseDate: null,
      price: priceInfo?.price ?? null,
      currency: priceInfo?.currency ?? null,
    };
  },
};

const cromaParser: RetailerParser = {
  displayName: "Croma",
  matchesSender: (from) => /@croma\.com/i.test(from),
  parse(subject, textBody) {
    if (!ORDER_SUBJECT_HINT.test(subject)) return null;
    const orderIdentifier = firstMatch(/Order\s*(?:No\.?|Number)\s*[:#]?\s*([A-Z0-9-]{6,})/i, textBody);
    const itemName = firstMatch(/["“]([^"”]{3,80})["”]/i, textBody) ?? "Croma order";
    const priceInfo = firstPrice(textBody, "₹|Rs\\.?", "INR");
    return {
      itemName,
      retailer: "Croma",
      orderIdentifier,
      purchaseDate: null,
      price: priceInfo?.price ?? null,
      currency: priceInfo?.currency ?? null,
    };
  },
};

const relianceDigitalParser: RetailerParser = {
  displayName: "Reliance Digital",
  matchesSender: (from) => /@reliancedigital\.in/i.test(from),
  parse(subject, textBody) {
    if (!ORDER_SUBJECT_HINT.test(subject)) return null;
    const orderIdentifier = firstMatch(/Order\s*(?:No\.?|Number)\s*[:#]?\s*([A-Z0-9-]{6,})/i, textBody);
    const itemName = firstMatch(/["“]([^"”]{3,80})["”]/i, textBody) ?? "Reliance Digital order";
    const priceInfo = firstPrice(textBody, "₹|Rs\\.?", "INR");
    return {
      itemName,
      retailer: "Reliance Digital",
      orderIdentifier,
      purchaseDate: null,
      price: priceInfo?.price ?? null,
      currency: priceInfo?.currency ?? null,
    };
  },
};

const appleParser: RetailerParser = {
  displayName: "Apple",
  matchesSender: (from) => /@(email\.apple\.com|apple\.com)/i.test(from),
  parse(subject, textBody) {
    if (!/\b(receipt|order|invoice)\b/i.test(subject)) return null;
    const orderIdentifier = firstMatch(/Order\s*(?:ID|No\.?)\s*[:#]?\s*([A-Z0-9]{8,})/i, textBody);
    const itemName = firstMatch(/["“]([^"”]{3,80})["”]/i, textBody) ?? "Apple order";
    const usd = firstPrice(textBody, "\\$", "USD");
    const inr = firstPrice(textBody, "₹|Rs\\.?", "INR");
    const priceInfo = usd ?? inr;
    return {
      itemName,
      retailer: "Apple",
      orderIdentifier,
      purchaseDate: null,
      price: priceInfo?.price ?? null,
      currency: priceInfo?.currency ?? null,
    };
  },
};

const RETAILER_PARSERS: RetailerParser[] = [
  amazonParser,
  flipkartParser,
  myntraParser,
  cromaParser,
  relianceDigitalParser,
  appleParser,
];

export function findRetailerParser(fromAddress: string): RetailerParser | null {
  return RETAILER_PARSERS.find((p) => p.matchesSender(fromAddress)) ?? null;
}
