"use client";

import { useState, type FormEvent } from "react";
import { useCreateIncident } from "@/lib/queries";
import type { IncidentType, SeverityLevel } from "@/types";

const TYPES: IncidentType[] = ["flood", "fire", "earthquake", "cyclone", "landslide", "other"];
const SEVERITIES: SeverityLevel[] = ["low", "moderate", "high", "very_high", "critical"];

const FIELD =
  "rounded bg-slate-950 px-2 py-1.5 text-xs text-slate-200 ring-1 ring-slate-800 focus:outline-none focus:ring-slate-600";

/** Command-center logs a phoned-in incident (POST /incidents). */
export function ManualIncidentForm() {
  const create = useCreateIncident();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<IncidentType>("flood");
  const [severity, setSeverity] = useState<SeverityLevel>("moderate");
  const [lat, setLat] = useState("13.0827");
  const [lon, setLon] = useState("80.2707");
  const [people, setPeople] = useState("0");
  const [description, setDescription] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    const latitude = Number(lat);
    const longitude = Number(lon);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) return;
    create.mutate(
      {
        type,
        latitude,
        longitude,
        severity,
        people_affected: Number(people) || 0,
        description: description.trim() || undefined,
      },
      {
        onSuccess: () => {
          setDescription("");
          setPeople("0");
          setOpen(false);
        },
      }
    );
  }

  return (
    <div className="border-t border-slate-800 px-4 py-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-sm font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-200"
      >
        Log Incident (phoned in)
        <span className="text-slate-500">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <form onSubmit={submit} className="mt-3 space-y-2">
          <div className="flex gap-2">
            <select value={type} onChange={(e) => setType(e.target.value as IncidentType)} className={`${FIELD} flex-1`}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as SeverityLevel)}
              className={`${FIELD} flex-1`}
            >
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="lat" className={`${FIELD} flex-1`} />
            <input value={lon} onChange={(e) => setLon(e.target.value)} placeholder="lon" className={`${FIELD} flex-1`} />
            <input
              value={people}
              onChange={(e) => setPeople(e.target.value)}
              placeholder="people"
              inputMode="numeric"
              className={`${FIELD} w-16`}
            />
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Description…"
            className={`${FIELD} w-full resize-none`}
          />
          {create.isError && (
            <p className="text-xs text-red-400">
              {create.error instanceof Error ? create.error.message : "Could not log incident."}
            </p>
          )}
          <button
            type="submit"
            disabled={create.isPending}
            className="w-full rounded bg-slate-700 px-2 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-600 disabled:opacity-50"
          >
            {create.isPending ? "Logging…" : "Log incident"}
          </button>
        </form>
      )}
    </div>
  );
}
