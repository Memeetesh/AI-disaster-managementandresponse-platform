"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { useRealtimeStatus } from "@/lib/realtime";
import { useToast } from "@/lib/toast-context";
import { Icon } from "@/components/citizen/Icon";
import { LineChart } from "@/components/citizen/Charts";
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
import type { Incident, PriorityLevel, ResponderStatus, RiskZoneProperties } from "@/types";

type DisplayStatus = "pending" | "dispatched" | "resolved";

const PRIORITY_CONFIG: Record<
  PriorityLevel,
  { label: string; badge: string; dot: string; pulse: boolean }
> = {
  critical: { label: "Critical", badge: "bg-danger-100 text-danger-700", dot: "bg-danger-500", pulse: true },
  high: { label: "Urgent", badge: "bg-warn-100 text-warn-700", dot: "bg-warn-500", pulse: false },
  medium: { label: "Moderate", badge: "bg-navy-100 text-navy-700", dot: "bg-navy-500", pulse: false },
  low: { label: "Low", badge: "bg-slate2-100 text-slate2-600", dot: "bg-slate2-400", pulse: false },
};

const STATUS_CONFIG: Record<DisplayStatus, { label: string; badge: string }> = {
  pending: { label: "Pending", badge: "bg-danger-50 text-danger-600 border border-danger-200" },
  dispatched: { label: "Dispatched", badge: "bg-navy-50 text-navy-600 border border-navy-200" },
  resolved: { label: "Resolved", badge: "bg-safe-50 text-safe-600 border border-safe-200" },
};

const TEAM_STATUS_CONFIG: Record<ResponderStatus, { label: string; badge: string; dot: string }> = {
  available: { label: "Available", badge: "bg-safe-100 text-safe-700", dot: "bg-safe-500" },
  en_route: { label: "En Route", badge: "bg-warn-100 text-warn-700", dot: "bg-warn-500" },
  busy: { label: "Busy", badge: "bg-danger-100 text-danger-700", dot: "bg-danger-500" },
  offline: { label: "Offline", badge: "bg-slate2-100 text-slate2-500", dot: "bg-slate2-400" },
};

function displayStatus(incident: Incident, dispatchedIds: Set<number>): DisplayStatus {
  if (incident.status === "resolved") return "resolved";
  if (incident.status === "in_progress" || dispatchedIds.has(incident.id)) return "dispatched";
  return "pending";
}

