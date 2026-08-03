import type { CancellationOptions, CancellationRequest } from "@thrifty/shared";
import { authorizedRequest } from "./client";

export function getCancellationOptions(subscriptionId: string) {
  return authorizedRequest<CancellationOptions>(`/subscriptions/${subscriptionId}/cancellation-options`);
}

export function createCancellationRequest(subscriptionId: string) {
  return authorizedRequest<{ item: CancellationRequest }>(
    `/subscriptions/${subscriptionId}/cancellation-requests`,
    { method: "POST" },
  );
}

export function sendCancellationRequest(requestId: string) {
  return authorizedRequest<{ item: CancellationRequest }>(`/cancellation-requests/${requestId}/send`, {
    method: "POST",
  });
}
