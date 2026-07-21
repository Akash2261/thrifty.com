import type { CreateHouseholdRequest, HouseholdInfo, JoinHouseholdRequest, SharedItemsResponse } from "@thrifty/shared";
import { authorizedRequest } from "./authClient";

export function createHousehold(payload: CreateHouseholdRequest) {
  return authorizedRequest<{ household: HouseholdInfo }>("/household/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function joinHousehold(payload: JoinHouseholdRequest) {
  return authorizedRequest<{ household: HouseholdInfo }>("/household/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function leaveHousehold() {
  return authorizedRequest<{ left: true }>("/household/leave", { method: "POST" });
}

export function getHousehold() {
  return authorizedRequest<{ household: HouseholdInfo | null }>("/household");
}

export function getSharedItems() {
  return authorizedRequest<SharedItemsResponse>("/household/shared-items");
}
