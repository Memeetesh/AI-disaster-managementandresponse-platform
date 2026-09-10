"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchMe, login as loginRequest, registerCitizen } from "@/lib/auth-api";
import type { User } from "@/types";

const TOKEN_KEY = "aasha_setu_token";

// Login / registration are removed for the demo build. When there's no
// valid stored session the app silently signs in as this shared account so
// it opens straight to the home screen. `registerCitizen` is the fallback
// in case the backend hasn't been seeded yet (it always creates a citizen).
const DEMO_CREDENTIALS = {
  name: "Demo Resident",
  phone: "9000000000",
  password: "drishtidemo",
};

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

  async function startDemoSession(): Promise<boolean> {
    try {
      let res;
      try {
        res = await loginRequest({
          phone: DEMO_CREDENTIALS.phone,
          password: DEMO_CREDENTIALS.password,
        });
      } catch {
        // Backend reachable but no demo user yet — create it (always a citizen).
        res = await registerCitizen(DEMO_CREDENTIALS);
      }
      window.localStorage.setItem(TOKEN_KEY, res.access_token);
      setToken(res.access_token);
      setUser(res.user);
      return true;
    } catch {
      return false;
    }
  }

  useEffect(() => {
    async function hydrate() {
      const stored = window.localStorage.getItem(TOKEN_KEY);
      if (stored) {
        try {
          const me = await fetchMe(stored);
          setToken(stored);
          setUser(me);
          setLoading(false);
          return;
        } catch {
          window.localStorage.removeItem(TOKEN_KEY);
        }
      }
      // An operator may have signed in via /login while we were hydrating —
      // don't clobber that session with the citizen demo account.
      if (window.localStorage.getItem(TOKEN_KEY)) {
        setLoading(false);
        return;
      }
      await startDemoSession();
      setLoading(false);
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
    // No login screen in the demo build — drop straight back into a fresh
    // demo session.
    setLoading(true);
    void startDemoSession().finally(() => setLoading(false));
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
