"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { useRealtimeStatus } from "@/lib/realtime";
import {
  queryKeys,
  useDashboardStats,
  useDispatch,
  useIncidents,
  useRescueOps,
  useResponders,
  useRiskMap,
  useShelters,
  useUpdateIncident,
} from "@/lib/queries";
import { RiskMap } from "@/components/map/RiskMap";
import { SimulatorPanel } from "@/components/simulator/SimulatorPanel";
import { AlertComposer } from "@/components/dashboard/AlertComposer";
import { RescueOpsPanel } from "@/components/dashboard/RescueOpsPanel";
import { ManualIncidentForm } from "@/components/dashboard/ManualIncidentForm";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import type { PriorityLevel, RiskZoneProperties, SeverityLevel } from "@/types";

const SEVERITY_TONE: Record<SeverityLevel, BadgeTone> = {
  low: "low",
  moderate: "moderate",
  high: "high",
  very_high: "critical",
  critical: "critical",
};

const PRIORITY_TONE: Record<PriorityLevel, BadgeTone> = {
  low: "low",
  medium: "moderate",
  high: "high",
  critical: "critical",
};

const RISK_LEGEND: { category: string; label: string; color: string }[] = [
  { category: "low", label: "Low", color: "#16a34a" },
  { category: "moderate", label: "Moderate", color: "#ca8a04" },
  { category: "high", label: "High", color: "#ea580c" },
  { category: "very_high", label: "Very high", color: "#dc2626" },
  { category: "critical", label: "Critical", color: "#7f1d1d" },
];

