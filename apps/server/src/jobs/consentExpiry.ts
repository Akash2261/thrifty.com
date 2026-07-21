import { prisma } from "../db/prisma";

// Account Aggregator consents carry an explicit expiry the user agreed to when approving —
// once past it, the AA itself stops honoring the consent, so this just keeps our own status
// column truthful rather than leaving stale "active" consents around indefinitely.
export async function runConsentExpiryCheck(now: Date = new Date()) {
  const result = await prisma.bankConsent.updateMany({
    where: { status: "active", consentExpiry: { lt: now } },
    data: { status: "expired" },
  });
  return { consentsExpired: result.count };
}
