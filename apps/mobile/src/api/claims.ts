import type { Claim, CreateClaimRequest, UpdateClaimRequest } from "@thrifty/shared";
import { authorizedRequest } from "./authClient";

export function createClaim(payload: CreateClaimRequest) {
  return authorizedRequest<{ claim: Claim }>("/claims", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function listClaims() {
  return authorizedRequest<{ claims: Claim[] }>("/claims");
}

export function updateClaim(id: string, patch: UpdateClaimRequest) {
  return authorizedRequest<{ claim: Claim }>(`/claims/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}
