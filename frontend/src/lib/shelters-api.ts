import { apiFetch } from "@/lib/api";
import type { NearbyShelter, Shelter } from "@/types";

export function listShelters(token: string): Promise<Shelter[]> {
  return apiFetch<Shelter[]>("/shelters", {}, token);
}

export function nearestShelters(
  lat: number,
  lon: number,
  token: string,
  limit = 5
): Promise<NearbyShelter[]> {
  const qs = new URLSearchParams({ lat: String(lat), lon: String(lon), limit: String(limit) });
  return apiFetch<NearbyShelter[]>(`/shelters/nearest?${qs.toString()}`, {}, token);
}

export function patchShelter(
  id: number,
  token: string,
  update: { status?: string; occupied?: number }
): Promise<Shelter> {
  return apiFetch<Shelter>(
    `/shelters/${id}`,
    { method: "PATCH", body: JSON.stringify(update) },
    token
  );
}
