import { apiFetch } from "@/lib/api";
import type { DashboardStats, RescueOperation, RescueStatus, Responder } from "@/types";

export function listResponders(token: string): Promise<Responder[]> {
  return apiFetch<Responder[]>("/responders", {}, token);
}

export function listRescueOps(token: string): Promise<RescueOperation[]> {
  return apiFetch<RescueOperation[]>("/rescue-operations", {}, token);
}

export function dispatchRescue(incidentId: number, token: string): Promise<RescueOperation> {
  return apiFetch<RescueOperation>(
    "/rescue-operations",
    { method: "POST", body: JSON.stringify({ incident_id: incidentId }) },
    token
  );
}

export function advanceRescue(
  opId: number,
  status: RescueStatus,
  token: string
): Promise<RescueOperation> {
  return apiFetch<RescueOperation>(
    `/rescue-operations/${opId}`,
    { method: "PATCH", body: JSON.stringify({ status }) },
    token
  );
}

export function getDashboardStats(token: string): Promise<DashboardStats> {
  return apiFetch<DashboardStats>("/dashboard/stats", {}, token);
}
