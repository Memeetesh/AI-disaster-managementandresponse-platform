"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchMe } from "@/lib/auth-api";
import type { User } from "@/types";

const TOKEN_KEY = "drishti_token";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  signIn: (token: string, user: User) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Hydrate from localStorage on mount, re-validating the token against
  // the backend rather than trusting whatever role was cached client-side.
  useEffect(() => {
    async function hydrate() {
      const stored = window.localStorage.getItem(TOKEN_KEY);
      if (!stored) {
        setLoading(false);
        return;
      }
      try {
        const me = await fetchMe(stored);
        setToken(stored);
        setUser(me);
      } catch {
        window.localStorage.removeItem(TOKEN_KEY);
      } finally {
        setLoading(false);
      }
    }
    void hydrate();
  }, []);

  function signIn(newToken: string, newUser: User) {
    window.localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
  }

  function signOut() {
    window.localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
