import "server-only";
import { cookies } from "next/headers";
import type { BackendTokens } from "./backend";

const ACCESS_COOKIE = "thrifty_at";
const REFRESH_COOKIE = "thrifty_rt";
const REFRESH_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export async function getTokens(): Promise<Partial<BackendTokens>> {
  const store = await cookies();
  return {
    accessToken: store.get(ACCESS_COOKIE)?.value,
    refreshToken: store.get(REFRESH_COOKIE)?.value,
  };
}

// Cookie writes only succeed from a Server Action or Route Handler. Calling this from a Server
// Component (e.g. a read-only refresh triggered by getCurrentUser()) throws — that's expected and
// safe to swallow here: the fetched data for *this* render is still correct, and the old refresh
// token remains valid until its own expiry regardless (see the note in backend.ts).
export async function setTokens(tokens: BackendTokens): Promise<void> {
  try {
    const store = await cookies();
    store.set(ACCESS_COOKIE, tokens.accessToken, cookieOptions);
    store.set(REFRESH_COOKIE, tokens.refreshToken, {
      ...cookieOptions,
      maxAge: REFRESH_MAX_AGE_SECONDS,
    });
  } catch {
    // Read-only context (Server Component) — nothing to do.
  }
}

export async function clearTokens(): Promise<void> {
  try {
    const store = await cookies();
    store.delete(ACCESS_COOKIE);
    store.delete(REFRESH_COOKIE);
  } catch {
    // Read-only context (Server Component) — nothing to do.
  }
}
