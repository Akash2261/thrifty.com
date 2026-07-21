import { prisma } from "../../db/prisma";

// Both sides are already normalized (lowercase, punctuation/numbers stripped) by
// normalizeMerchant, so a simple substring match handles minor variations like
// "netflix com" vs "netflix streaming" without needing exact equality.
export async function findKnownService(merchantNormalized: string) {
  const services = await prisma.knownService.findMany();
  return (
    services.find(
      (s) => merchantNormalized.includes(s.merchantPattern) || s.merchantPattern.includes(merchantNormalized),
    ) ?? null
  );
}
