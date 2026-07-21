import { z } from "zod";

export const HouseholdRoleSchema = z.enum(["owner", "member"]);
export type HouseholdRole = z.infer<typeof HouseholdRoleSchema>;

export const HouseholdMemberSchema = z.object({
  userId: z.string(),
  email: z.string().nullable(),
  role: HouseholdRoleSchema,
});
export type HouseholdMember = z.infer<typeof HouseholdMemberSchema>;

export const HouseholdInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  inviteCode: z.string().nullable(),
  members: z.array(HouseholdMemberSchema),
});
export type HouseholdInfo = z.infer<typeof HouseholdInfoSchema>;

export const JoinHouseholdRequestSchema = z.object({
  inviteCode: z.string().min(1),
});
export type JoinHouseholdRequest = z.infer<typeof JoinHouseholdRequestSchema>;

export const CreateHouseholdRequestSchema = z.object({
  name: z.string().min(1).max(60),
});
export type CreateHouseholdRequest = z.infer<typeof CreateHouseholdRequestSchema>;

export const SharedWarrantyItemSchema = z.object({
  id: z.string(),
  itemName: z.string(),
  ownerEmail: z.string().nullable(),
  returnWindowEndsAt: z.string().nullable(),
  warrantyEndsAt: z.string().nullable(),
});
export type SharedWarrantyItem = z.infer<typeof SharedWarrantyItemSchema>;

export const SharedSubscriptionSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  ownerEmail: z.string().nullable(),
  avgAmount: z.number(),
  currency: z.string(),
});
export type SharedSubscription = z.infer<typeof SharedSubscriptionSchema>;

export const SharedItemsResponseSchema = z.object({
  warrantyItems: z.array(SharedWarrantyItemSchema),
  subscriptions: z.array(SharedSubscriptionSchema),
});
export type SharedItemsResponse = z.infer<typeof SharedItemsResponseSchema>;
