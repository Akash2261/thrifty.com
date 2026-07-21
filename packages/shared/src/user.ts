import { z } from "zod";

export const TierSchema = z.enum(["free", "premium"]);
export type Tier = z.infer<typeof TierSchema>;

export const AuthProviderSchema = z.enum(["password", "phone", "google", "apple"]);
export type AuthProvider = z.infer<typeof AuthProviderSchema>;

export const NotificationPreferencesSchema = z.object({
  returnWindowReminders: z.boolean().default(true),
  warrantyReminders: z.boolean().default(true),
  subscriptionRenewalReminders: z.boolean().default(true),
  unusedSubscriptionDigest: z.boolean().default(true),
});
export type NotificationPreferences = z.infer<typeof NotificationPreferencesSchema>;

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email().nullable(),
  phoneNumber: z.string().nullable(),
  authProvider: AuthProviderSchema,
  tier: TierSchema,
  inboundEmail: z.string(),
  notificationPreferences: NotificationPreferencesSchema,
  createdAt: z.string(),
});
export type User = z.infer<typeof UserSchema>;
