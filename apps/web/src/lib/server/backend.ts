import "server-only";

export const BASE_URL = process.env.THRIFTY_API_BASE_URL ?? "http://localhost:4000";

export interface BackendTokens {
  accessToken: string;
  refreshToken: string;
}

export class BackendAuthError extends Error {}

// The backend's refresh tokens are stateless JWTs with no revocation list (verified against
// apps/server/src/plugins/jwt.ts / auth.routes.ts — refresh only re-checks the signature), so a
// refresh call that can't persist its rotated cookies (e.g. triggered from a Server Component,
// which can't write cookies) is still safe: the old refresh token stays valid until its own 30-day
// expiry either way.
export async function refreshBackendTokens(refreshToken: string): Promise<BackendTokens> {
  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new BackendAuthError("Session expired");
  }
  return res.json();
}
