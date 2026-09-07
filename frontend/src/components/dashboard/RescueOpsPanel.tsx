"use client";

import { useAdvanceRescue, useRescueOps } from "@/lib/queries";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import type { PriorityLevel, RescueStatus } from "@/types";

const PRIORITY_TONE: Record<PriorityLevel, BadgeTone> = {
  low: "low",
  medium: "moderate",
  high: "high",
  critical: "critical",
};

const NEXT_STEP: Partial<Record<RescueStatus, { to: RescueStatus; label: string }>> = {
  assigned: { to: "en_route", label: "En route" },
  en_route: { to: "in_progress", label: "On scene" },
  in_progress: { to: "completed", label: "Complete" },
};

export function RescueOpsPanel() {
  const { data: ops = [], isLoading } = useRescueOps();
  const advance = useAdvanceRescue();

  const active = ops.filter((o) => o.status !== "completed" && o.status !== "cancelled");
  const completed = ops.filter((o) => o.status === "completed").length;

  return (
    <div className="border-t border-slate-800 px-4 py-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Rescue Ops</h2>
        <span className="text-xs text-slate-500">
          {active.length} active · {completed} completed
        </span>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : active.length === 0 ? (
        <p className="text-sm text-slate-500">
          No active operations. Verify an incident, then Dispatch.
        </p>
      ) : (
        <ul className="space-y-2">
          {active.map((op) => {
            const step = NEXT_STEP[op.status];
            return (
              <li key={op.id} className="rounded bg-slate-950/60 p-2.5 ring-1 ring-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">
                    Incident #{op.incident_id}
                  </span>
                  <Badge tone={PRIORITY_TONE[op.priority]}>{op.priority}</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {op.responder_name ?? "Unassigned"} ·{" "}
                  {op.eta_minutes != null ? `ETA ${op.eta_minutes} min` : "ETA —"} ·{" "}
                  <span className="text-slate-300">{op.status.replace("_", " ")}</span>
                </p>
                <div className="mt-2 flex gap-2">
                  {step && (
                    <button
                      onClick={() => advance.mutate({ id: op.id, status: step.to })}
                      disabled={advance.isPending}
                      className="rounded bg-emerald-800/60 px-2 py-1 text-xs font-semibold text-emerald-200 hover:bg-emerald-700/60 disabled:opacity-50"
                    >
                      {step.label}
                    </button>
                  )}
                  <button
                    onClick={() => advance.mutate({ id: op.id, status: "cancelled" })}
                    disabled={advance.isPending}
                    className="rounded bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-700 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