export default function DashboardPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { connected } = useRealtimeStatus();
  const { addToast } = useToast();

  const [selectedZone, setSelectedZone] = useState<RiskZoneProperties | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | DisplayStatus>("all");
  const [mapLayer, setMapLayer] = useState<"all" | "sos" | "shelters">("all");
  const [mapFocus, setMapFocus] = useState<[number, number] | null>(null);
  const seenIncidentIds = useRef<Set<number>>(new Set());

  const incidentsQuery = useIncidents({ sort: "priority" });
  const riskMapQuery = useRiskMap();
  const sheltersQuery = useShelters();
  const respondersQuery = useResponders();
  const rescueOpsQuery = useRescueOps();
  const statsQuery = useDashboardStats();
  const updateIncident = useUpdateIncident();
  const dispatch = useDispatch();

  const allIncidents = useMemo(() => incidentsQuery.data ?? [], [incidentsQuery.data]);
  const incidents = useMemo(() => allIncidents.filter((i) => i.status !== "rejected"), [allIncidents]);
  const riskMap = riskMapQuery.data;
  const shelters = sheltersQuery.data ?? [];
  const responders = respondersQuery.data ?? [];
  const rescueOps = useMemo(() => rescueOpsQuery.data ?? [], [rescueOpsQuery.data]);
  const incidentsLoading = incidentsQuery.isLoading;

  useEffect(() => {
    if (loading) return;
    // Login is removed for the demo — the auto-session is a citizen, so the
    // command dashboard just routes home unless it's a responder/admin.
    if (!user || (user.role !== "responder" && user.role !== "admin")) {
      router.replace("/");
    }
  }, [loading, user, router]);

  // Pan the map to a genuinely new incident (e.g. an SOS from the app).
  useEffect(() => {
    if (incidents.length === 0) return;
    const known = seenIncidentIds.current;
    const firstLoad = known.size === 0;
    const fresh = incidents.filter((i) => !known.has(i.id));
    incidents.forEach((i) => known.add(i.id));
    if (firstLoad) {
      setSelectedId((prev) => prev ?? incidents[0]?.id ?? null);
      return;
    }
    if (fresh.length === 0) return;
    const newest = fresh.reduce((a, b) => (b.id > a.id ? b : a));
    setMapFocus([newest.longitude, newest.latitude]);
    addToast(`New signal: #${newest.id} · ${newest.type}`, "warning");
  }, [incidents, addToast]);

  const dispatchedIncidentIds = useMemo(
    () =>
      new Set(
        rescueOps
          .filter((o) => o.status !== "completed" && o.status !== "cancelled")
          .map((o) => o.incident_id)
      ),
    [rescueOps]
  );

  const filteredIncidents = useMemo(() => {
    if (filter === "all") return incidents;
    return incidents.filter((i) => displayStatus(i, dispatchedIncidentIds) === filter);
  }, [incidents, filter, dispatchedIncidentIds]);

  const pendingCount = incidents.filter((i) => displayStatus(i, dispatchedIncidentIds) === "pending").length;
  const dispatchedCount = incidents.filter(
    (i) => displayStatus(i, dispatchedIncidentIds) === "dispatched"
  ).length;
  const resolvedCount = incidents.filter((i) => displayStatus(i, dispatchedIncidentIds) === "resolved").length;

  const selectedIncident = incidents.find((i) => i.id === selectedId) ?? null;
  const selectedOp = selectedIncident
    ? rescueOps.find(
        (o) =>
          o.incident_id === selectedIncident.id && o.status !== "completed" && o.status !== "cancelled"
      )
    : undefined;

  // Real, if sparse: hourly signal counts for the last 12h, from actual
  // incidents. Reads the wall clock, which is deliberate here (a "signals
  // per hour so far" readout is expected to drift as time passes).
  const trend = useMemo(() => {
    const buckets = new Array(12).fill(0);
    // eslint-disable-next-line react-hooks/purity -- see comment above
    const now = Date.now();
    for (const i of incidents) {
      const hoursAgo = Math.floor((now - new Date(i.created_at).getTime()) / 3_600_000);
      if (hoursAgo >= 0 && hoursAgo < 12) buckets[11 - hoursAgo] += 1;
    }
    return buckets;
  }, [incidents]);
  const lastHour = trend[trend.length - 1] ?? 0;
  const prevHour = trend[trend.length - 2] ?? 0;
  const trendDelta = prevHour === 0 ? null : Math.round(((lastHour - prevHour) / prevHour) * 100);

  function selectIncident(incident: Incident) {
    setSelectedId(incident.id);
    setMapFocus([incident.longitude, incident.latitude]);
  }

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.incidents() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.riskMap() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.shelters() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.responders() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.rescueOps() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats() });
    addToast("Refreshed.", "info");
  }

  function handleVerify(id: number, status: "verified" | "rejected") {
    updateIncident.mutate(
      { id, update: { status } },
      {
        onSuccess: () => addToast(`Signal #${id} ${status}.`, status === "verified" ? "success" : "info"),
        onError: () => addToast("Could not update the signal.", "error"),
      }
    );
  }

  function handleDispatch(id: number) {
    dispatch.mutate(id, {
      onSuccess: () => addToast(`Nearest responder dispatched to #${id}.`, "success"),
      onError: (err) =>
        addToast(err instanceof Error ? err.message : "Could not dispatch a responder.", "error"),
    });
  }

  function handleResolve(id: number) {
    updateIncident.mutate(
      { id, update: { status: "resolved" } },
      {
        onSuccess: () => addToast(`Signal #${id} marked resolved.`, "success"),
        onError: () => addToast("Could not resolve the signal.", "error"),
      }
    );
  }

  function handleReopen(id: number) {
    updateIncident.mutate(
      { id, update: { status: "verified" } },
      { onSuccess: () => addToast(`Signal #${id} reopened.`, "info") }
    );
  }

  if (loading || !user || (user.role !== "responder" && user.role !== "admin")) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate2-500 bg-slate2-50">
        Loading command center…
      </div>
    );
  }

  const s = statsQuery.data;
  const activeDeployed = responders.filter((r) => r.status === "en_route" || r.status === "busy").length;
  const statCards = [
    {
      id: "active",
      label: "Active SOS Signals",
      value: s ? String(s.active_incidents) : "—",
      icon: "Siren",
      color: "text-danger-600 bg-danger-50",
    },
    {
      id: "deployed",
      label: "Teams Deployed",
      value: String(activeDeployed),
      icon: "LifeBuoy",
      color: "text-navy-600 bg-navy-50",
    },
    {
      id: "resolved",
      label: "Rescues Completed",
      value: s ? String(s.rescues_completed) : "—",
      icon: "CheckCircle2",
      color: "text-safe-600 bg-safe-50",
    },
    {
      id: "shelters",
      label: "Shelters Open",
      value: s ? String(s.shelters_available) : "—",
      icon: "Home",
      color: "text-warn-600 bg-warn-50",
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-5 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-800 via-navy-900 to-navy-950 p-5 md:p-6">
        <div className="absolute top-0 right-0 w-72 h-72 bg-navy-600/20 rounded-full blur-3xl -translate-y-1/3 translate-x-1/4" />
        <div className="absolute bottom-0 left-1/3 w-48 h-48 bg-danger-500/10 rounded-full blur-3xl translate-y-1/2" />
        <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                <Icon name="ShieldAlert" className="w-5 h-5 text-danger-400" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-navy-300">Command Center</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Authority Dashboard</h1>
            <p className="text-sm text-navy-300 mt-1.5">
              Real-time SOS monitoring and emergency response coordination
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 backdrop-blur-sm">
              <span
                className={`w-2 h-2 rounded-full ${connected ? "bg-safe-400 animate-pulse" : "bg-warn-400 animate-pulse"}`}
              />
              <span className="text-white font-medium">{connected ? "Live" : "Reconnecting…"}</span>
            </div>
            <button
              onClick={refresh}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 backdrop-blur-sm text-white font-medium hover:bg-white/20 transition-colors"
            >
              <Icon name="RefreshCw" className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {(updateIncident.isError || dispatch.isError) && (
        <p className="text-sm text-danger-600 px-1">
          {dispatch.error instanceof Error ? dispatch.error.message : "Could not update the signal."}
        </p>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, idx) => (
          <div key={stat.id} className={`card card-hover card-glow p-4 stagger-${Math.min(idx + 1, 4)}`}>
            <div className="flex items-start justify-between mb-3">
              <div className={`w-11 h-11 rounded-2xl ${stat.color} flex items-center justify-center`}>
                <Icon name={stat.icon} className="w-5.5 h-5.5" />
              </div>
            </div>
            <p className="text-2xl font-bold gradient-text">{stat.value}</p>
            <p className="text-xs text-slate2-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Main Grid: Map + SOS Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate2-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-navy-100 flex items-center justify-center">
                <Icon name="MapPinned" className="w-4 h-4 text-navy-600" />
              </div>
              <h2 className="text-sm font-bold text-navy-900">Live SOS Map</h2>
              <span className="badge bg-danger-100 text-danger-700 ml-1">
                <span className="w-1.5 h-1.5 rounded-full bg-danger-500 animate-pulse" />
                {pendingCount} pending
              </span>
            </div>
            <div className="flex items-center gap-1 p-0.5 bg-slate2-100 rounded-lg">
              {(
                [
                  { id: "all", label: "All", icon: "Layers" },
                  { id: "sos", label: "SOS", icon: "Siren" },
                  { id: "shelters", label: "Shelters", icon: "Home" },
                ] as const
              ).map((layer) => (
                <button
                  key={layer.id}
                  onClick={() => setMapLayer(layer.id)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    mapLayer === layer.id ? "bg-white text-navy-700 shadow-sm" : "text-slate2-500 hover:text-navy-600"
                  }`}
                >
                  <Icon name={layer.icon} className="w-3.5 h-3.5" />
                  {layer.label}
                </button>
              ))}
            </div>
          </div>

          <div className="relative h-[420px] md:h-[480px] overflow-hidden">
            <RiskMap
              className="h-full w-full"
              riskMap={riskMap}
              incidents={mapLayer !== "shelters" ? incidents : []}
              shelters={mapLayer !== "sos" ? shelters : []}
              responders={responders}
              rescueOps={rescueOps}
              onZoneClick={setSelectedZone}
              onIncidentClick={(id) => {
                const incident = incidents.find((i) => i.id === id);
                if (incident) selectIncident(incident);
              }}
              focus={mapFocus}
            />

            <div className="absolute bottom-3 left-3 glass rounded-xl px-3 py-2.5 border border-slate2-100 space-y-1.5 z-[5] pointer-events-none">
              <div className="flex items-center gap-2 text-[11px] font-medium text-navy-700">
                <span className="w-2.5 h-2.5 rounded-full bg-danger-600" /> Critical SOS
              </div>
              <div className="flex items-center gap-2 text-[11px] font-medium text-navy-700">
                <span className="w-2.5 h-2.5 rounded-full bg-warn-500" /> Other SOS
              </div>
              <div className="flex items-center gap-2 text-[11px] font-medium text-navy-700">
                <span className="w-2.5 h-2.5 rounded-full bg-navy-500" /> Responder
              </div>
              <div className="flex items-center gap-2 text-[11px] font-medium text-navy-700">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#0ea5e9" }} /> Shelter
              </div>
            </div>

            {selectedZone && (
              <div className="absolute top-3 right-3 w-64 rounded-xl bg-white/95 backdrop-blur-sm shadow-[var(--shadow-card-lg)] border border-slate2-100 p-3.5 text-xs z-[5]">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="font-bold text-navy-900">
                    Risk {selectedZone.risk_score} — {selectedZone.risk_category.replace("_", " ")}
                  </span>
                  <button onClick={() => setSelectedZone(null)} className="text-slate2-400 hover:text-navy-700">
                    <Icon name="X" className="w-3.5 h-3.5" />
                  </button>
                </div>
                <dl className="space-y-0.5 text-slate2-500">
                  <div className="flex justify-between">
                    <dt>Hazard</dt>
                    <dd>{selectedZone.hazard_score}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Population exposure</dt>
                    <dd>{selectedZone.population_exposure}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Nearby incidents</dt>
                    <dd>{selectedZone.nearby_incident_count}</dd>
                  </div>
                </dl>
              </div>
            )}
          </div>
        </div>

        {/* SOS Feed */}
        <div className="card p-0 overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 border-b border-slate2-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-danger-100 flex items-center justify-center">
                  <Icon name="Siren" className="w-4 h-4 text-danger-600" />
                </div>
                <h2 className="text-sm font-bold text-navy-900">SOS Signal Feed</h2>
              </div>
              <span className="text-xs text-slate2-400">{filteredIncidents.length} signals</span>
            </div>
            <div className="flex gap-1">
              {(
                [
                  { id: "all", label: "All", count: incidents.length },
                  { id: "pending", label: "Pending", count: pendingCount },
                  { id: "dispatched", label: "Active", count: dispatchedCount },
                  { id: "resolved", label: "Resolved", count: resolvedCount },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`flex-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                    filter === f.id ? "bg-navy-700 text-white" : "bg-slate2-100 text-slate2-500 hover:bg-slate2-200"
                  }`}
                >
                  {f.label} <span className="opacity-60">({f.count})</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[440px] md:max-h-[500px]">
            {incidentsLoading ? (
              <p className="px-4 py-8 text-center text-sm text-slate2-500">Loading signals…</p>
            ) : (
              filteredIncidents.map((incident) => {
                const priority = incident.priority ?? "medium";
                const pc = PRIORITY_CONFIG[priority];
                const status = displayStatus(incident, dispatchedIncidentIds);
                const sc = STATUS_CONFIG[status];
                const isSelected = selectedId === incident.id;
                return (
                  <button
                    key={incident.id}
                    onClick={() => selectIncident(incident)}
                    className={`w-full text-left px-4 py-3.5 border-b border-slate2-50 transition-colors ${
                      isSelected ? "bg-navy-50/60" : "hover:bg-slate2-50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative mt-1">
                        <span className={`block w-2.5 h-2.5 rounded-full ${pc.dot}`} />
                        {pc.pulse && status === "pending" && (
                          <span className={`absolute inset-0 rounded-full ${pc.dot} animate-ping opacity-60`} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-sm font-bold text-navy-900 truncate">
                            {incident.reporter_name ?? `Signal #${incident.id}`}
                          </p>
                          <span className="text-[10px] text-slate2-400 flex-shrink-0">
                            {new Date(incident.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-slate2-500 truncate mb-1.5">
                          {incident.latitude.toFixed(4)}, {incident.longitude.toFixed(4)}
                        </p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`badge ${pc.badge} text-[10px] py-0.5`}>{pc.label}</span>
                          <span className={`badge ${sc.badge} text-[10px] py-0.5`}>{sc.label}</span>
                          <span className="text-[10px] text-slate2-400 capitalize">{incident.type}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
            {!incidentsLoading && filteredIncidents.length === 0 && (
              <div className="px-4 py-12 text-center">
                <div className="w-14 h-14 rounded-2xl bg-slate2-50 flex items-center justify-center mx-auto mb-3">
                  <Icon name="CheckCircle2" className="w-7 h-7 text-slate2-300" />
                </div>
                <p className="text-sm font-semibold text-navy-700">No signals in this filter</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail + Teams */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {selectedIncident && (
          <div className="lg:col-span-2 card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-navy-100 flex items-center justify-center">
                  <Icon name="FileText" className="w-5.5 h-5.5 text-navy-600" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-navy-900">Signal Details — #{selectedIncident.id}</h2>
                  <p className="text-xs text-slate2-500">
                    Received {new Date(selectedIncident.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
              {(() => {
                const status = displayStatus(selectedIncident, dispatchedIncidentIds);
                return <span className={`badge ${STATUS_CONFIG[status].badge}`}>{STATUS_CONFIG[status].label}</span>;
              })()}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate2-50">
                <Icon name="UserPlus" className="w-4 h-4 text-slate2-400 flex-shrink-0" />
                <div>
                  <p className="text-[11px] text-slate2-400">Reported by</p>
                  <p className="text-sm font-semibold text-navy-800">
                    {selectedIncident.reporter_name ?? "Unknown"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate2-50">
                <Icon name="Phone" className="w-4 h-4 text-slate2-400 flex-shrink-0" />
                <div>
                  <p className="text-[11px] text-slate2-400">Contact</p>
                  <p className="text-sm font-semibold text-navy-800">
                    {selectedIncident.reporter_phone ?? "Not available"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate2-50">
                <Icon name="MapPin" className="w-4 h-4 text-slate2-400 flex-shrink-0" />
                <div>
                  <p className="text-[11px] text-slate2-400">Location</p>
                  <p className="text-sm font-semibold text-navy-800">
                    {selectedIncident.latitude.toFixed(5)}, {selectedIncident.longitude.toFixed(5)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate2-50">
                <Icon name="Users" className="w-4 h-4 text-slate2-400 flex-shrink-0" />
                <div>
                  <p className="text-[11px] text-slate2-400">People Affected</p>
                  <p className="text-sm font-semibold text-navy-800">{selectedIncident.people_affected}</p>
                </div>
              </div>
            </div>

            {selectedIncident.description && (
              <div className="px-3.5 py-3 rounded-xl bg-navy-50 border border-navy-100 mb-4">
                <p className="text-xs font-semibold text-navy-600 mb-1">Description</p>
                <p className="text-sm text-navy-800">{selectedIncident.description}</p>
              </div>
            )}

            {selectedOp && (
              <div className="px-3.5 py-3 rounded-xl bg-warn-50 border border-warn-100 mb-4 text-xs text-warn-700">
                <span className="font-semibold">{selectedOp.responder_name ?? "A responder"}</span> is{" "}
                {selectedOp.status.replace("_", " ")}
                {selectedOp.eta_minutes != null ? ` · ETA ${selectedOp.eta_minutes} min` : ""} — advance or
                cancel this from Rescue Ops below.
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {["reported", "ai_verified", "human_review"].includes(selectedIncident.status) && (
                <>
                  <button
                    onClick={() => handleVerify(selectedIncident.id, "verified")}
                    disabled={updateIncident.isPending}
                    className="btn bg-navy-700 text-white hover:bg-navy-800 disabled:opacity-60"
                  >
                    <Icon name="CheckCircle2" className="w-4 h-4" />
                    Verify Signal
                  </button>
                  <button
                    onClick={() => handleVerify(selectedIncident.id, "rejected")}
                    disabled={updateIncident.isPending}
                    className="btn-secondary disabled:opacity-60"
                  >
                    <Icon name="X" className="w-4 h-4" />
                    Reject
                  </button>
                </>
              )}
              {selectedIncident.status === "verified" && !dispatchedIncidentIds.has(selectedIncident.id) && (
                <button
                  onClick={() => handleDispatch(selectedIncident.id)}
                  disabled={dispatch.isPending}
                  className="btn bg-navy-700 text-white hover:bg-navy-800 disabled:opacity-60"
                >
                  <Icon name="LifeBuoy" className="w-4 h-4" />
                  {dispatch.isPending ? "Dispatching…" : "Dispatch Nearest Team"}
                </button>
              )}
              {selectedIncident.reporter_phone && (
                <a href={`tel:${selectedIncident.reporter_phone}`} className="btn-secondary">
                  <Icon name="Phone" className="w-4 h-4" />
                  Call Caller
                </a>
              )}
              {selectedIncident.status !== "resolved" && (
                <button
                  onClick={() => handleResolve(selectedIncident.id)}
                  disabled={updateIncident.isPending}
                  className="btn bg-safe-600 text-white hover:bg-safe-700 disabled:opacity-60"
                >
                  <Icon name="CheckCircle2" className="w-4 h-4" />
                  Mark Resolved
                </button>
              )}
              {selectedIncident.status === "resolved" && (
                <button onClick={() => handleReopen(selectedIncident.id)} className="btn-secondary">
                  <Icon name="RotateCcw" className="w-4 h-4" />
                  Reopen Signal
                </button>
              )}
            </div>
          </div>
        )}

        {/* Rescue Teams */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-navy-100 flex items-center justify-center">
              <Icon name="LifeBuoy" className="w-4 h-4 text-navy-600" />
            </div>
            <h2 className="text-sm font-bold text-navy-900">Rescue Teams</h2>
          </div>
          <div className="space-y-2.5 max-h-[340px] overflow-y-auto">
            {responders.length === 0 ? (
              <p className="text-sm text-slate2-500">No responders on record.</p>
            ) : (
              responders.map((team) => {
                const tc = TEAM_STATUS_CONFIG[team.status];
                return (
                  <div
                    key={team.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate2-50 hover:bg-slate2-100 transition-colors"
                  >
                    <div className="relative">
                      <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-sm">
                        <Icon name="Shield" className="w-4 h-4 text-navy-600" />
                      </div>
                      <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ${tc.dot} ring-2 ring-slate2-50`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-navy-900 truncate">{team.name}</p>
                      <p className="text-[11px] text-slate2-500">
                        {team.team ?? team.vehicle ?? "team"} · capacity {team.capacity}
                      </p>
                    </div>
                    <span className={`badge ${tc.badge} text-[10px] py-0.5`}>{tc.label}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Shelters + Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-safe-100 flex items-center justify-center">
                <Icon name="Home" className="w-4 h-4 text-safe-600" />
              </div>
              <h2 className="text-sm font-bold text-navy-900">Shelter Occupancy</h2>
            </div>
          </div>
          {shelters.length === 0 ? (
            <p className="text-sm text-slate2-500">No shelters on record.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {shelters.map((sh) => {
                const pct = sh.capacity > 0 ? Math.round((sh.occupied / sh.capacity) * 100) : 0;
                const barColor = pct > 85 ? "bg-danger-500" : pct > 60 ? "bg-warn-500" : "bg-safe-500";
                return (
                  <div key={sh.id} className="px-4 py-3.5 rounded-xl border border-slate2-100 hover:border-slate2-200 transition-colors">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-sm font-bold text-navy-900 truncate">{sh.name}</p>
                      <span className="text-xs font-bold text-slate2-600 flex-shrink-0">{pct}%</span>
                    </div>
                    <p className="text-[11px] text-slate2-400 mb-2.5">
                      {sh.occupied}/{sh.capacity} people · {sh.status}
                    </p>
                    <div className="h-2 rounded-full bg-slate2-100 overflow-hidden">
                      <div className={`h-full rounded-full ${barColor} transition-all duration-500`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-danger-100 flex items-center justify-center">
              <Icon name="Activity" className="w-4 h-4 text-danger-600" />
            </div>
            <h2 className="text-sm font-bold text-navy-900">SOS Trend (12h)</h2>
          </div>
          <div className="mb-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold gradient-text">{lastHour}</span>
              <span className="text-xs text-slate2-500">signals in last hour</span>
            </div>
            {trendDelta !== null && (
              <p
                className={`text-xs font-medium mt-0.5 flex items-center gap-1 ${
                  trendDelta >= 0 ? "text-danger-600" : "text-safe-600"
                }`}
              >
                <Icon name={trendDelta >= 0 ? "TrendingUp" : "TrendingDown"} className="w-3 h-3" />
                {Math.abs(trendDelta)}% {trendDelta >= 0 ? "increase" : "decrease"} from previous hour
              </p>
            )}
          </div>
          <LineChart data={trend} color="#dc2626" height={100} showArea />
        </div>
      </div>

      {/* Operator Tools */}
      <div className="rounded-2xl bg-navy-950 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-2">
          <Icon name="Settings" className="w-4 h-4 text-slate-400" />
          <h2 className="text-sm font-bold text-white">Operator Tools</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
          <div>
            <RescueOpsPanel />
            <AlertComposer />
          </div>
          <div>
            <ManualIncidentForm />
            {token && (
              <SimulatorPanel
                token={token}
                isAdmin={user.role === "admin"}
                onChanged={() => {
                  void queryClient.invalidateQueries({ queryKey: queryKeys.incidents() });
                  void queryClient.invalidateQueries({ queryKey: queryKeys.riskMap() });
                  void queryClient.invalidateQueries({ queryKey: queryKeys.rescueOps() });
                  void queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats() });
                  void queryClient.invalidateQueries({ queryKey: queryKeys.simulatorState() });
                }}
              />
            )}
            <div className="border-t border-slate-800 px-4 py-4">
              <div className="mb-1 flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                  AI Situation Summary
                </h3>
                <span className="badge bg-slate-700/50 text-slate-200">Later phase</span>
              </div>
              <p className="text-sm text-slate-500">
                AI-generated situation summaries will appear here, always labeled as requiring human
                verification before any operational action is taken.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
