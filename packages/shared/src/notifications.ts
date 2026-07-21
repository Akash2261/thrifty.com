import { z } from "zod";
import { NotificationPreferencesSchema } from "./user";

export const NotificationTypeSchema = z.enum([
  "return_window",
  "warranty_expiry",
  "subscription_renewal",
  "unused_subscription",
]);
export type NotificationType = z.infer<typeof NotificationTypeSchema>;

export const NotificationStatusSchema = z.enum(["pending", "sent", "dismissed", "actioned"]);
export type NotificationStatus = z.infer<typeof NotificationStatusSchema>;

export const NotificationSchema = z.object({
  id: z.string(),
  type: NotificationTypeSchema,
  relatedWarrantyItemId: z.string().nullable(),
  relatedSubscriptionId: z.string().nullable(),
  scheduledFor: z.string(),
  sentAt: z.string().nullable(),
  status: NotificationStatusSchema,
});
export type Notification = z.infer<typeof NotificationSchema>;

export const UpdateNotificationPreferencesRequestSchema = NotificationPreferencesSchema.partial();
export type UpdateNotificationPreferencesRequest = z.infer<
  typeof UpdateNotificationPreferencesRequestSchema
>;
