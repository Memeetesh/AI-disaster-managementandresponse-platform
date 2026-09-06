"use client";

import { useEffect, useState } from "react";
import { Icon, getRiskColor, getRiskLabel, getRiskDot } from "@/components/citizen/Icon";
import { LineChart } from "@/components/citizen/Charts";
import { riskCards as mockRiskCards, riverLevelData, riverCourseData } from "@/data/citizen-mock";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { useLocation } from "@/hooks/useLocation";
import { getRiskMap } from "@/lib/risk-api";
import { listShelters } from "@/lib/shelters-api";
import { haversineDistanceKm, pointInPolygon } from "@/lib/geo";
import type { RiskMapResponse, RiskZoneProperties, Shelter } from "@/types";
import type { RiskCard, CitizenRiskLevel } from "@/types/citizen-ui";

const riskChartColors: Record<string, string> = {
  low: "#22c55e",
  moderate: "#f59e0b",
  high: "#ef4444",
  critical: "#dc2626",
};

function findZoneForLocation(riskMap: RiskMapResponse, lat: number, lon: number): RiskZoneProperties | null {
  for (const feature of riskMap.features) {
    if (pointInPolygon(lat, lon, feature.geometry.coordinates[0])) return feature.properties;
  }
  return null;
}

// The risk engine's 5-band scale (low/moderate/high/very_high/critical)
// collapses onto the citizen UI's 4-band scale (very_high -> critical) —
// the dashboard keeps the full 5-band detail, this view doesn't need it.
function toCitizenLevel(category: string): CitizenRiskLevel {
  if (category === "very_high" || category === "critical") return "critical";
  if (category === "low" || category === "moderate" || category === "high") return category;
  return "moderate";
}

