import "server-only";
import type { User } from "@thrifty/shared";
import { BASE_URL, BackendAuthError, refreshBackendTokens } from "./backend";
import { clearTokens, getTokens, setTokens } from "./session";

export async function getCurrentUser(): Promise<User | null> {
  const { accessToken, refreshToken } = await getTokens();
  if (!accessToken) return null;

  let res = await fetch(`${BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (res.status === 401 && refreshToken) {
    try {
      const rotated = await refreshBackendTokens(refreshToken);
      await setTokens(rotated);
      res = await fetch(`${BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${rotated.accessToken}` },
        cache: "no-store",
      });
    } catch (err) {
      if (err instanceof BackendAuthError) {
        await clearTokens();
        return null;
      }
      throw err;
    }
  }

  if (!res.ok) return null;
  const data = await res.json();
  return data.user as User;
}
