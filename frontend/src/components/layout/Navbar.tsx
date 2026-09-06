"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/Badge";

export function Navbar() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  function handleSignOut() {
    signOut();
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded bg-red-700 font-bold text-white">
            D
          </span>
          <span className="text-sm font-semibold tracking-widest text-slate-100">
            DRISHTI
          </span>
        </Link>

        <nav className="flex items-center gap-4 text-sm text-slate-300">
          {user?.role === "responder" || user?.role === "admin" ? (
            <Link href="/dashboard" className="hover:text-white">
              Command Center
            </Link>
          ) : (
            <Link href="/" className="hover:text-white">
              Home
            </Link>
          )}

          {user ? (
            <div className="flex items-center gap-3">
              <Badge tone="neutral">{user.role}</Badge>
              <span className="hidden sm:inline">{user.name}</span>
              <button
                onClick={handleSignOut}
                className="rounded border border-slate-700 px-3 py-1 text-slate-300 hover:border-slate-500 hover:text-white"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded border border-slate-700 px-3 py-1 hover:border-slate-500 hover:text-white"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="rounded bg-red-700 px-3 py-1 font-medium text-white hover:bg-red-600"
              >
                Register
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
