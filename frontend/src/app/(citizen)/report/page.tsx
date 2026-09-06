"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/citizen/Icon";
import { useAuth } from "@/lib/auth-context";
import { useLocation } from "@/hooks/useLocation";
import { submitReport } from "@/lib/incidents-api";
import { ApiError } from "@/lib/api";
import type { Incident, IncidentType } from "@/types";

const INCIDENT_TYPES: { value: IncidentType; label: string }[] = [
  { value: "flood", label: "Flood" },
  { value: "fire", label: "Fire" },
  { value: "earthquake", label: "Earthquake" },
  { value: "cyclone", label: "Cyclone" },
  { value: "landslide", label: "Landslide" },
  { value: "other", label: "Other" },
];

export default function ReportPage() {
  const { token } = useAuth();
  const router = useRouter();
  const location = useLocation();

  const [type, setType] = useState<IncidentType>("flood");
  const [peopleAffected, setPeopleAffected] = useState(0);
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [audio, setAudio] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Incident | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (location.status !== "ok" || !token) return;
    setError(null);
    setSubmitting(true);
    try {
      const incident = await submitReport(
        { latitude: location.lat, longitude: location.lon, type, peopleAffected, description: description || undefined, image, audio },
        token
      );
      setResult(incident);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center animate-fade-in">
        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-safe-100 text-safe-600">
          <Icon name="CheckCircle2" className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-bold text-navy-900">Report submitted</h1>
        <p className="mt-2 text-sm text-slate2-600">
          Incident #{result.id} logged as <span className="font-semibold">{result.severity}</span> severity, status{" "}
          <span className="font-mono">{result.status}</span>. Thank you for helping keep the map accurate.
        </p>
        <button onClick={() => router.push("/")} className="btn-primary mt-6">
          Back to home
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg animate-fade-in">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-xl bg-warn-50 flex items-center justify-center">
          <Icon name="AlertTriangle" className="w-5 h-5 text-warn-600" />
        </div>
        <h1 className="text-xl font-bold text-navy-900">Report an Incident</h1>
      </div>
      <p className="text-sm text-slate2-500">
        For non-emergencies — e.g. a flooded road with no one in danger. Use{" "}
        <span className="font-semibold text-danger-600">Emergency SOS</span> instead if someone is in immediate danger.
      </p>

      <div className="mt-4 card px-4 py-3 text-sm flex items-center gap-2">
        <Icon name="MapPin" className="w-4 h-4 text-slate2-400 flex-shrink-0" />
        {location.status === "loading" && <span className="text-slate2-500">Locating…</span>}
        {location.status === "ok" && (
          <span className="font-mono text-navy-700">
            {location.lat.toFixed(5)}, {location.lon.toFixed(5)}
          </span>
        )}
        {location.status === "error" && (
          <span className="text-warn-600">Could not get your location: {location.error}. A report cannot be sent without it.</span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate2-600">Incident type</label>
          <select value={type} onChange={(e) => setType(e.target.value as IncidentType)} className="input">
            {INCIDENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate2-600">People affected (if any)</label>
          <input type="number" min={0} value={peopleAffected} onChange={(e) => setPeopleAffected(Number(e.target.value))} className="input" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate2-600">Description</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Main road near the market is flooded, cars are turning back."
            className="input min-h-[80px] resize-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate2-600">Photo (optional)</label>
          <input type="file" accept="image/*" onChange={(e) => setImage(e.target.files?.[0] ?? null)} className="block w-full text-sm text-slate2-600" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate2-600">Voice note (optional)</label>
          <input type="file" accept="audio/*" onChange={(e) => setAudio(e.target.files?.[0] ?? null)} className="block w-full text-sm text-slate2-600" />
        </div>

        {error && <p className="text-sm text-danger-600">{error}</p>}

        <button type="submit" disabled={submitting || location.status !== "ok"} className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50">
          <Icon name="Send" className="w-4 h-4" />
          {submitting ? "Submitting…" : "Submit report"}
        </button>
      </form>
    </div>
  );
}
