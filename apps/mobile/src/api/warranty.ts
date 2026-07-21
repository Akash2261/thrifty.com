import type { WarrantyItem, WarrantyItemPatch } from "@thrifty/shared";
import { authorizedRequest } from "./authClient";

export interface ReceiptImageAsset {
  uri: string;
  name: string;
  type: string;
}

export function uploadReceipt(asset: ReceiptImageAsset) {
  const formData = new FormData();
  formData.append("image", {
    uri: asset.uri,
    name: asset.name,
    type: asset.type,
  } as unknown as Blob);

  return authorizedRequest<{ item: WarrantyItem }>("/receipts", {
    method: "POST",
    body: formData,
  });
}

export function listWarrantyItems() {
  return authorizedRequest<{ items: WarrantyItem[] }>("/warranty-items");
}

export function getWarrantyItem(id: string) {
  return authorizedRequest<{ item: WarrantyItem }>(`/warranty-items/${id}`);
}

export function updateWarrantyItem(id: string, patch: WarrantyItemPatch) {
  return authorizedRequest<{ item: WarrantyItem }>(`/warranty-items/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

export function registerPushToken(pushToken: string) {
  return authorizedRequest<{ ok: true }>("/notifications/register-push-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pushToken }),
  });
}
