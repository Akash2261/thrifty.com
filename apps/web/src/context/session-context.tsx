"use client";

import type { User } from "@thrifty/shared";
import { createContext, useCallback, useContext, useState } from "react";
import { fetchMe, logout } from "@/lib/api/auth";

interface SessionContextValue {
  user: User;
  setUser: (user: User) => void;
  refreshUser: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({
  initialUser,
  children,
}: {
  initialUser: User;
  children: React.ReactNode;
}) {
  const [user, setUser] = useState(initialUser);

  const refreshUser = useCallback(async () => {
    const { user: refreshed } = await fetchMe();
    setUser(refreshed);
  }, []);

  const signOut = useCallback(async () => {
    await logout();
    window.location.href = "/sign-in";
  }, []);

  return (
    <SessionContext.Provider value={{ user, setUser, refreshUser, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within a SessionProvider");
  return ctx;
}
