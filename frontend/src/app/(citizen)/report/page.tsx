"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/citizen/Icon";
import { useAuth } from "@/lib/auth-context";
import { useLocation } from "@/hooks/useLocation";
import { useIncident, useSubmitReport } from "@/lib/queries";
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
  const submitReport = useSubmitReport();

  const [type, setType] = useState<IncidentType>("flood");
  const [peopleAffected, setPeopleAffected] = useState(0);
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [audio, setAudio] = useState<File | null>(null);
  const [result, setResult] = useState<Incident | null>(null);

  // Live status of the just-submitted incident — realtime patches this key
  // when a responder verifies/rejects it, so the confirmation screen updates
  // in place without a refresh.
  const liveIncident = useIncident(result?.id ?? null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (location.status !== "ok" || !token) return;
    submitReport.mutate(
      {
        latitude: location.lat,
        longitude: location.lon,
        type,
        peopleAffected,
        description: description || undefined,
        image,
        audio,
      },
      { onSuccess: (incident) => setResult(incident) }
    );
  }

  if (result) {
    const status = liveIncident.data?.status ?? result.status;
    const severity = liveIncident.data?.severity ?? result.severity;
    return (
      <div className="mx-auto max-w-lg py-16 text-center animate-fade-in">
        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-safe-100 text-safe-600">
          <Icon name="CheckCircle2" className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-bold text-navy-900">Report submitted</h1>
        <p className="mt-2 text-sm text-slate2-600">
          Incident #{result.id} logged as <span className="font-semibold">{severity}</span> severity, status{" "}
          <span className="font-mono">{status}</span>.
        </p>
        <p className="mt-1 text-xs text-slate2-400">
          This updates live as a responder reviews it.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link href="/reports" className="btn-primary">
            View my reports
          </Link>
          <button onClick={() => router.push("/")} className="btn-secondary">
            Back to home
          </button>
        </div>
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

        {submitReport.isError && (
          <p className="text-sm text-danger-600">
            {submitReport.error instanceof Error ? submitReport.error.message : "Failed to submit report"}
          </p>
        )}

        <button
          type="submit"
          disabled={submitReport.isPending || location.status !== "ok"}
          className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon name="Send" className="w-4 h-4" />
          {submitReport.isPending ? "Submitting…" : "Submit report"}
        </button>
      </form>
    </div>
  );
}
