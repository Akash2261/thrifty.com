import type { WarrantyItem, WarrantyItemPatch } from "@thrifty/shared";
import { authorizedRequest } from "./client";

export function listWarrantyItems() {
  return authorizedRequest<{ items: WarrantyItem[] }>("/warranty-items");
}

export function getWarrantyItem(id: string) {
  return authorizedRequest<{ item: WarrantyItem }>(`/warranty-items/${id}`);
}

export function updateWarrantyItem(id: string, patch: WarrantyItemPatch) {
  return authorizedRequest<{ item: WarrantyItem }>(`/warranty-items/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function uploadReceipt(file: File | Blob) {
  const form = new FormData();
  form.append("image", file, file instanceof File ? file.name : "receipt.jpg");
  return authorizedRequest<{ item: WarrantyItem }>("/receipts", { method: "POST", body: form });
}

// Requires auth, so it can't be a bare <img src> to the backend — this same-origin proxy path
// carries the session cookie instead, and the proxy attaches the Bearer token server-side.
export function receiptImageUrl(id: string): string {
  return `/api/proxy/warranty-items/${id}/image`;
}
