import type { DataUsageItem } from "@thrifty/shared";
import { authorizedRequest } from "./client";

export function getDataUsage() {
  return authorizedRequest<{ items: DataUsageItem[] }>("/account/data-usage");
}

// Needs auth, so it can't be a bare <a href> to the backend — same-origin proxy carries the
// session cookie and triggers a real file download via the passed-through Content-Disposition.
export function accountExportUrl(): string {
  return "/api/proxy/account/export";
}
