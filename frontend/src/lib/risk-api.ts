import { apiFetch } from "@/lib/api";
import type { RiskMapResponse, RiskZoneProperties } from "@/types";

export function getRiskMap(token: string): Promise<RiskMapResponse> {
  return apiFetch<RiskMapResponse>("/risk-map", {}, token);
}

export function listRiskZones(token: string): Promise<(RiskZoneProperties & { geometry: unknown })[]> {
  return apiFetch("/risk-zones", {}, token);
}
