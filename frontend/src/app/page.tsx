"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useLocation } from "@/hooks/useLocation";
import { getRiskMap } from "@/lib/risk-api";
import { listShelters } from "@/lib/shelters-api";
import { haversineDistanceKm, pointInPolygon } from "@/lib/geo";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import type { RiskMapResponse, RiskZoneProperties, Shelter } from "@/types";

const EMERGENCY_CONTACTS = [
  { label: "National Emergency", number: "112" },
  { label: "Disaster Management Helpline", number: "1078" },
  { label: "Ambulance", number: "108" },
  { label: "Fire", number: "101" },
];

const RISK_TONE: Record<string, BadgeTone> = {
  low: "low",
  moderate: "moderate",
  high: "high",
  very_high: "critical",
  critical: "critical",
};

function findZoneForLocation(riskMap: RiskMapResponse, lat: number, lon: number): RiskZoneProperties | null {
  for (const feature of riskMap.features) {
    if (pointInPolygon(lat, lon, feature.geometry.coordinates[0])) return feature.properties;
  }
  return null;
}

function Card({ title, badge, children }: { title: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{title}</h2>
        {badge}
      </div>
      {children}
    </section>
  );
}

export default function HomePage() {
  const { token } = useAuth();
  const location = useLocation();

  const [riskMap, setRiskMap] = useState<RiskMapResponse | null>(null);
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [dataError, setDataError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    Promise.all([getRiskMap(token), listShelters(token)])
      .then(([riskMapData, sheltersData]) => {
        if (cancelled) return;
        setRiskMap(riskMapData);
        setShelters(sheltersData);
      })
      .catch(() => {
        if (!cancelled) setDataError("Could not load risk/shelter data.");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const currentZone =
    riskMap && location.status === "ok" ? findZoneForLocation(riskMap, location.lat, location.lon) : null;

  const nearestShelters =
    location.status === "ok"
      ? [...shelters]
          .map((s) => ({ ...s, distanceKm: haversineDistanceKm(location.lat, location.lon, s.latitude, s.longitude) }))
          .sort((a, b) => a.distanceKm - b.distanceKm)
          .slice(0, 3)
      : [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Disaster Intelligence, Response &amp; Situational Awareness</h1>
        <p className="mt-1 text-slate-400">
          Demo hazard: urban flooding. This home screen reflects your current safety context.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/sos"
          className="rounded bg-red-700 px-5 py-3 font-semibold text-white hover:bg-red-600"
        >
          Send SOS
        </Link>
        <Link
          href="/report"
          className="rounded border border-slate-700 px-5 py-3 font-semibold text-slate-100 hover:border-slate-500"
        >
          Report an Incident
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Current Risk">
          {!token ? (
            <p className="text-sm text-slate-400">
              <Link href="/login" className="text-red-400 hover:underline">
                Sign in
              </Link>{" "}
              to see the flood-risk level for your area.
            </p>
          ) : location.status !== "ok" ? (
            <p className="text-sm text-slate-400">Waiting for your location…</p>
          ) : !riskMap ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : currentZone ? (
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-white">{currentZone.risk_score}</span>
                <Badge tone={RISK_TONE[currentZone.risk_category]}>
                  {currentZone.risk_category.replace("_", " ")}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Hazard {currentZone.hazard_score} · Population exposure {currentZone.population_exposure} ·
                Infra vulnerability {currentZone.infrastructure_vulnerability} · Accessibility{" "}
                {currentZone.accessibility_score}
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-400">You&apos;re outside the current demo coverage area (central Chennai).</p>
          )}
        </Card>

        <Card title="Active Alerts" badge={<Badge tone="neutral">Later phase</Badge>}>
          <p className="text-sm text-slate-400">
            Official IMD/SACHET alerts (or simulated ones during a demo) will appear here once the
            alerts API is implemented.
          </p>
        </Card>

        <Card title="Your Location">
          {location.status === "loading" && <p className="text-sm text-slate-400">Locating…</p>}
          {location.status === "ok" && (
            <p className="font-mono text-sm text-slate-200">
              {location.lat.toFixed(5)}, {location.lon.toFixed(5)}
            </p>
          )}
          {location.status === "error" && (
            <p className="text-sm text-amber-400">{location.error}</p>
          )}
          <p className="mt-2 text-xs text-slate-500">
            Used to find your nearest shelter and to attach to any SOS/report you submit.
          </p>
        </Card>

        <Card title="Nearby Shelters">
          {!token ? (
            <p className="text-sm text-slate-400">
              <Link href="/login" className="text-red-400 hover:underline">
                Sign in
              </Link>{" "}
              to see shelters near you.
            </p>
          ) : location.status !== "ok" ? (
            <p className="text-sm text-slate-400">Waiting for your location…</p>
          ) : nearestShelters.length === 0 ? (
            <p className="text-sm text-slate-400">No shelters found nearby.</p>
          ) : (
            <ul className="space-y-2">
              {nearestShelters.map((s) => (
                <li key={s.id} className="rounded border border-slate-800 bg-slate-950 px-3 py-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-100">{s.name}</span>
                    <span className="font-mono text-slate-400">{s.distanceKm.toFixed(1)} km</span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {s.occupied}/{s.capacity} occupied · {s.accessibility ?? "accessibility unknown"} ·{" "}
                    {s.status}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {dataError && <p className="text-sm text-red-400">{dataError}</p>}

      <Card title="Emergency Contacts">
        <ul className="grid gap-2 sm:grid-cols-2">
          {EMERGENCY_CONTACTS.map((c) => (
            <li
              key={c.number}
              className="flex items-center justify-between rounded border border-slate-800 bg-slate-950 px-3 py-2"
            >
              <span className="text-sm text-slate-300">{c.label}</span>
              <a href={`tel:${c.number}`} className="font-mono text-sm font-semibold text-red-400">
                {c.number}
              </a>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