export default function DashboardPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { connected } = useRealtimeStatus();

  const [selectedZone, setSelectedZone] = useState<RiskZoneProperties | null>(null);

  const incidentsQuery = useIncidents({ sort: "priority" });
  const riskMapQuery = useRiskMap();
  const sheltersQuery = useShelters();
  const respondersQuery = useResponders();
  const rescueOpsQuery = useRescueOps();
  const statsQuery = useDashboardStats();
  const updateIncident = useUpdateIncident();
  const dispatch = useDispatch();

  const incidents = incidentsQuery.data ?? [];
  const riskMap = riskMapQuery.data;
  const shelters = sheltersQuery.data ?? [];
  const responders = respondersQuery.data ?? [];
  const rescueOps = rescueOpsQuery.data ?? [];
  const incidentsLoading = incidentsQuery.isLoading;

  useEffect(() => {
    if (loading) return;
    // Login is removed for the demo — the auto-session is a citizen, so the
    // command dashboard just routes home. (Responder/admin access returns
    // when the dashboard track resumes.)
    if (!user || (user.role !== "responder" && user.role !== "admin")) {
      router.replace("/");
    }
  }, [loading, user, router]);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.incidents() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.riskMap() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.shelters() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.responders() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.rescueOps() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats() });
  }

  function handleVerify(id: number, status: "verified" | "rejected") {
    updateIncident.mutate({ id, update: { status } });
  }

  if (loading || !user || (user.role !== "responder" && user.role !== "admin")) {
    return <div className="px-4 py-8 text-sm text-slate-500">Loading command center…</div>;
  }

  const s = statsQuery.data;
  const dash = (v: number | undefined) => (v === undefined ? "—" : String(v));
  const stats = [
    { label: "Active incidents", value: dash(s?.active_incidents) },
    { label: "Critical incidents", value: dash(s?.critical_incidents) },
    { label: "People affected", value: dash(s?.people_affected) },
    { label: "Responders available", value: dash(s?.responders_available) },
    { label: "Rescues completed", value: dash(s?.rescues_completed) },
    { label: "Shelters available", value: dash(s?.shelters_available) },
  ];

  const dispatchedIncidentIds = new Set(
    rescueOps
      .filter((o) => o.status !== "completed" && o.status !== "cancelled")
      .map((o) => o.incident_id)
  );

  return (
    <div className="flex h-[calc(100vh-57px)] flex-col">
      <div className="grid grid-cols-2 gap-px bg-slate-800 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-slate-950 px-4 py-3">
            <div className="text-2xl font-bold text-white">{stat.value}</div>
            <div className="text-xs text-slate-500">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="relative flex-1">
          <RiskMap
            className="h-full w-full"
            riskMap={riskMap}
            incidents={incidents}
            shelters={shelters}
            responders={responders}
            rescueOps={rescueOps}
            onZoneClick={setSelectedZone}
          />

          <div className="absolute left-3 top-3 rounded bg-slate-950/90 px-3 py-2 text-xs ring-1 ring-slate-800">
            <div className="mb-1 font-semibold text-slate-300">Flood risk (click a zone)</div>
            <div className="flex flex-wrap gap-2">
              {RISK_LEGEND.map((l) => (
                <span key={l.category} className="flex items-center gap-1 text-slate-400">
                  <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: l.color }} />
                  {l.label}
                </span>
              ))}
            </div>
            <div className="mt-1 flex flex-wrap gap-2 border-t border-slate-800 pt-1 text-slate-400">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: "#22c55e" }} />
                Responder
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: "#0ea5e9" }} />
                Shelter
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-0.5 w-3" style={{ backgroundColor: "#f59e0b" }} />
                Route
              </span>
            </div>
            <div className="mt-1 text-[10px] text-slate-500">
              Baseline hazard/population/infra inputs are synthetic demo data.
            </div>
          </div>

          {selectedZone && (
            <div className="absolute bottom-3 left-3 w-64 rounded bg-slate-950/95 p-3 text-xs ring-1 ring-slate-800">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-semibold text-white">
                  Risk {selectedZone.risk_score} — {selectedZone.risk_category.replace("_", " ")}
                </span>
                <button onClick={() => setSelectedZone(null)} className="text-slate-500 hover:text-white">
                  ✕
                </button>
              </div>
              <dl className="space-y-0.5 text-slate-400">
                <div className="flex justify-between">
                  <dt>Hazard</dt>
                  <dd>{selectedZone.hazard_score}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Population exposure</dt>
                  <dd>{selectedZone.population_exposure}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Infrastructure vulnerability</dt>
                  <dd>{selectedZone.infrastructure_vulnerability}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Accessibility</dt>
                  <dd>{selectedZone.accessibility_score}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Historical risk</dt>
                  <dd>{selectedZone.historical_risk_score}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Nearby incidents</dt>
                  <dd>{selectedZone.nearby_incident_count}</dd>
                </div>
              </dl>
            </div>
          )}
        </div>

        <aside className="flex w-[28rem] shrink-0 flex-col overflow-y-auto border-l border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Incidents · by priority
            </h2>
            <div className="flex items-center gap-2">
              <span
                className={`flex items-center gap-1 text-[10px] font-semibold uppercase ${
                  connected ? "text-emerald-400" : "text-amber-400"
                }`}
                title={connected ? "Live updates connected" : "Reconnecting to live updates"}
              >
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                    connected ? "bg-emerald-400" : "bg-amber-400 animate-pulse"
                  }`}
                />
                {connected ? "Live" : "Reconnecting"}
              </span>
              <button onClick={refresh} className="text-xs text-slate-400 hover:text-white">
                Refresh
              </button>
            </div>
          </div>

          {(updateIncident.isError || dispatch.isError) && (
            <p className="px-4 pt-2 text-xs text-red-400">
              {dispatch.error instanceof Error
                ? dispatch.error.message
                : "Could not update incident status."}
            </p>
          )}

          {incidentsLoading ? (
            <p className="p-4 text-sm text-slate-500">Loading incidents…</p>
          ) : incidents.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">No incidents reported yet.</p>
          ) : (
            <ul className="divide-y divide-slate-800">
              {incidents.map((incident) => (
                <li key={incident.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">
                      #{incident.id} · {incident.type}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {incident.priority && (
                        <Badge tone={PRIORITY_TONE[incident.priority]}>P: {incident.priority}</Badge>
                      )}
                      <Badge tone={SEVERITY_TONE[incident.severity]}>{incident.severity}</Badge>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {incident.people_affected} affected · {incident.latitude.toFixed(4)},{" "}
                    {incident.longitude.toFixed(4)} · {new Date(incident.created_at).toLocaleTimeString()}
                  </p>
                  {incident.description && (
                    <p className="mt-1 text-sm text-slate-300">{incident.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">{incident.status}</Badge>
                    {incident.status === "reported" && (
                      <>
                        <button
                          onClick={() => handleVerify(incident.id, "verified")}
                          disabled={updateIncident.isPending}
                          className="rounded bg-emerald-800/60 px-2 py-1 text-xs font-semibold text-emerald-200 hover:bg-emerald-700/60 disabled:opacity-50"
                        >
                          Verify
                        </button>
                        <button
                          onClick={() => handleVerify(incident.id, "rejected")}
                          disabled={updateIncident.isPending}
                          className="rounded bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-700 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {incident.status === "verified" && !dispatchedIncidentIds.has(incident.id) && (
                      <button
                        onClick={() => dispatch.mutate(incident.id)}
                        disabled={dispatch.isPending}
                        className="rounded bg-amber-700/70 px-2 py-1 text-xs font-semibold text-amber-100 hover:bg-amber-600/70 disabled:opacity-50"
                      >
                        Dispatch
                      </button>
                    )}
                    {dispatchedIncidentIds.has(incident.id) && (
                      <span className="text-xs text-amber-400">responder en route</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <RescueOpsPanel />

          <AlertComposer />

          <ManualIncidentForm />

          {token && (
            <SimulatorPanel
              token={token}
              isAdmin={user.role === "admin"}
              onChanged={() => {
                void queryClient.invalidateQueries({ queryKey: queryKeys.incidents() });
                void queryClient.invalidateQueries({ queryKey: queryKeys.riskMap() });
                void queryClient.invalidateQueries({ queryKey: queryKeys.simulatorState() });
              }}
            />
          )}

          <div className="mt-auto border-t border-slate-800 px-4 py-4">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                AI Situation Summary
              </h2>
              <Badge tone="neutral">Later phase</Badge>
            </div>
            <p className="text-sm text-slate-500">
              AI-generated situation summaries will appear here, always labeled as requiring human
              verification before any operational action is taken.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
