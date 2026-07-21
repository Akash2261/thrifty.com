import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import type { User } from "@thrifty/shared";
import {
  ApiError,
  fetchMe,
  login,
  refresh,
  sendOtp as apiSendOtp,
  signInWithApple as apiSignInWithApple,
  signInWithGoogle as apiSignInWithGoogle,
  signup,
  verifyOtp as apiVerifyOtp,
} from "../api/client";
import { authorizedRequest } from "../api/authClient";
import * as TokenStorage from "../lib/tokenStorage";
import { onForceSignOut } from "../lib/sessionEvents";

const { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } = TokenStorage;

interface SessionContextValue {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  sendOtp: (phoneNumber: string) => Promise<void>;
  verifyOtp: (phoneNumber: string, code: string) => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<void>;
  signInWithApple: (idToken: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshUser: () => Promise<User>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

async function storeTokens(accessToken: string, refreshToken: string) {
  await TokenStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  await TokenStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

async function clearTokens() {
  await TokenStorage.deleteItem(ACCESS_TOKEN_KEY);
  await TokenStorage.deleteItem(REFRESH_TOKEN_KEY);
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const storedAccessToken = await TokenStorage.getItem(ACCESS_TOKEN_KEY);
      const storedRefreshToken = await TokenStorage.getItem(REFRESH_TOKEN_KEY);

      if (!storedAccessToken || !storedRefreshToken) {
        setIsLoading(false);
        return;
      }

      try {
        const { user: me } = await fetchMe(storedAccessToken);
        setUser(me);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          try {
            const tokens = await refresh(storedRefreshToken);
            await storeTokens(tokens.accessToken, tokens.refreshToken);
            const { user: me } = await fetchMe(tokens.accessToken);
            setUser(me);
          } catch {
            await clearTokens();
          }
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  useEffect(() => onForceSignOut(() => setUser(null)), []);

  const value = useMemo<SessionContextValue>(
    () => ({
      user,
      isLoading,
      async signIn(email, password) {
        const res = await login({ email, password });
        await storeTokens(res.accessToken, res.refreshToken);
        setUser(res.user);
      },
      async signUp(email, password) {
        const res = await signup({ email, password });
        await storeTokens(res.accessToken, res.refreshToken);
        setUser(res.user);
      },
      async sendOtp(phoneNumber) {
        await apiSendOtp({ phoneNumber });
      },
      async verifyOtp(phoneNumber, code) {
        const res = await apiVerifyOtp({ phoneNumber, code });
        await storeTokens(res.accessToken, res.refreshToken);
        setUser(res.user);
      },
      async signInWithGoogle(idToken) {
        const res = await apiSignInWithGoogle({ idToken });
        await storeTokens(res.accessToken, res.refreshToken);
        setUser(res.user);
      },
      async signInWithApple(idToken) {
        const res = await apiSignInWithApple({ idToken });
        await storeTokens(res.accessToken, res.refreshToken);
        setUser(res.user);
      },
      async signOut() {
        await clearTokens();
        setUser(null);
      },
      async deleteAccount() {
        await authorizedRequest("/auth/account", { method: "DELETE" });
        await clearTokens();
        setUser(null);
      },
      async refreshUser() {
        const { user: me } = await authorizedRequest<{ user: User }>("/auth/me");
        setUser(me);
        return me;
      },
    }),
    [user, isLoading],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return ctx;
}
