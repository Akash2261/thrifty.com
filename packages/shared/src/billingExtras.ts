import { z } from "zod";

export const ChargeStatusSchema = z.enum(["pending", "charged", "failed"]);
export type ChargeStatus = z.infer<typeof ChargeStatusSchema>;

export const SavingsChargeSchema = z.object({
  id: z.string(),
  estimatedAnnualSavings: z.number(),
  chargeAmount: z.number(),
  currency: z.string(),
  status: ChargeStatusSchema,
});
export type SavingsCharge = z.infer<typeof SavingsChargeSchema>;

export const ConfirmCancelledResponseSchema = z.object({
  charge: SavingsChargeSchema.nullable(),
  checkoutUrl: z.string().nullable(),
});
export type ConfirmCancelledResponse = z.infer<typeof ConfirmCancelledResponseSchema>;

export const DataUsageItemSchema = z.object({
  category: z.string(),
  whatWeRead: z.string(),
  why: z.string(),
});
export type DataUsageItem = z.infer<typeof DataUsageItemSchema>;

export const DataUsageResponseSchema = z.object({ items: z.array(DataUsageItemSchema) });
export type DataUsageResponse = z.infer<typeof DataUsageResponseSchema>;
