import { daysUntil, type WarrantyItem } from "@thrifty/shared";

export interface Deadline {
  kind: "return" | "warranty";
  label: string;
  days: number;
  urgent: boolean;
}

function describe(kind: "return" | "warranty", isoDate: string): Deadline {
  const days = daysUntil(isoDate);
  const noun = kind === "warranty" ? "Warranty" : "Return window";
  const verb = kind === "warranty" ? "expires" : "closes";
  const verbPast = kind === "warranty" ? "expired" : "closed";

  const label =
    days < 0
      ? `${noun} ${verbPast}`
      : days === 0
        ? `${noun} ${verb} today`
        : `${noun} ${verb} in ${days} day${days === 1 ? "" : "s"}`;

  return { kind, label, days, urgent: days <= 3 };
}

// Picks whichever deadline (return window or warranty) is soonest, since that's the one the
// user needs to act on first.
export function nextDeadline(item: WarrantyItem): Deadline | null {
  const candidates: Deadline[] = [];
  if (item.returnWindowEndsAt) candidates.push(describe("return", item.returnWindowEndsAt));
  if (item.warrantyEndsAt) candidates.push(describe("warranty", item.warrantyEndsAt));
  if (!candidates.length) return null;
  return candidates.sort((a, b) => a.days - b.days)[0];
}