export default function HomePage() {
  const { user, token } = useAuth();
  const { addToast } = useToast();
  const location = useLocation();

  const [riskMap, setRiskMap] = useState<RiskMapResponse | null>(null);
  const [shelters, setShelters] = useState<Shelter[]>([]);

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
        // Home page degrades to the demo risk cards below — no hard failure.
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const currentZone =
    riskMap && location.status === "ok" ? findZoneForLocation(riskMap, location.lat, location.lon) : null;

  // Only the "Flood" card reflects real backend data (the only hazard this
  // demo actually models) — rainfall/cyclone/landslide stay as sample data
  // since there's no real prediction source for them yet.
  const riskCards: RiskCard[] = mockRiskCards.map((card) => {
    if (card.id !== "flood" || !currentZone) return card;
    return {
      ...card,
      level: toCitizenLevel(currentZone.risk_category),
      probability: Math.round(currentZone.risk_score),
      recommendation:
        currentZone.risk_category === "low"
          ? "No action needed"
          : currentZone.risk_category === "moderate"
            ? "Stay alert"
            : "Be prepared",
    };
  });

  const nearestShelters = [...shelters]
    .map((s) => ({
      ...s,
      distanceKm: location.status === "ok" ? haversineDistanceKm(location.lat, location.lon, s.latitude, s.longitude) : null,
    }))
    .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
    .slice(0, 3);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-800 via-navy-900 to-navy-950 p-6 md:p-8">
        <div className="absolute top-0 right-0 w-72 h-72 bg-navy-600/20 rounded-full blur-3xl -translate-y-1/3 translate-x-1/4" />
        <div className="absolute bottom-0 left-1/3 w-48 h-48 bg-amber-500/8 rounded-full blur-3xl translate-y-1/2" />
        <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                <Icon name="Sunrise" className="w-4.5 h-4.5 text-amber-400" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-navy-300">Stay Informed. Stay Prepared. Stay Safe.</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Welcome back, {user?.name?.split(" ")[0] ?? "there"}!</h1>
            <p className="text-sm text-navy-300 mt-1.5">Here&apos;s what&apos;s happening in and around your area.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-navy-300 bg-white/5 backdrop-blur-sm px-3 py-2 rounded-xl self-start sm:self-end">
            <Icon name="Clock" className="w-3.5 h-3.5" />
            <span>Last updated: just now</span>
          </div>
        </div>
      </div>

      {/* Demo alert banner — sample content, not a live IMD/SACHET feed yet */}
      <button
        onClick={() => addToast("Live alert feeds land in a later phase — this is sample content.", "info")}
        className="w-full group relative overflow-hidden rounded-2xl bg-gradient-to-r from-danger-500 to-danger-600 p-px text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
      >
        <div className="relative rounded-2xl bg-gradient-to-r from-danger-50 to-danger-100 px-5 py-4 flex items-center gap-4">
          <div className="relative w-12 h-12 rounded-2xl bg-danger-500 flex items-center justify-center shadow-lg shadow-danger-500/30 flex-shrink-0">
            <Icon name="AlertTriangle" className="w-6 h-6 text-white" />
          </div>
          <div className="relative flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="badge bg-danger-600 text-white text-[10px] py-0.5">SAMPLE ALERT</span>
              <span className="text-xs font-medium text-danger-600">IMD Dehradun</span>
            </div>
            <p className="text-sm font-bold text-danger-700">Heavy rainfall expected in the next 48 hours</p>
            <p className="text-xs text-danger-600/80 mt-0.5">Demo content — live alerts land in a later phase</p>
          </div>
          <Icon name="ChevronRight" className="w-5 h-5 text-danger-400 group-hover:translate-x-1 transition-transform flex-shrink-0 relative" />
        </div>
      </button>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-navy-100 flex items-center justify-center">
            <Icon name="Activity" className="w-4 h-4 text-navy-600" />
          </div>
          <h2 className="text-lg font-bold text-navy-900">Risk &amp; Environmental Overview</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {riskCards.map((card, idx) => {
            const rc = getRiskColor(card.level);
            const chartColor = riskChartColors[card.level] ?? "#3d5da0";
            const isLive = card.id === "flood" && currentZone;
            return (
              <div key={card.id} className={`card card-hover card-glow p-5 group stagger-${Math.min(idx + 1, 4)}`}>
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 rounded-2xl ${rc.bg} flex items-center justify-center transition-transform group-hover:scale-110`}>
                    <Icon name={card.icon} className={`w-6 h-6 ${rc.text}`} strokeWidth={2} />
                  </div>
                  <span className={`badge ${rc.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${getRiskDot(card.level)}`} />
                    {getRiskLabel(card.level)}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-navy-900 mb-2 flex items-center gap-1.5">
                  {card.title}
                  {isLive && <span className="text-[9px] font-bold text-safe-600 uppercase">Live</span>}
                </h3>
                <div className="flex items-baseline gap-1.5 mb-3">
                  <span className="text-3xl font-bold gradient-text">{card.probability}%</span>
                  <span className="text-xs text-slate2-500">{isLive ? "risk score" : "chance"}</span>
                </div>
                <div className="mb-3">
                  <LineChart data={card.trend} color={chartColor} height={44} />
                </div>
                <p className="text-xs font-medium text-slate2-600 italic">&ldquo;{card.recommendation}&rdquo;</p>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-navy-100 flex items-center justify-center">
            <Icon name="Home" className="w-4 h-4 text-navy-600" />
          </div>
          <h2 className="text-lg font-bold text-navy-900">Nearby Shelters</h2>
        </div>
        {!token || nearestShelters.length === 0 ? (
          <div className="card p-6 text-sm text-slate2-500">
            {location.status !== "ok" ? "Waiting for your location…" : "No shelters found nearby."}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {nearestShelters.map((s) => (
              <div key={s.id} className="card p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold text-navy-900">{s.name}</p>
                  {s.distanceKm !== null && (
                    <span className="text-xs font-mono text-slate2-500">{s.distanceKm.toFixed(1)} km</span>
                  )}
                </div>
                <p className="text-xs text-slate2-500">
                  {s.occupied}/{s.capacity} occupied · {s.accessibility ?? "accessibility unknown"} · {s.status}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-navy-100 flex items-center justify-center">
            <Icon name="Waves" className="w-4 h-4 text-navy-600" />
          </div>
          <h2 className="text-lg font-bold text-navy-900">River Monitoring</h2>
          <span className="text-[10px] font-semibold text-slate2-400 uppercase">Sample data</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-navy-50 flex items-center justify-center">
                  <Icon name="Waves" className="w-6 h-6 text-navy-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-navy-900">River Level</h3>
                  <p className="text-xs text-slate2-500">{riverLevelData.name}</p>
                </div>
              </div>
              <span className="badge bg-warn-100 text-warn-700">
                <span className="w-1.5 h-1.5 rounded-full bg-warn-500 animate-pulse" />
                Above Normal
              </span>
            </div>
            <div className="flex items-end justify-between mb-4">
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold gradient-text">{riverLevelData.current}</span>
                  <span className="text-lg text-slate2-400">{riverLevelData.unit}</span>
                </div>
                <p className="text-xs text-warn-600 font-medium mt-0.5">Above normal ({riverLevelData.normal}{riverLevelData.unit})</p>
              </div>
              <div className="text-right space-y-1">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="w-2 h-2 rounded-full bg-slate2-300" />
                  <span className="text-slate2-500">Normal: {riverLevelData.normal}{riverLevelData.unit}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="w-2 h-2 rounded-full bg-danger-500" />
                  <span className="text-danger-600 font-medium">Critical: {riverLevelData.critical}{riverLevelData.unit}</span>
                </div>
              </div>
            </div>
            <LineChart data={riverLevelData.history} color="#5a7bb8" height={70} showArea showDots />
          </div>

          <div className="card p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-navy-50 flex items-center justify-center">
                  <Icon name="MapPinned" className="w-6 h-6 text-navy-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-navy-900">River Course Change</h3>
                  <p className="text-xs text-slate2-500">{riverLevelData.name}</p>
                </div>
              </div>
              <span className="badge bg-safe-100 text-safe-700">
                <span className="w-1.5 h-1.5 rounded-full bg-safe-500" />
                {riverCourseData.detail}
              </span>
            </div>
            <div className="relative h-36 rounded-xl bg-gradient-to-br from-navy-50 to-slate2-50 map-grid overflow-hidden mb-4 border border-slate2-100">
              <svg viewBox="0 0 200 100" className="w-full h-full">
                <path d="M 20 15 Q 60 30 100 50 Q 140 70 180 85" stroke="#5a7bb8" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.6" />
                <circle cx="60" cy="30" r="3" fill="#22c55e" />
                <circle cx="140" cy="70" r="3" fill="#22c55e" />
                <circle cx="100" cy="50" r="3" fill="#22c55e" />
              </svg>
              <div className="absolute bottom-2 right-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg glass border border-slate2-100">
                <Icon name="CheckCircle2" className="w-3.5 h-3.5 text-safe-500" />
                <span className="text-[11px] font-medium text-navy-700">No change detected</span>
              </div>
            </div>
            <p className="text-sm text-slate2-600">{riverCourseData.label}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
