import type {
  AuthorizeEmailResponse,
  ConnectEmailRequest,
  EmailConnection,
  ReviewDecisionRequest,
  ReviewEmailItem,
} from "@thrifty/shared";
import { authorizedRequest } from "./authClient";

export function authorizeEmailConnection(payload: ConnectEmailRequest) {
  return authorizedRequest<AuthorizeEmailResponse>("/email-connections/authorize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function listEmailConnections() {
  return authorizedRequest<{ connections: EmailConnection[] }>("/email-connections");
}

export function disconnectEmailConnection(id: string) {
  return authorizedRequest<{ disconnected: true }>(`/email-connections/${id}`, { method: "DELETE" });
}

export function syncEmailConnection(id: string) {
  return authorizedRequest<{ messagesSeen: number }>(`/email-connections/${id}/sync`, { method: "POST" });
}

export function listReviewQueue() {
  return authorizedRequest<{ items: ReviewEmailItem[] }>("/email-connections/review-queue");
}

export function approveReviewItem(id: string, patch?: ReviewDecisionRequest) {
  return authorizedRequest<{ created: boolean; warrantyItemId?: string }>(
    `/email-connections/review/${id}/approve`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch ?? {}),
    },
  );
}

export function rejectReviewItem(id: string) {
  return authorizedRequest<{ created: boolean }>(`/email-connections/review/${id}/reject`, {
    method: "POST",
  });
}
