import { z } from "zod";

export const SubscriptionCadenceSchema = z.enum(["weekly", "monthly", "yearly"]);
export type SubscriptionCadence = z.infer<typeof SubscriptionCadenceSchema>;

export const SubscriptionStatusSchema = z.enum(["active", "flagged", "cancelled"]);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;

export const DetectedSubscriptionSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  avgAmount: z.number(),
  currency: z.string(),
  cadence: SubscriptionCadenceSchema,
  firstSeen: z.string(),
  lastSeen: z.string(),
  status: SubscriptionStatusSchema,
  userConfirmedInUse: z.boolean().nullable(),
  detectedFromBank: z.boolean(),
  detectedFromEmail: z.boolean(),
});
export type DetectedSubscription = z.infer<typeof DetectedSubscriptionSchema>;

export const LinkedBankAccountSchema = z.object({
  id: z.string(),
  institutionName: z.string().nullable(),
  lastSyncedAt: z.string().nullable(),
});
export type LinkedBankAccount = z.infer<typeof LinkedBankAccountSchema>;

export const LinkSessionSchema = z.object({
  linkToken: z.string(),
  hostedLinkUrl: z.string(),
});
export type LinkSession = z.infer<typeof LinkSessionSchema>;

export const LinkStatusSchema = z.object({
  linked: z.boolean(),
  institutionName: z.string().nullable().optional(),
});
export type LinkStatus = z.infer<typeof LinkStatusSchema>;

export const ConfirmInUseRequestSchema = z.object({
  inUse: z.boolean(),
});
export type ConfirmInUseRequest = z.infer<typeof ConfirmInUseRequestSchema>;
