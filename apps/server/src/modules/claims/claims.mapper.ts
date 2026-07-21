import type { Claim as PrismaClaim, ServiceCenterContact as PrismaContact, WarrantyItem as PrismaWarrantyItem } from "@prisma/client";
import type { Claim } from "@thrifty/shared";

type ClaimWithRelations = PrismaClaim & {
  warrantyItem: PrismaWarrantyItem;
  serviceCenterContact: PrismaContact | null;
};

export function toPublicClaim(claim: ClaimWithRelations): Claim {
  return {
    id: claim.id,
    warrantyItemId: claim.warrantyItemId,
    warrantyItemName: claim.warrantyItem.itemName,
    type: claim.type,
    status: claim.status,
    description: claim.description,
    serviceCenterContact: claim.serviceCenterContact
      ? {
          displayName: claim.serviceCenterContact.displayName,
          contactMethod: claim.serviceCenterContact.contactMethod,
          contactValue: claim.serviceCenterContact.contactValue,
          instructions: claim.serviceCenterContact.instructions,
        }
      : null,
    createdAt: claim.createdAt.toISOString(),
  };
}
