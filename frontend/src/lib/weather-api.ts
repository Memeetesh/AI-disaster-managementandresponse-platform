import { apiFetch } from "@/lib/api";
import type {
  CycloneForecast,
  FloodForecast,
  LandslideForecast,
  RainfallForecast,
} from "@/types";

/**
 * Weather forecasts normally come from our FastAPI backend (which caches
 * and shapes the Open-Meteo response). If the backend is unreachable, the
 * two headline cards — rainfall and flood — fall back to calling Open-Meteo
 * *directly from the browser*. Open-Meteo is keyless and CORS-enabled, so
 * the cards stay live even with the backend completely down.
 */

const OM_FORECAST = "https://api.open-meteo.com/v1/forecast";
const OM_FLOOD = "https://flood-api.open-meteo.com/v1/flood";

type Level = "low" | "moderate" | "high" | "critical";

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

// --- rainfall ---------------------------------------------------------------

function rainfallLevel(mm: number): Level {
  if (mm < 7.5) return "low";
  if (mm < 35.5) return "moderate";
  if (mm < 115.5) return "high";
  return "critical";
}

const RAIN_RECO: Record<Level, string> = {
  low: "Light or no rain expected. No action needed.",
  moderate: "Moderate rain likely. Carry rain protection.",
  high: "Heavy rain likely. Avoid low-lying areas and waterlogged roads.",
  critical:
    "Very heavy rain expected. Flooding risk — stay indoors and keep an emergency kit ready.",
};

async function rainfallDirect(lat: number, lon: number): Promise<RainfallForecast> {
  const qs = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: "precipitation,rain,weather_code",
    daily: "precipitation_sum,precipitation_probability_max",
    forecast_days: "7",
    timezone: "auto",
  });
  const res = await fetch(`${OM_FORECAST}?${qs}`);
  if (!res.ok) throw new Error(`open-meteo ${res.status}`);
  const data = await res.json();
  const daily = data.daily ?? {};
  const sums: number[] = (daily.precipitation_sum ?? []).slice(0, 7).map((x: number) => x ?? 0);
  const probs: number[] = (daily.precipitation_probability_max ?? [])
    .slice(0, 7)
    .map((x: number) => x ?? 0);
  const today = sums[0] ?? 0;
  const tomorrow = sums[1] ?? 0;
  const peak = Math.max(today, tomorrow, 0);
  const level = rainfallLevel(peak);
  return {
    latitude: lat,
    longitude: lon,
    probability: Math.max(0, ...probs.slice(0, 2)),
    rain_24h_mm: r1(today),
    rain_48h_mm: r1(today + tomorrow),
    current_precipitation_mm: r2(Number(data.current?.precipitation ?? 0)),
    level,
    recommendation: RAIN_RECO[level],
    trend: sums.map(r1),
    source: "open-meteo (direct)",
  };
}

// --- flood (GloFAS river discharge) --------------------------------------

function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function floodLevel(ratio: number | null): Level {
  if (ratio === null || ratio < 1.1) return "low";
  if (ratio < 1.7) return "moderate";
  if (ratio < 2.8) return "high";
  return "critical";
}

function floodScore(ratio: number | null): number {
  if (ratio === null) return 5;
  return Math.round(Math.max(0, Math.min(100, (ratio - 1) * 40 + 15)));
}

const FLOOD_RECO: Record<Level, string> = {
  low: "River levels near normal. No flood action needed.",
  moderate: "River flow rising above normal. Stay alert and avoid river banks.",
  high: "Significant flood risk — river flow well above normal. Move valuables up and be ready to evacuate.",
  critical:
    "Severe flood risk — river flow far above normal. Move to higher ground now and follow official instructions.",
};

async function floodDirect(lat: number, lon: number): Promise<FloodForecast> {
  const qs = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily: "river_discharge",
    past_days: "92",
    forecast_days: "30",
  });
  const res = await fetch(`${OM_FLOOD}?${qs}`);
  if (!res.ok) throw new Error(`open-meteo-flood ${res.status}`);
  const data = await res.json();
  const series: number[] = (data.daily?.river_discharge ?? []).map((x: number) => x ?? 0);
  const nPast = Math.min(92, series.length);
  const past = series.slice(0, nPast);
  const forecast = series.slice(nPast);
  const current = nPast ? past[nPast - 1] : series[series.length - 1] ?? 0;
  const baseline = median(past.filter((d) => d > 0)) || (past.length ? Math.max(...past) : 0);
  const peak = forecast.length ? Math.max(...forecast) : current;
  const noRiver = baseline < 0.1 && peak < 0.1;
  const ratio = noRiver ? null : r2(peak / Math.max(baseline, 0.1));
  const level = floodLevel(ratio);
  const trend = (forecast.length ? forecast.slice(0, 10) : past.slice(-10)).map(r1);
  return {
    latitude: lat,
    longitude: lon,
    flood_risk_score: floodScore(ratio),
    anomaly_ratio: ratio,
    current_discharge_m3s: r1(current),
    forecast_peak_m3s: r1(peak),
    baseline_discharge_m3s: r1(baseline),
    level,
    recommendation: FLOOD_RECO[level],
    trend,
    source: noRiver
      ? "open-meteo-flood (direct — no major river here)"
      : "open-meteo-flood (direct, GloFAS)",
  };
}

// --- public API ----------------------------------------------------------

export async function getRainfallForecast(
  lat: number,
  lon: number,
  token: string
): Promise<RainfallForecast> {
  const qs = new URLSearchParams({ lat: String(lat), lon: String(lon) });
  try {
    return await apiFetch<RainfallForecast>(`/weather/rainfall?${qs}`, {}, token);
  } catch {
    return rainfallDirect(lat, lon);
  }
}

export async function getFloodForecast(
  lat: number,
  lon: number,
  token: string
): Promise<FloodForecast> {
  const qs = new URLSearchParams({ lat: String(lat), lon: String(lon) });
  try {
    return await apiFetch<FloodForecast>(`/weather/flood?${qs}`, {}, token);
  } catch {
    return floodDirect(lat, lon);
  }
}

export function getCycloneForecast(
  lat: number,
  lon: number,
  token: string
): Promise<CycloneForecast> {
  const qs = new URLSearchParams({ lat: String(lat), lon: String(lon) });
  return apiFetch<CycloneForecast>(`/weather/cyclone?${qs}`, {}, token);
}

export function getLandslideForecast(
  lat: number,
  lon: number,
  token: string
): Promise<LandslideForecast> {
  const qs = new URLSearchParams({ lat: String(lat), lon: String(lon) });
  return apiFetch<LandslideForecast>(`/weather/landslide?${qs}`, {}, token);
}
