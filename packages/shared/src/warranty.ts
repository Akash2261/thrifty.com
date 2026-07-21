import { z } from "zod";

export const WarrantyItemStatusSchema = z.enum(["active", "return_expiring", "warranty_expiring", "expired"]);
export type WarrantyItemStatus = z.infer<typeof WarrantyItemStatusSchema>;

export const WarrantyItemSchema = z.object({
  id: z.string(),
  itemName: z.string(),
  retailer: z.string().nullable(),
  purchaseDate: z.string(),
  price: z.number().nullable(),
  currency: z.string().nullable(),
  sourceImageUrl: z.string().nullable(),
  returnWindowEndsAt: z.string().nullable(),
  warrantyEndsAt: z.string().nullable(),
  status: WarrantyItemStatusSchema,
});
export type WarrantyItem = z.infer<typeof WarrantyItemSchema>;

export const WarrantyItemPatchSchema = z.object({
  itemName: z.string().min(1).optional(),
  retailer: z.string().nullable().optional(),
  purchaseDate: z.string().optional(),
  price: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
});
export type WarrantyItemPatch = z.infer<typeof WarrantyItemPatchSchema>;

export const ExtractedReceiptSchema = z.object({
  itemName: z.string(),
  retailer: z.string().nullable(),
  purchaseDate: z.string().nullable(),
  price: z.number().nullable(),
  currency: z.string().nullable(),
});
export type ExtractedReceipt = z.infer<typeof ExtractedReceiptSchema>;
