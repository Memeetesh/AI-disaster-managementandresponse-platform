import { apiFetch } from "@/lib/api";

export type PlaceKind = "hospital" | "shelter" | "police" | "fire_station" | "pharmacy";

export interface NearbyPlace {
  name: string;
  kind: PlaceKind;
  latitude: number;
  longitude: number;
  distance_km: number;
  phone: string | null;
  address: string | null;
}

export function getNearbyPlaces(
  lat: number,
  lon: number,
  kind: PlaceKind,
  token: string,
  opts?: { radiusKm?: number; limit?: number }
): Promise<NearbyPlace[]> {
  const qs = new URLSearchParams({ lat: String(lat), lon: String(lon), kind });
  if (opts?.radiusKm) qs.set("radius_km", String(opts.radiusKm));
  if (opts?.limit) qs.set("limit", String(opts.limit));
  return apiFetch<NearbyPlace[]>(`/places/nearby?${qs.toString()}`, {}, token);
}
