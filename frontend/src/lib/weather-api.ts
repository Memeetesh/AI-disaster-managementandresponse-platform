import { apiFetch } from "@/lib/api";
import type {
  CycloneForecast,
  FloodForecast,
  LandslideForecast,
  RainfallForecast,
} from "@/types";

export function getRainfallForecast(
  lat: number,
  lon: number,
  token: string
): Promise<RainfallForecast> {
  const qs = new URLSearchParams({ lat: String(lat), lon: String(lon) });
  return apiFetch<RainfallForecast>(`/weather/rainfall?${qs.toString()}`, {}, token);
}

export function getFloodForecast(
  lat: number,
  lon: number,
  token: string
): Promise<FloodForecast> {
  const qs = new URLSearchParams({ lat: String(lat), lon: String(lon) });
  return apiFetch<FloodForecast>(`/weather/flood?${qs.toString()}`, {}, token);
}

export function getCycloneForecast(
  lat: number,
  lon: number,
  token: string
): Promise<CycloneForecast> {
  const qs = new URLSearchParams({ lat: String(lat), lon: String(lon) });
  return apiFetch<CycloneForecast>(`/weather/cyclone?${qs.toString()}`, {}, token);
}

export function getLandslideForecast(
  lat: number,
  lon: number,
  token: string
): Promise<LandslideForecast> {
  const qs = new URLSearchParams({ lat: String(lat), lon: String(lon) });
  return apiFetch<LandslideForecast>(`/weather/landslide?${qs.toString()}`, {}, token);
}
