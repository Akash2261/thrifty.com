import { prisma } from "../../db/prisma";
import { AppError } from "../../lib/errors";
import { getWarrantyItem } from "../warranty/warranty.service";
import type { ClaimType } from "@thrifty/shared";

// Matches a warranty item's retailer against the ServiceCenterContact directory the same way
// cancellation matches KnownService — by normalized-ish substring match on the merchant pattern.
// Ships with zero real rows (see prisma/seed.ts) so this simply returns null until verified
// contacts are added.
async function findServiceCenterContact(retailer: string | null) {
  if (!retailer) return null;
  const normalized = retailer.toLowerCase();
  const contacts = await prisma.serviceCenterContact.findMany();
  return contacts.find((c) => normalized.includes(c.merchantPattern)) ?? null;
}

export async function createClaim(userId: string, warrantyItemId: string, type: ClaimType, description?: string) {
  const item = await getWarrantyItem(userId, warrantyItemId);
  const contact = await findServiceCenterContact(item.retailer);

  return prisma.claim.create({
    data: {
      userId,
      warrantyItemId: item.id,
      type,
      description: description ?? null,
      serviceCenterContactId: contact?.id ?? null,
    },
    include: { warrantyItem: true, serviceCenterContact: true },
  });
}

export async function listClaims(userId: string) {
  return prisma.claim.findMany({
    where: { userId },
    include: { warrantyItem: true, serviceCenterContact: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateClaim(userId: string, id: string, patch: { status?: string; description?: string }) {
  const existing = await prisma.claim.findFirst({ where: { id, userId } });
  if (!existing) {
    throw new AppError("Claim not found", 404);
  }

  return prisma.claim.update({
    where: { id },
    data: {
      status: (patch.status as any) ?? undefined,
      description: patch.description ?? undefined,
    },
    include: { warrantyItem: true, serviceCenterContact: true },
  });
}
