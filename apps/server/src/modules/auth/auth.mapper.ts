import type { User as PrismaUser } from "@prisma/client";
import { NotificationPreferencesSchema, type User } from "@thrifty/shared";

const INBOUND_EMAIL_DOMAIN = process.env.INBOUND_EMAIL_DOMAIN || "inbound.example.com";

export function toPublicUser(user: PrismaUser): User {
  return {
    id: user.id,
    email: user.email,
    phoneNumber: user.phoneNumber,
    authProvider: user.authProvider,
    tier: user.tier,
    inboundEmail: `${user.inboundEmailToken}@${INBOUND_EMAIL_DOMAIN}`,
    // Parses whatever subset is stored and fills in defaults for the rest, so adding a new
    // preference later doesn't require backfilling every existing user's row.
    notificationPreferences: NotificationPreferencesSchema.parse(user.notificationPreferences ?? {}),
    createdAt: user.createdAt.toISOString(),
  };
}
