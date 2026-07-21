import type { SubscriptionCadence } from "@thrifty/shared";

export interface SubscriptionLanguageMatch {
  merchantRaw: string;
  cadence: SubscriptionCadence;
  amount: number | null;
  currency: string | null;
}

// Known subscription-billing senders — these emails are near-certainly a subscription receipt
// regardless of exact wording, so cadence is inferred from the sender rather than parsed.
// Deliberately limited to senders that are subscription-only in nature — a mixed-purpose
// retailer domain (Amazon, Apple, Flipkart) that sends BOTH product orders and subscription
// renewals from the same address would misclassify every ordinary order as a subscription if
// matched by sender alone, since this check runs (and short-circuits the receipt/warranty path)
// before the retailer-parser step. Those stay covered only by the generic phrase+amount check
// below, which requires actual renewal language in the email, not just where it came from.
const KNOWN_SUBSCRIPTION_SENDERS: { pattern: RegExp; displayName: string; cadence: SubscriptionCadence }[] = [
  { pattern: /@netflix\.com/i, displayName: "Netflix", cadence: "monthly" },
  { pattern: /@spotify\.com/i, displayName: "Spotify", cadence: "monthly" },
  { pattern: /@hotstar\.com/i, displayName: "Disney+ Hotstar", cadence: "monthly" },
  { pattern: /@(mail\.)?youtube\.com/i, displayName: "YouTube Premium", cadence: "monthly" },
  { pattern: /@disneyplus\.com/i, displayName: "Disney+", cadence: "monthly" },
  { pattern: /@(mail\.)?hbomax\.com|@max\.com/i, displayName: "Max (HBO)", cadence: "monthly" },
  { pattern: /@(email\.)?zee5\.com/i, displayName: "ZEE5", cadence: "monthly" },
  { pattern: /@sonyliv\.com/i, displayName: "SonyLIV", cadence: "monthly" },
  { pattern: /@jiosaavn\.com/i, displayName: "JioSaavn", cadence: "monthly" },
  { pattern: /@notion\.so/i, displayName: "Notion", cadence: "monthly" },
  { pattern: /@slack\.com/i, displayName: "Slack", cadence: "monthly" },
  { pattern: /@zoom\.us/i, displayName: "Zoom", cadence: "monthly" },
];

// Generic recurring-billing language, for senders not in the known list above — a receipt/invoice
// email that also talks about renewal is very likely a subscription rather than a one-off
// purchase.
const CADENCE_PHRASES: { pattern: RegExp; cadence: SubscriptionCadence }[] = [
  { pattern: /\brenews?\s+(?:automatically\s+)?(?:every\s+month|monthly|on\b)/i, cadence: "monthly" },
  { pattern: /\bauto[\s-]?renew(?:al|s|ed)?\b/i, cadence: "monthly" },
  { pattern: /\byour\s+membership\s+renews?\b/i, cadence: "monthly" },
  { pattern: /\bnext\s+billing\s+date\b/i, cadence: "monthly" },
  { pattern: /\brenewal\s+date\b/i, cadence: "monthly" },
  { pattern: /\bmonthly\s+(?:subscription|plan|membership)\b/i, cadence: "monthly" },
  { pattern: /\bannual\s+(?:subscription|plan|membership)\b/i, cadence: "yearly" },
  { pattern: /\byearly\s+(?:subscription|plan|membership)\b/i, cadence: "yearly" },
  { pattern: /\bweekly\s+(?:subscription|plan|membership)\b/i, cadence: "weekly" },
];

// Symbol-based patterns first (unambiguous), then ISO-code-prefixed amounts — common in Indian
// and international billing emails that spell out "INR 999.00" / "USD 15.99" instead of using a
// currency symbol.
function extractAmount(text: string): { amount: number; currency: string } | null {
  const inr = text.match(/(?:₹|Rs\.?)\s?([\d,]+(?:\.\d{1,2})?)/);
  if (inr) return { amount: Number(inr[1].replace(/,/g, "")), currency: "INR" };
  const usd = text.match(/\$\s?([\d,]+(?:\.\d{1,2})?)/);
  if (usd) return { amount: Number(usd[1].replace(/,/g, "")), currency: "USD" };
  const eur = text.match(/€\s?([\d,]+(?:\.\d{1,2})?)/);
  if (eur) return { amount: Number(eur[1].replace(/,/g, "")), currency: "EUR" };
  const gbp = text.match(/£\s?([\d,]+(?:\.\d{1,2})?)/);
  if (gbp) return { amount: Number(gbp[1].replace(/,/g, "")), currency: "GBP" };

  const isoMatch = text.match(/\b(INR|USD|EUR|GBP)\s?([\d,]+(?:\.\d{1,2})?)/i);
  if (isoMatch) return { amount: Number(isoMatch[2].replace(/,/g, "")), currency: isoMatch[1].toUpperCase() };

  return null;
}

// Looks at a single email (sender + subject + body) and decides whether it reads like a
// subscription-billing notice. Not exhaustive — a merchant not in KNOWN_SUBSCRIPTION_SENDERS and
// without any recognizable renewal phrasing simply won't be detected this way; bank-transaction
// cadence detection (recurringDetection.ts) remains the primary signal.
export function detectSubscriptionLanguage(
  fromAddress: string,
  subject: string,
  textBody: string,
): SubscriptionLanguageMatch | null {
  const combined = `${subject}\n${textBody}`;
  const amountInfo = extractAmount(combined);

  const known = KNOWN_SUBSCRIPTION_SENDERS.find((s) => s.pattern.test(fromAddress));
  if (known) {
    return {
      merchantRaw: known.displayName,
      cadence: known.cadence,
      amount: amountInfo?.amount ?? null,
      currency: amountInfo?.currency ?? null,
    };
  }

  const phraseMatch = CADENCE_PHRASES.find((p) => p.pattern.test(combined));
  if (phraseMatch && amountInfo) {
    const domainMatch = fromAddress.match(/@([a-z0-9.-]+)/i);
    const merchantRaw = domainMatch ? domainMatch[1].replace(/\.(com|in|co)$/i, "") : subject.slice(0, 40);
    return {
      merchantRaw,
      cadence: phraseMatch.cadence,
      amount: amountInfo.amount,
      currency: amountInfo.currency,
    };
  }

  return null;
}
