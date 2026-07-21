import { z } from "zod";

export const ClaimTypeSchema = z.enum(["warranty_defect", "return_assistance"]);
export type ClaimType = z.infer<typeof ClaimTypeSchema>;

export const ClaimStatusSchema = z.enum(["draft", "submitted", "resolved"]);
export type ClaimStatus = z.infer<typeof ClaimStatusSchema>;

export const ServiceCenterContactSchema = z.object({
  displayName: z.string(),
  contactMethod: z.string(),
  contactValue: z.string(),
  instructions: z.string(),
});
export type ServiceCenterContact = z.infer<typeof ServiceCenterContactSchema>;

export const ClaimSchema = z.object({
  id: z.string(),
  warrantyItemId: z.string(),
  warrantyItemName: z.string(),
  type: ClaimTypeSchema,
  status: ClaimStatusSchema,
  description: z.string().nullable(),
  serviceCenterContact: ServiceCenterContactSchema.nullable(),
  createdAt: z.string(),
});
export type Claim = z.infer<typeof ClaimSchema>;

export const CreateClaimRequestSchema = z.object({
  warrantyItemId: z.string(),
  type: ClaimTypeSchema,
  description: z.string().optional(),
});
export type CreateClaimRequest = z.infer<typeof CreateClaimRequestSchema>;

export const UpdateClaimRequestSchema = z.object({
  status: ClaimStatusSchema.optional(),
  description: z.string().optional(),
});
export type UpdateClaimRequest = z.infer<typeof UpdateClaimRequestSchema>;
