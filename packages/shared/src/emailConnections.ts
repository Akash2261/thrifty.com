import { z } from "zod";

export const EmailProviderSchema = z.enum(["gmail", "outlook", "yahoo"]);
export type EmailProvider = z.infer<typeof EmailProviderSchema>;

export const EmailSyncStatusSchema = z.enum(["pending", "active", "error", "disconnected"]);
export type EmailSyncStatus = z.infer<typeof EmailSyncStatusSchema>;

export const EmailConnectionSchema = z.object({
  id: z.string(),
  provider: EmailProviderSchema,
  emailAddress: z.string(),
  historicalScanDepthDays: z.number(),
  syncStatus: EmailSyncStatusSchema,
  syncError: z.string().nullable(),
  lastSyncedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type EmailConnection = z.infer<typeof EmailConnectionSchema>;

export const ConnectEmailRequestSchema = z.object({
  provider: EmailProviderSchema,
  historicalScanDepthDays: z.number().int().min(7).max(365).default(30),
});
export type ConnectEmailRequest = z.infer<typeof ConnectEmailRequestSchema>;

export const AuthorizeEmailResponseSchema = z.object({
  authUrl: z.string(),
});
export type AuthorizeEmailResponse = z.infer<typeof AuthorizeEmailResponseSchema>;

export const ScannedEmailStatusSchema = z.enum(["saved", "pending_review", "duplicate", "ignored"]);
export type ScannedEmailStatusType = z.infer<typeof ScannedEmailStatusSchema>;

export const ReviewEmailItemSchema = z.object({
  id: z.string(),
  fromAddress: z.string(),
  subject: z.string(),
  extractedItemName: z.string().nullable(),
  extractedRetailer: z.string().nullable(),
  extractedPurchaseDate: z.string().nullable(),
  extractedPrice: z.number().nullable(),
  extractedCurrency: z.string().nullable(),
  rawTextSnippet: z.string().nullable(),
  createdAt: z.string(),
});
export type ReviewEmailItem = z.infer<typeof ReviewEmailItemSchema>;

export const ReviewDecisionRequestSchema = z.object({
  itemName: z.string().min(1).optional(),
  retailer: z.string().nullable().optional(),
  purchaseDate: z.string().optional(),
  price: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
});
export type ReviewDecisionRequest = z.infer<typeof ReviewDecisionRequestSchema>;
