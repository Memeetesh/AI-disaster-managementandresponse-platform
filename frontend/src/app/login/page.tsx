"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/auth-api";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";

/**
 * Operator sign-in for the demo build. The citizen app auto-signs-in as the
 * seeded resident (see auth-context) and needs no login page — this route
 * exists so a responder/admin can reach `/dashboard`, e.g. to watch an SOS
 * sent from the Android app land live. Seeded by `seed_demo_data.py`:
 *   admin — phone 9000000001 / drishtiops
 */
export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await login({ phone, password });
      signIn(res.access_token, res.user);
      router.push(res.user.role === "citizen" ? "/" : "/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col justify-center px-4 py-16">
      <h1 className="mb-1 text-xl font-bold text-white">Operator sign in</h1>
      <p className="mb-6 text-sm text-slate-500">
        Command-center access. The citizen app doesn&apos;t use this page.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-slate-400">Phone number</label>
          <input
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-red-600 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-400">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-red-600 focus:outline-none"
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-red-700 py-2 font-semibold text-white hover:bg-red-600 disabled:opacity-50"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-4 text-xs text-slate-600">
        Demo admin: <span className="font-mono text-slate-400">9000000001 / drishtiops</span>
      </p>
    </div>
  );
}
