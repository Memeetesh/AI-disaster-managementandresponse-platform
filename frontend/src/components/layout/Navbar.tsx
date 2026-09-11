"use client";

import Link from "next/link";
import { Icon } from "@/components/citizen/Icon";
import { useAuth } from "@/lib/auth-context";

export function Navbar() {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate2-100">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-navy-800 font-bold text-white">
            A
          </span>
          <span className="text-sm font-bold tracking-tight text-navy-900">Aasha Setu</span>
        </Link>

        <nav className="flex items-center gap-4 text-sm text-slate2-500">
          {user?.role === "responder" || user?.role === "admin" ? (
            <Link href="/dashboard" className="font-medium hover:text-navy-800 transition-colors">
              Command Center
            </Link>
          ) : (
            <Link href="/" className="font-medium hover:text-navy-800 transition-colors">
              Home
            </Link>
          )}

          {user && (
            <div className="flex items-center gap-2.5">
              <span className="badge bg-navy-100 text-navy-700 capitalize">
                <Icon name="Shield" className="w-3 h-3" />
                {user.role}
              </span>
              <span className="hidden sm:inline text-navy-700 font-medium">{user.name}</span>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
