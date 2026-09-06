"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { listIncidents, patchIncident } from "@/lib/incidents-api";
import { getRiskMap } from "@/lib/risk-api";
import { listShelters } from "@/lib/shelters-api";
import { RiskMap } from "@/components/map/RiskMap";
import { SimulatorPanel } from "@/components/simulator/SimulatorPanel";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import type { Incident, RiskMapResponse, RiskZoneProperties, SeverityLevel, Shelter } from "@/types";

const SEVERITY_TONE: Record<SeverityLevel, BadgeTone> = {
  low: "low",
  moderate: "moderate",
  high: "high",
  very_high: "critical",
  critical: "critical",
};

const OPEN_STATUSES = new Set(["reported", "ai_verified", "human_review", "verified", "in_progress"]);

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

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [riskMap, setRiskMap] = useState<RiskMapResponse | undefined>(undefined);
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [selectedZone, setSelectedZone] = useState<RiskZoneProperties | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    setDataLoading(true);
    try {
      const [incidentsData, riskMapData, sheltersData] = await Promise.all([
        listIncidents(token),
        getRiskMap(token),
        listShelters(token),
      ]);
      setIncidents(incidentsData);
      setRiskMap(riskMapData);
      setShelters(sheltersData);
    } catch {
      // Degrading to "no data" beats crashing the whole operator screen.
    } finally {
      setDataLoading(false);
    }
  }, [token]);

  // Server-side authorization is what actually protects the data (every
  // /incidents, /risk-map, /shelters call re-checks the role in FastAPI);
  // this redirect is just so a citizen doesn't land on an empty operator
  // screen.
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role !== "responder" && user.role !== "admin") {
      router.replace("/");
      return;
    }
    if (!token) return;

    let cancelled = false;
    Promise.all([listIncidents(token), getRiskMap(token), listShelters(token)])
      .then(([incidentsData, riskMapData, sheltersData]) => {
        if (cancelled) return;
        setIncidents(incidentsData);
        setRiskMap(riskMapData);
        setShelters(sheltersData);
      })
      .catch(() => {
        // Degrading to "no data" beats crashing the whole operator screen.
      })
      .finally(() => {
        if (!cancelled) setDataLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loading, user, token, router]);

  async function handleVerify(id: number, status: "verified" | "rejected") {
    if (!token) return;
    setActionError(null);
    try {
      const updated = await patchIncident(id, token, { status });
      setIncidents((prev) => prev.map((i) => (i.id === id ? updated : i)));
    } catch {
      setActionError("Could not update incident status.");
    }
  }

  if (loading || !user || (user.role !== "responder" && user.role !== "admin")) {
    return <div className="px-4 py-8 text-sm text-slate-500">Loading command center…</div>;
  }

  const activeCount = incidents.filter((i) => OPEN_STATUSES.has(i.status)).length;
  const criticalCount = incidents.filter(
    (i) => OPEN_STATUSES.has(i.status) && i.severity === "critical"
  ).length;
  const peopleAffected = incidents
    .filter((i) => OPEN_STATUSES.has(i.status))
    .reduce((sum, i) => sum + i.people_affected, 0);
  const sheltersAvailable = shelters.filter((s) => s.status === "open").length;

  const stats = [
    { label: "Active incidents", value: String(activeCount) },
    { label: "Critical incidents", value: String(criticalCount) },
    { label: "People affected", value: String(peopleAffected) },
    { label: "Responders available", value: "—" },
    { label: "Rescues completed", value: "—" },
    { label: "Shelters available", value: dataLoading ? "—" : String(sheltersAvailable) },
  ];

  return (
    <div className="flex h-[calc(100vh-57px)] flex-col">
      <div className="grid grid-cols-2 gap-px bg-slate-800 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label} className="bg-slate-950 px-4 py-3">
            <div className="text-2xl font-bold text-white">{s.value}</div>
            <div className="text-xs text-slate-500">{s.label}</div>
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
              Incidents
            </h2>
            <div className="flex items-center gap-2">
              <Badge tone="neutral">Priority sort — later phase</Badge>
              <button
                onClick={() => void refresh()}
                className="text-xs text-slate-400 hover:text-white"
              >
                Refresh
              </button>
            </div>
          </div>

          {actionError && <p className="px-4 pt-2 text-xs text-red-400">{actionError}</p>}

          {dataLoading ? (
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
                    <Badge tone={SEVERITY_TONE[incident.severity]}>{incident.severity}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {incident.people_affected} affected · {incident.latitude.toFixed(4)},{" "}
                    {incident.longitude.toFixed(4)} · {new Date(incident.created_at).toLocaleTimeString()}
                  </p>
                  {incident.description && (
                    <p className="mt-1 text-sm text-slate-300">{incident.description}</p>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <Badge tone="neutral">{incident.status}</Badge>
                    {incident.status === "reported" && (
                      <>
                        <button
                          onClick={() => handleVerify(incident.id, "verified")}
                          className="rounded bg-emerald-800/60 px-2 py-1 text-xs font-semibold text-emerald-200 hover:bg-emerald-700/60"
                        >
                          Verify
                        </button>
                        <button
                          onClick={() => handleVerify(incident.id, "rejected")}
                          className="rounded bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {token && (
            <SimulatorPanel token={token} isAdmin={user.role === "admin"} onChanged={() => void refresh()} />
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
