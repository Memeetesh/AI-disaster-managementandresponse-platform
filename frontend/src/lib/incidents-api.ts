import { apiFetch, apiFetchForm } from "@/lib/api";
import type { Incident, IncidentStatus, SeverityLevel } from "@/types";

export function listIncidents(
  token: string,
  params?: { sort?: "priority"; limit?: number }
): Promise<Incident[]> {
  const qs = new URLSearchParams();
  if (params?.sort) qs.set("sort", params.sort);
  if (params?.limit) qs.set("limit", String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<Incident[]>(`/incidents${suffix}`, {}, token);
}

export function getIncident(id: number, token: string): Promise<Incident> {
  return apiFetch<Incident>(`/incidents/${id}`, {}, token);
}

export interface ManualIncidentInput {
  type: string;
  latitude: number;
  longitude: number;
  severity: string;
  description?: string;
  people_affected?: number;
}

/** Responder/admin logs a phoned-in incident (`POST /incidents`, JSON). */
export function createIncident(input: ManualIncidentInput, token: string): Promise<Incident> {
  return apiFetch<Incident>(
    "/incidents",
    { method: "POST", body: JSON.stringify(input) },
    token
  );
}

export function patchIncident(
  id: number,
  token: string,
  update: { status?: IncidentStatus; severity?: SeverityLevel }
): Promise<Incident> {
  return apiFetch<Incident>(
    `/incidents/${id}`,
    { method: "PATCH", body: JSON.stringify(update) },
    token
  );
}

export interface SOSInput {
  latitude: number;
  longitude: number;
  peopleAffected: number;
  description?: string;
  image?: File | null;
  audio?: File | null;
}

export function submitSOS(input: SOSInput, token: string): Promise<Incident> {
  const form = new FormData();
  form.set("latitude", String(input.latitude));
  form.set("longitude", String(input.longitude));
  form.set("people_affected", String(input.peopleAffected));
  if (input.description) form.set("description", input.description);
  if (input.image) form.set("image", input.image);
  if (input.audio) form.set("audio", input.audio);
  return apiFetchForm<Incident>("/sos", form, token);
}

export interface ReportInput {
  latitude: number;
  longitude: number;
  type: string;
  description?: string;
  peopleAffected?: number;
  image?: File | null;
  audio?: File | null;
}

export function submitReport(input: ReportInput, token: string): Promise<Incident> {
  const form = new FormData();
  form.set("latitude", String(input.latitude));
  form.set("longitude", String(input.longitude));
  form.set("type", input.type);
  if (input.description) form.set("description", input.description);
  if (input.peopleAffected !== undefined) form.set("people_affected", String(input.peopleAffected));
  if (input.image) form.set("image", input.image);
  if (input.audio) form.set("audio", input.audio);
  return apiFetchForm<Incident>("/reports", form, token);
}
