"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useLocation } from "@/hooks/useLocation";
import { submitSOS } from "@/lib/incidents-api";
import { ApiError } from "@/lib/api";
import type { Incident } from "@/types";

export default function SOSPage() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const location = useLocation();

  const [peopleAffected, setPeopleAffected] = useState(1);
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [audio, setAudio] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Incident | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (location.status !== "ok" || !token) return;
    setError(null);
    setSubmitting(true);
    try {
      const incident = await submitSOS(
        {
          latitude: location.lat,
          longitude: location.lon,
          peopleAffected,
          description: description || undefined,
          image,
          audio,
        },
        token
      );
      setResult(incident);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to submit SOS");
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || !user) {
    return <div className="px-4 py-8 text-sm text-slate-500">Loading…</div>;
  }

  if (result) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-900/40 text-red-300 ring-1 ring-red-700">
          ✓
        </div>
        <h1 className="text-xl font-bold text-white">SOS submitted</h1>
        <p className="mt-2 text-slate-400">
          Incident #{result.id} logged as <span className="font-semibold text-red-400">{result.severity}</span>{" "}
          severity, status <span className="font-mono">{result.status}</span>. A responder will review it.
        </p>
        <button
          onClick={() => router.push("/")}
          className="mt-6 rounded bg-red-700 px-5 py-2 font-semibold text-white hover:bg-red-600"
        >
          Back to home
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-xl font-bold text-white">Send SOS</h1>
      <p className="mt-1 text-sm text-slate-400">
        Use this only for a real emergency. Your GPS location is attached automatically.
      </p>

      <div className="mt-4 rounded border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm">
        {location.status === "loading" && <span className="text-slate-400">Locating…</span>}
        {location.status === "ok" && (
          <span className="font-mono text-slate-200">
            {location.lat.toFixed(5)}, {location.lon.toFixed(5)}
          </span>
        )}
        {location.status === "error" && (
          <span className="text-amber-400">
            Could not get your location: {location.error}. SOS cannot be sent without it.
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="mb-1 block text-sm text-slate-400">Number of people affected</label>
          <input
            type="number"
            min={0}
            required
            value={peopleAffected}
            onChange={(e) => setPeopleAffected(Number(e.target.value))}
            className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-red-600 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-400">What&apos;s happening?</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Water has entered my house. Three people are trapped on the second floor."
            className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-red-600 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-400">Photo (optional)</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImage(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-300"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-400">Voice message (optional)</label>
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => setAudio(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-300"
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={submitting || location.status !== "ok"}
          className="w-full rounded bg-red-700 py-3 font-semibold text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Sending…" : "Send SOS"}
        </button>
      </form>
    </div>
  );
}
