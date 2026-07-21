import { z } from "zod";

export const WhatsAppLinkResponseSchema = z.object({
  code: z.string(),
  expiresAt: z.string(),
  businessNumber: z.string().nullable(),
});
export type WhatsAppLinkResponse = z.infer<typeof WhatsAppLinkResponseSchema>;

export const WhatsAppStatusSchema = z.object({
  linked: z.boolean(),
  phoneNumber: z.string().nullable(),
});
export type WhatsAppStatus = z.infer<typeof WhatsAppStatusSchema>;
