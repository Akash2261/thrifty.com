import type { Claim, CreateClaimRequest, UpdateClaimRequest } from "@thrifty/shared";
import { authorizedRequest } from "./client";

export function listClaims() {
  return authorizedRequest<{ claims: Claim[] }>("/claims");
}

export function createClaim(payload: CreateClaimRequest) {
  return authorizedRequest<{ claim: Claim }>("/claims", { method: "POST", body: JSON.stringify(payload) });
}

export function updateClaim(id: string, patch: UpdateClaimRequest) {
  return authorizedRequest<{ claim: Claim }>(`/claims/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}
