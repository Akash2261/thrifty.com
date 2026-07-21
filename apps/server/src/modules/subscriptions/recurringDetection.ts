import type { SubscriptionCadence } from "@thrifty/shared";

export interface DetectionInputTransaction {
  merchantRaw: string;
  amount: number;
  currency: string;
  date: Date;
}

export interface RecurringCandidate {
  merchantNormalized: string;
  displayName: string;
  avgAmount: number;
  currency: string;
  cadence: SubscriptionCadence;
  firstSeen: Date;
  lastSeen: Date;
}

const CADENCE_BANDS: { cadence: SubscriptionCadence; min: number; max: number; tolerance: number }[] = [
  { cadence: "weekly", min: 5, max: 9, tolerance: 2 },
  { cadence: "monthly", min: 25, max: 35, tolerance: 5 },
  { cadence: "yearly", min: 350, max: 380, tolerance: 15 },
];

const MAX_AMOUNT_DEVIATION = 0.15; // charges must stay within ±15% of the average to count as "recurring"

// Merchant names arrive from banks/cards as messy strings ("NETFLIX.COM 4152", "SQ *COFFEE SHOP
// #12") — this strips punctuation, store/location numbers, and extra whitespace so the same
// underlying merchant groups together across transactions. It's a heuristic, not a merchant
// database lookup, so unusual formatting can still slip through ungrouped.
export function normalizeMerchant(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b\d+\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function classifyCadence(medianDeltaDays: number): { cadence: SubscriptionCadence; tolerance: number } | null {
  const band = CADENCE_BANDS.find((b) => medianDeltaDays >= b.min && medianDeltaDays <= b.max);
  return band ? { cadence: band.cadence, tolerance: band.tolerance } : null;
}

// Groups transactions by normalized merchant, then flags a group as a recurring subscription
// only if (a) charge dates fall at a consistent weekly/monthly/yearly interval and (b) the
// amount stays roughly constant — a one-off double purchase at the same store won't qualify.
export function detectRecurringCharges(
  transactions: DetectionInputTransaction[],
): RecurringCandidate[] {
  const groups = new Map<string, DetectionInputTransaction[]>();
  for (const txn of transactions) {
    const key = normalizeMerchant(txn.merchantRaw);
    if (!key) continue;
    const group = groups.get(key) ?? [];
    group.push(txn);
    groups.set(key, group);
  }

  const candidates: RecurringCandidate[] = [];

  for (const [merchantNormalized, group] of groups) {
    if (group.length < 2) continue;

    const sorted = [...group].sort((a, b) => a.date.getTime() - b.date.getTime());
    const deltas: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const days = (sorted[i].date.getTime() - sorted[i - 1].date.getTime()) / (1000 * 60 * 60 * 24);
      deltas.push(days);
    }

    const medianDelta = median(deltas);
    const classification = classifyCadence(medianDelta);
    if (!classification) continue;

    const isRegular = deltas.every((d) => Math.abs(d - medianDelta) <= classification.tolerance);
    if (!isRegular) continue;

    const amounts = sorted.map((t) => t.amount);
    const avgAmount = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
    const maxDeviation = Math.max(...amounts.map((a) => Math.abs(a - avgAmount))) / avgAmount;
    if (maxDeviation > MAX_AMOUNT_DEVIATION) continue;

    candidates.push({
      merchantNormalized,
      displayName: sorted[sorted.length - 1].merchantRaw,
      avgAmount,
      currency: sorted[sorted.length - 1].currency,
      cadence: classification.cadence,
      firstSeen: sorted[0].date,
      lastSeen: sorted[sorted.length - 1].date,
    });
  }

  return candidates;
}
