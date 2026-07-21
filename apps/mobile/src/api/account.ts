import type { DataUsageResponse } from "@thrifty/shared";
import { API_BASE_URL, ApiError } from "./client";
import { authorizedAccessToken, authorizedRequest } from "./authClient";

export function getDataUsage() {
  return authorizedRequest<DataUsageResponse>("/account/data-usage");
}

export async function fetchAccountExportCsv(): Promise<string> {
  const token = await authorizedAccessToken();
  if (!token) {
    throw new ApiError(401, "Not signed in");
  }
  const response = await fetch(`${API_BASE_URL}/account/export`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new ApiError(response.status, "Couldn't export your data.");
  }
  return response.text();
}
