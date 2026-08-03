import type {
  ConfirmCancelledResponse,
  ConfirmInUseRequest,
  DetectedSubscription,
  LinkedBankAccount,
  LinkSession,
  LinkStatus,
} from "@thrifty/shared";
import { authorizedRequest } from "./client";

export function createLinkSession() {
  return authorizedRequest<LinkSession>("/bank/link-token", { method: "POST" });
}

export function pollLinkStatus(linkToken: string) {
  return authorizedRequest<LinkStatus>("/bank/link-status", {
    method: "POST",
    body: JSON.stringify({ linkToken }),
  });
}

export function listLinkedAccounts() {
  return authorizedRequest<{ accounts: LinkedBankAccount[] }>("/bank/accounts");
}

export function syncBankAccounts() {
  return authorizedRequest<{ accountsSynced: number; transactionsFetched: number }>("/bank/sync", {
    method: "POST",
  });
}

export function listSubscriptions() {
  return authorizedRequest<{ items: DetectedSubscription[]; monthlyTotal: number; currency: string | null }>(
    "/subscriptions",
  );
}

export function confirmSubscriptionInUse(id: string, payload: ConfirmInUseRequest) {
  return authorizedRequest<{ item: DetectedSubscription }>(`/subscriptions/${id}/confirm-in-use`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function confirmSubscriptionCancelled(id: string) {
  return authorizedRequest<ConfirmCancelledResponse>(`/subscriptions/${id}/confirm-cancelled`, {
    method: "POST",
  });
}
