import { z } from "zod";

export const CancellationMethodSchema = z.enum(["self_service_url", "email", "unknown"]);
export type CancellationMethod = z.infer<typeof CancellationMethodSchema>;

export const CancellationOptionsSchema = z.object({
  method: CancellationMethodSchema,
  displayName: z.string(),
  instructions: z.string(),
  selfServiceUrl: z.string().nullable(),
});
export type CancellationOptions = z.infer<typeof CancellationOptionsSchema>;

export const CancellationRequestStatusSchema = z.enum(["draft", "sent", "failed"]);
export type CancellationRequestStatus = z.infer<typeof CancellationRequestStatusSchema>;

export const CancellationRequestSchema = z.object({
  id: z.string(),
  recipientEmail: z.string().nullable(),
  draftSubject: z.string().nullable(),
  draftBody: z.string().nullable(),
  status: CancellationRequestStatusSchema,
  sentAt: z.string().nullable(),
});
export type CancellationRequest = z.infer<typeof CancellationRequestSchema>;
