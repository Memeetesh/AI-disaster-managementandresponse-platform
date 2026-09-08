"use client";

import Link from "next/link";
import { Icon, getRiskColor, getRiskLabel, getRiskDot } from "@/components/citizen/Icon";
import { LineChart } from "@/components/citizen/Charts";
import { riskCards as mockRiskCards } from "@/data/citizen-mock";
import { useAuth } from "@/lib/auth-context";
import { useLocation } from "@/hooks/useLocation";
import {
  useAlerts,
  useCycloneForecast,
  useFloodForecast,
  useLandslideForecast,
  useNearbyPlaces,
  useNearestShelters,
  useRainfallForecast,
  useRiskMap,
} from "@/lib/queries";
import { alertRelativeTime, alertSourceLabel, topAlert } from "@/lib/alerts";
import { pointInPolygon } from "@/lib/geo";
import type { RiskMapResponse, RiskZoneProperties } from "@/types";
import type { RiskCard, CitizenRiskLevel } from "@/types/citizen-ui";

function relativeTime(ms: number): string {
  if (!ms) return "—";
  const secs = Math.round((Date.now() - ms) / 1000);
  if (secs < 5) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

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
  const { user } = useAuth();
  const location = useLocation();

  // Realtime (src/lib/realtime.tsx) invalidates these on `risk.updated` /
  // `alert.*`, so the flood card, shelter list, and alert banner stay live.
  // On error the page still renders — it falls back to the demo risk cards.
  const lat = location.status === "ok" ? location.lat : null;
  const lon = location.status === "ok" ? location.lon : null;

  const riskMapQuery = useRiskMap();
  const alertsQuery = useAlerts();
  const sheltersQuery = useNearestShelters(lat, lon, 3);
  const rainfallQuery = useRainfallForecast(lat, lon);
  const floodQuery = useFloodForecast(lat, lon);
  const cycloneQuery = useCycloneForecast(lat, lon);
  const landslideQuery = useLandslideForecast(lat, lon);
  const riskMap: RiskMapResponse | null = riskMapQuery.data ?? null;
  const activeAlert = topAlert(alertsQuery.data ?? []);
  const appShelters = sheltersQuery.data ?? [];
  const appSheltersNear = appShelters.filter((s) => s.distance_km <= 25);
  // Only reach out to OpenStreetMap when there aren't enough registered
  // relief shelters near the user.
  const osmSheltersQuery = useNearbyPlaces(lat, lon, "shelter", {
    radiusKm: 15,
    limit: 4,
    enabled: appSheltersNear.length < 3,
  });
  const osmShelters = osmSheltersQuery.data ?? [];
  const rainfall = rainfallQuery.data ?? null;
  const flood = floodQuery.data ?? null;
  const cyclone = cycloneQuery.data ?? null;
  const landslide = landslideQuery.data ?? null;

  const currentZone =
    riskMap && location.status === "ok" ? findZoneForLocation(riskMap, location.lat, location.lon) : null;

  // Every card is now a live location forecast: "Flood" = seeded risk-zone
  // score where it exists (simulator-aware) else GloFAS discharge; "Rainfall"
  // / "Cyclone" / "Landslide" = Open-Meteo-derived indicators.
  const riskCards: RiskCard[] = mockRiskCards.map((card) => {
    if (card.id === "flood" && currentZone) {
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
    }
    if (card.id === "flood" && flood) {
      return {
        ...card,
        level: flood.level,
        probability: flood.flood_risk_score,
        recommendation: flood.recommendation,
        trend: flood.trend.length > 1 ? flood.trend : card.trend,
      };
    }
    if (card.id === "rainfall" && rainfall) {
      return {
        ...card,
        level: rainfall.level,
        probability: rainfall.probability,
        recommendation: rainfall.recommendation,
        trend: rainfall.trend.length > 1 ? rainfall.trend : card.trend,
      };
    }
    if (card.id === "cyclone" && cyclone) {
      return {
        ...card,
        level: cyclone.level,
        probability: cyclone.cyclone_risk_score,
        recommendation: cyclone.recommendation,
        trend: cyclone.trend.length > 1 ? cyclone.trend : card.trend,
      };
    }
    if (card.id === "landslide" && landslide) {
      return {
        ...card,
        level: landslide.level,
        probability: landslide.landslide_risk_score,
        recommendation: landslide.recommendation,
        trend: landslide.trend.length > 1 ? landslide.trend : card.trend,
      };
    }
    return card;
  });

  const liveCardIds = new Set<string>();
  if (currentZone || flood) liveCardIds.add("flood");
  if (rainfall) liveCardIds.add("rainfall");
  if (cyclone) liveCardIds.add("cyclone");
  if (landslide) liveCardIds.add("landslide");

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
            <span>Last updated: {relativeTime(riskMapQuery.dataUpdatedAt)}</span>
          </div>
        </div>
      </div>

      {/* Live area-wide alert — most severe active alert from GET /alerts */}
      {activeAlert && (
        <Link
          href="/support"
          className="w-full group relative overflow-hidden rounded-2xl bg-gradient-to-r from-danger-500 to-danger-600 p-px text-left transition-all hover:scale-[1.01] active:scale-[0.99] block"
        >
          <div className="relative rounded-2xl bg-gradient-to-r from-danger-50 to-danger-100 px-5 py-4 flex items-center gap-4">
            <div className="relative w-12 h-12 rounded-2xl bg-danger-500 flex items-center justify-center shadow-lg shadow-danger-500/30 flex-shrink-0">
              <Icon name="AlertTriangle" className="w-6 h-6 text-white" />
            </div>
            <div className="relative flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="badge bg-danger-600 text-white text-[10px] py-0.5 uppercase">
                  {activeAlert.severity.replace("_", " ")}
                </span>
                <span className="text-xs font-medium text-danger-600">
                  {alertSourceLabel(activeAlert.source)} · {alertRelativeTime(activeAlert.issued_at)}
                </span>
              </div>
              <p className="text-sm font-bold text-danger-700 line-clamp-2">{activeAlert.message}</p>
              <p className="text-xs text-danger-600/80 mt-0.5">Tap to see all authority messages</p>
            </div>
            <Icon name="ChevronRight" className="w-5 h-5 text-danger-400 group-hover:translate-x-1 transition-transform flex-shrink-0 relative" />
          </div>
        </Link>
      )}

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
            const isLive = liveCardIds.has(card.id);
            const rainfallLive = card.id === "rainfall" && rainfall ? rainfall : null;
            const cycloneLive = card.id === "cyclone" && cyclone ? cyclone : null;
            const landslideLive = card.id === "landslide" && landslide ? landslide : null;
            const floodLive = card.id === "flood" && !currentZone && flood ? flood : null;
            let metric = "chance";
            if (card.id === "flood") {
              metric = currentZone
                ? "risk score"
                : floodLive?.anomaly_ratio != null
                  ? `peak ${floodLive.anomaly_ratio}× normal`
                  : floodLive
                    ? "no major river nearby"
                    : "risk score";
            }
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
                  {rainfallLive ? (
                    <>
                      <span className="text-3xl font-bold gradient-text">{rainfallLive.rain_24h_mm}</span>
                      <span className="text-xs text-slate2-500">
                        mm next 24h · {rainfallLive.probability}% chance
                      </span>
                    </>
                  ) : cycloneLive ? (
                    <>
                      <span className="text-3xl font-bold gradient-text">
                        {Math.round(cycloneLive.peak_gust_kmh)}
                      </span>
                      <span className="text-xs text-slate2-500">
                        km/h peak gusts
                        {cycloneLive.min_pressure_hpa != null &&
                          ` · min ${Math.round(cycloneLive.min_pressure_hpa)} hPa`}
                      </span>
                    </>
                  ) : landslideLive ? (
                    <>
                      <span className="text-3xl font-bold gradient-text">
                        {landslideLive.landslide_risk_score}%
                      </span>
                      <span className="text-xs text-slate2-500">
                        {landslideLive.slope_degrees < 6
                          ? "flat terrain"
                          : `slope ${Math.round(landslideLive.slope_degrees)}° · ${Math.round(
                              landslideLive.rain_trigger_mm
                            )} mm rain`}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-3xl font-bold gradient-text">{card.probability}%</span>
                      <span className="text-xs text-slate2-500">{isLive ? metric : "chance"}</span>
                    </>
                  )}
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
        {appSheltersNear.length === 0 && osmShelters.length === 0 ? (
          <div className="card p-6 text-sm text-slate2-500">
            {location.status !== "ok"
              ? "Waiting for your location…"
              : sheltersQuery.isLoading || osmSheltersQuery.isLoading
                ? "Finding shelters near you…"
                : "No shelters found near your location."}
          </div>
        ) : (
          <div className="space-y-4">
            {appSheltersNear.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {appSheltersNear.map((s) => (
                  <div key={s.id} className="card p-5">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-bold text-navy-900">{s.name}</p>
                      <span className="text-xs font-mono text-slate2-500">{s.distance_km.toFixed(1)} km</span>
                    </div>
                    <p className="text-xs text-slate2-500">
                      {s.occupied}/{s.capacity} occupied · {s.accessibility ?? "accessibility unknown"} · {s.status}
                    </p>
                  </div>
                ))}
              </div>
            )}
            {osmShelters.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate2-400 uppercase mb-2">
                  Other nearby shelters · OpenStreetMap
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {osmShelters.map((p, i) => (
                    <a
                      key={`${p.name}-${i}`}
                      href={`https://www.openstreetmap.org/?mlat=${p.latitude}&mlon=${p.longitude}#map=17/${p.latitude}/${p.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="card card-hover p-5 block"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-bold text-navy-900">{p.name}</p>
                        <span className="text-xs font-mono text-slate2-500">{p.distance_km.toFixed(1)} km</span>
                      </div>
                      <p className="text-xs text-slate2-500">{p.address ?? "Tap to open in maps"}</p>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-navy-100 flex items-center justify-center">
            <Icon name="Waves" className="w-4 h-4 text-navy-600" />
          </div>
          <h2 className="text-lg font-bold text-navy-900">River Discharge</h2>
          <span className="text-[10px] font-semibold text-slate2-400 uppercase">GloFAS forecast</span>
        </div>
        {location.status !== "ok" ? (
          <div className="card p-6 text-sm text-slate2-500">Waiting for your location…</div>
        ) : !flood ? (
          <div className="card p-6 text-sm text-slate2-500">Loading river data…</div>
        ) : flood.anomaly_ratio === null ? (
          <div className="card p-6 text-sm text-slate2-500">
            No major river modelled near your location, so there is no discharge signal to show here.
          </div>
        ) : (
          (() => {
            const rc = getRiskColor(flood.level);
            const label =
              flood.level === "low"
                ? "Near normal"
                : flood.level === "moderate"
                  ? "Above normal"
                  : flood.level === "high"
                    ? "High flow"
                    : "Very high flow";
            return (
              <div className="card p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-navy-50 flex items-center justify-center">
                      <Icon name="Waves" className="w-6 h-6 text-navy-600" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-navy-900">Nearest river reach</h3>
                      <p className="text-xs text-slate2-500">Copernicus GloFAS river-discharge model</p>
                    </div>
                  </div>
                  <span className={`badge ${rc.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${getRiskDot(flood.level)}`} />
                    {label}
                  </span>
                </div>
                <div className="flex items-end justify-between mb-4">
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold gradient-text">
                        {Math.round(flood.current_discharge_m3s).toLocaleString()}
                      </span>
                      <span className="text-lg text-slate2-400">m³/s</span>
                    </div>
                    <p className="text-xs text-slate2-500 mt-0.5">current flow</p>
                  </div>
                  <div className="text-right space-y-1 text-xs">
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-slate2-300" />
                      <span className="text-slate2-500">
                        Normal: {Math.round(flood.baseline_discharge_m3s).toLocaleString()} m³/s
                      </span>
                    </div>
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-danger-500" />
                      <span className="text-danger-600 font-medium">
                        Forecast peak: {Math.round(flood.forecast_peak_m3s).toLocaleString()} m³/s (
                        {flood.anomaly_ratio}× normal)
                      </span>
                    </div>
                  </div>
                </div>
                <LineChart data={flood.trend} color="#5a7bb8" height={70} showArea showDots />
                <p className="mt-3 text-xs font-medium text-slate2-600 italic">
                  &ldquo;{flood.recommendation}&rdquo;
                </p>
              </div>
            );
          })()
        )}
      </section>
    </div>
  );
}
