"use client";

import { useState, type FormEvent } from "react";
import { useCreateAlert } from "@/lib/queries";
import type { SeverityLevel } from "@/types";

const SEVERITIES: SeverityLevel[] = ["low", "moderate", "high", "very_high", "critical"];

/** Command-center: issue an area-wide alert (POST /alerts). Reaches every
 * citizen app live over SSE — banner, Authority Messages tab, and bell. */
export function AlertComposer() {
  const createAlert = useCreateAlert();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("flood_warning");
  const [severity, setSeverity] = useState<SeverityLevel>("high");
  const [message, setMessage] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    createAlert.mutate(
      { type: type.trim() || "advisory", severity, message: message.trim() },
      {
        onSuccess: () => {
          setMessage("");
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
        Issue Alert
        <span className="text-slate-500">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <form onSubmit={submit} className="mt-3 space-y-2">
          <div className="flex gap-2">
            <input
              value={type}
              onChange={(e) => setType(e.target.value)}
              placeholder="type e.g. flood_warning"
              className="flex-1 rounded bg-slate-950 px-2 py-1.5 text-xs text-slate-200 ring-1 ring-slate-800 focus:outline-none focus:ring-slate-600"
            />
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as SeverityLevel)}
              className="rounded bg-slate-950 px-2 py-1.5 text-xs text-slate-200 ring-1 ring-slate-800 focus:outline-none"
            >
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="Message shown to citizens…"
            className="w-full resize-none rounded bg-slate-950 px-2 py-1.5 text-xs text-slate-200 ring-1 ring-slate-800 focus:outline-none focus:ring-slate-600"
          />
          {createAlert.isError && (
            <p className="text-xs text-red-400">
              {createAlert.error instanceof Error ? createAlert.error.message : "Could not send alert."}
            </p>
          )}
          <button
            type="submit"
            disabled={createAlert.isPending || !message.trim()}
            className="w-full rounded bg-amber-700/70 px-2 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-600/70 disabled:opacity-50"
          >
            {createAlert.isPending ? "Sending…" : "Broadcast alert"}
          </button>
        </form>
      )}
    </div>
  );
}
