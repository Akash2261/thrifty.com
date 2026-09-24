import { File } from "expo-file-system";
import type { WarrantyItem, WarrantyItemPatch } from "@thrifty/shared";
import { authorizedRequest } from "./authClient";

// Expo's global `fetch` (WinterCG-compliant, in use since SDK 54+ per apps/mobile/AGENTS.md's
// standing "read the versioned docs" instruction) only accepts real Blob/File instances in a
// FormData body — the classic React Native `{ uri, name, type }` object throws "Unsupported
// FormDataPart implementation". `expo-file-system`'s `File` class implements Blob and can be
// constructed directly from a file:// URI.
export function uploadReceipt(uri: string) {
  const formData = new FormData();
  formData.append("image", new File(uri));

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
