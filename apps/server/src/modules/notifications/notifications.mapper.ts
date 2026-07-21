import type { Notification as PrismaNotification } from "@prisma/client";
import type { Notification } from "@thrifty/shared";

export function toPublicNotification(n: PrismaNotification): Notification {
  return {
    id: n.id,
    type: n.type,
    relatedWarrantyItemId: n.relatedWarrantyItemId,
    relatedSubscriptionId: n.relatedSubscriptionId,
    scheduledFor: n.scheduledFor.toISOString(),
    sentAt: n.sentAt?.toISOString() ?? null,
    status: n.status,
  };
}
