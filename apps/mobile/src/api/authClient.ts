import { API_BASE_URL, ApiError, refresh as refreshTokens } from "./client";
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, getItem, setItem, deleteItem } from "../lib/tokenStorage";
import { emitForceSignOut } from "../lib/sessionEvents";

async function doFetch(path: string, accessToken: string, options: RequestInit) {
  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

async function parseJsonOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof body?.error === "string" ? body.error : "Something went wrong";
    throw new ApiError(response.status, message);
  }
  return body as T;
}

export async function authorizedRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const accessToken = await getItem(ACCESS_TOKEN_KEY);
  if (!accessToken) {
    emitForceSignOut();
    throw new ApiError(401, "Not signed in");
  }

  let response = await doFetch(path, accessToken, options);

  if (response.status === 401) {
    const refreshToken = await getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      emitForceSignOut();
      throw new ApiError(401, "Session expired");
    }

    try {
      const tokens = await refreshTokens(refreshToken);
      await setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
      await setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
      response = await doFetch(path, tokens.accessToken, options);
    } catch {
      await deleteItem(ACCESS_TOKEN_KEY);
      await deleteItem(REFRESH_TOKEN_KEY);
      emitForceSignOut();
      throw new ApiError(401, "Session expired");
    }
  }

  return parseJsonOrThrow<T>(response);
}

export async function authorizedAccessToken(): Promise<string | null> {
  return getItem(ACCESS_TOKEN_KEY);
}
