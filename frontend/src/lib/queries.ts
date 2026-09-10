"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { createAlert, listAlerts, type CreateAlertInput } from "@/lib/alerts-api";
import { sendSupportChat, type ChatMessage } from "@/lib/chat-api";
import { getNearbyPlaces, type PlaceKind } from "@/lib/places-api";
import { createCheckIn, getMyCheckIn, type CheckInInput } from "@/lib/checkin-api";
import {
  addFamilyMember,
  getLocationSharing,
  listFamily,
  listFamilyRequests,
  removeFamilyMember,
  respondToFamilyRequest,
  sendLocationPing,
  setLocationSharing,
  type AddFamilyMemberInput,
  type RealFamilyMember,
} from "@/lib/family-api";
import {
  createIncident,
  getIncident,
  listIncidents,
  patchIncident,
  submitReport,
  submitSOS,
  type ManualIncidentInput,
  type ReportInput,
  type SOSInput,
} from "@/lib/incidents-api";
import { getRiskMap } from "@/lib/risk-api";
import {
  getCycloneForecast,
  getFloodForecast,
  getLandslideForecast,
  getRainfallForecast,
} from "@/lib/weather-api";
import {
  advanceRescue,
  dispatchRescue,
  getDashboardStats,
  listRescueOps,
  listResponders,
} from "@/lib/rescue-api";
import { listShelters, nearestShelters, patchShelter } from "@/lib/shelters-api";
import { getSimulatorState } from "@/lib/simulator-api";
import type {
  CheckIn,
  Incident,
  IncidentStatus,
  RescueOperation,
  RescueStatus,
  SeverityLevel,
} from "@/types";

/**
 * Central query-key registry. Keep every key here so the realtime layer
 * (src/lib/realtime.tsx) can invalidate them by name without importing the
 * individual hooks. Keys are hierarchical: invalidating `["incidents"]`
 * also invalidates `["incidents", id]` and `["incidents", params]`.
 */
export const queryKeys = {
  incidents: (sort?: "priority") =>
    (sort ? ["incidents", { sort }] : ["incidents"]) as readonly unknown[],
  incident: (id: number) => ["incidents", id] as const,
  myReports: () => ["my-reports"] as const,
  riskMap: () => ["risk-map"] as const,
  shelters: () => ["shelters"] as const,
  nearestShelters: (lat?: number, lon?: number) =>
    ["shelters", "nearest", lat ?? null, lon ?? null] as const,
  rainfall: (lat?: number, lon?: number) =>
    ["weather", "rainfall", lat ?? null, lon ?? null] as const,
  places: (kind: string, lat?: number, lon?: number) =>
    ["places", kind, lat ?? null, lon ?? null] as const,
  flood: (lat?: number, lon?: number) =>
    ["weather", "flood", lat ?? null, lon ?? null] as const,
  cyclone: (lat?: number, lon?: number) =>
    ["weather", "cyclone", lat ?? null, lon ?? null] as const,
  landslide: (lat?: number, lon?: number) =>
    ["weather", "landslide", lat ?? null, lon ?? null] as const,
  simulatorState: () => ["simulator-state"] as const,
  alerts: (lat?: number, lon?: number) =>
    ["alerts", lat ?? null, lon ?? null] as const,
  responders: () => ["responders"] as const,
  rescueOps: () => ["rescue-ops"] as const,
  dashboardStats: () => ["dashboard-stats"] as const,
  myCheckIn: () => ["check-in", "me"] as const,
  family: () => ["family"] as const,
  familyRequests: () => ["family-requests"] as const,
  locationSharing: () => ["location-sharing"] as const,
};

/** Every realtime-backed key, invalidated once on each (re)connect. */
export function invalidateRealtimeQueries(qc: QueryClient): void {
  for (const key of [
    queryKeys.incidents(),
    queryKeys.myReports(),
    queryKeys.riskMap(),
    queryKeys.shelters(),
    queryKeys.simulatorState(),
    queryKeys.alerts(),
    queryKeys.responders(),
    queryKeys.rescueOps(),
    queryKeys.dashboardStats(),
    queryKeys.myCheckIn(),
    queryKeys.family(),
    queryKeys.familyRequests(),
  ]) {
    void qc.invalidateQueries({ queryKey: key });
  }
}

// --- Queries -------------------------------------------------------------

/** All incidents (responder/admin view). Citizens get only their own rows.
 * Pass `{ sort: "priority" }` for the command-center queue order. */
export function useIncidents(opts?: { sort?: "priority" }) {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.incidents(opts?.sort),
    queryFn: () => listIncidents(token as string, { sort: opts?.sort }),
    enabled: !!token,
  });
}

/** The signed-in citizen's own reports — same endpoint, distinct cache key. */
export function useMyReports() {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.myReports(),
    queryFn: () => listIncidents(token as string),
    enabled: !!token,
  });
}

export function useRiskMap() {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.riskMap(),
    queryFn: () => getRiskMap(token as string),
    enabled: !!token,
  });
}

export function useShelters() {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.shelters(),
    queryFn: () => listShelters(token as string),
    enabled: !!token,
  });
}

/** Shelters nearest to a point (server-ranked, with distance_km). Pass
 * null coords until geolocation resolves. */
export function useNearestShelters(lat: number | null, lon: number | null, limit = 5) {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.nearestShelters(lat ?? undefined, lon ?? undefined),
    queryFn: () => nearestShelters(lat as number, lon as number, token as string, limit),
    enabled: !!token && lat !== null && lon !== null,
  });
}

export function useMyCheckIn() {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.myCheckIn(),
    queryFn: () => getMyCheckIn(token as string),
    enabled: !!token,
  });
}

/** The citizen's family safety circle with each member's live status.
 * Pass the caller's coords to get `distance_km` to members sharing location.
 * Realtime invalidates this on `family.updated`; also polls every 60s as a
 * backstop (a member's "safe" check-in can go stale after 24h). */
export function useFamily(origin?: { lat: number; lon: number } | null) {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.family(),
    queryFn: () => listFamily(token as string, origin ?? null),
    enabled: !!token,
    refetchInterval: 60 * 1000,
  });
}

/** People who added the caller to their circle, awaiting accept/decline. */
export function useFamilyRequests() {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.familyRequests(),
    queryFn: () => listFamilyRequests(token as string),
    enabled: !!token,
    refetchInterval: 60 * 1000,
  });
}

/** The caller's own location-sharing state (opt-in, off by default). */
export function useLocationSharing() {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.locationSharing(),
    queryFn: () => getLocationSharing(token as string),
    enabled: !!token,
  });
}

/** Real nearby places (hospitals, shelters, …) from OpenStreetMap via the
 * backend. Cached an hour server-side; pass `enabled: false` to hold off. */
export function useNearbyPlaces(
  lat: number | null,
  lon: number | null,
  kind: PlaceKind,
  opts?: { radiusKm?: number; limit?: number; enabled?: boolean }
) {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.places(kind, lat ?? undefined, lon ?? undefined),
    queryFn: () =>
      getNearbyPlaces(lat as number, lon as number, kind, token as string, {
        radiusKm: opts?.radiusKm,
        limit: opts?.limit,
      }),
    enabled:
      (opts?.enabled ?? true) && !!token && lat !== null && lon !== null,
    staleTime: 30 * 60 * 1000,
  });
}

/** Location-based rainfall forecast (Open-Meteo, via the backend). Polls
 * every 15 min — weather forecasts don't refresh faster. */
export function useRainfallForecast(lat: number | null, lon: number | null) {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.rainfall(lat ?? undefined, lon ?? undefined),
    queryFn: () => getRainfallForecast(lat as number, lon as number, token as string),
    enabled: !!token && lat !== null && lon !== null,
    staleTime: 30 * 60 * 1000,
    refetchInterval: 15 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 4,
    retryDelay: (n) => Math.min(1500 * 2 ** n, 10000),
    // Once a card has a real value, keep showing it — a later failed
    // refetch must never revert it to the demo placeholder.
    placeholderData: keepPreviousData,
  });
}

/** Location-based flood forecast (GloFAS river discharge via Open-Meteo). */
export function useFloodForecast(lat: number | null, lon: number | null) {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.flood(lat ?? undefined, lon ?? undefined),
    queryFn: () => getFloodForecast(lat as number, lon as number, token as string),
    enabled: !!token && lat !== null && lon !== null,
    staleTime: 30 * 60 * 1000,
    refetchInterval: 15 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 4,
    retryDelay: (n) => Math.min(1500 * 2 ** n, 10000),
    // Once a card has a real value, keep showing it — a later failed
    // refetch must never revert it to the demo placeholder.
    placeholderData: keepPreviousData,
  });
}

/** Location-based cyclonic-conditions indicator (forecast wind + pressure). */
export function useCycloneForecast(lat: number | null, lon: number | null) {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.cyclone(lat ?? undefined, lon ?? undefined),
    queryFn: () => getCycloneForecast(lat as number, lon as number, token as string),
    enabled: !!token && lat !== null && lon !== null,
    staleTime: 30 * 60 * 1000,
    refetchInterval: 15 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 4,
    retryDelay: (n) => Math.min(1500 * 2 ** n, 10000),
    // Once a card has a real value, keep showing it — a later failed
    // refetch must never revert it to the demo placeholder.
    placeholderData: keepPreviousData,
  });
}

/** Location-based rainfall-triggered landslide indicator (slope × rainfall). */
export function useLandslideForecast(lat: number | null, lon: number | null) {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.landslide(lat ?? undefined, lon ?? undefined),
    queryFn: () => getLandslideForecast(lat as number, lon as number, token as string),
    enabled: !!token && lat !== null && lon !== null,
    staleTime: 30 * 60 * 1000,
    refetchInterval: 15 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 4,
    retryDelay: (n) => Math.min(1500 * 2 ** n, 10000),
    // Once a card has a real value, keep showing it — a later failed
    // refetch must never revert it to the demo placeholder.
    placeholderData: keepPreviousData,
  });
}

/** Responder roster (responder/admin only). */
export function useResponders() {
  const { token, user } = useAuth();
  return useQuery({
    queryKey: queryKeys.responders(),
    queryFn: () => listResponders(token as string),
    enabled: !!token && (user?.role === "responder" || user?.role === "admin"),
  });
}

/** Active + past rescue operations (responder/admin only). */
export function useRescueOps() {
  const { token, user } = useAuth();
  return useQuery({
    queryKey: queryKeys.rescueOps(),
    queryFn: () => listRescueOps(token as string),
    enabled: !!token && (user?.role === "responder" || user?.role === "admin"),
  });
}

export function useDashboardStats() {
  const { token, user } = useAuth();
  return useQuery({
    queryKey: queryKeys.dashboardStats(),
    queryFn: () => getDashboardStats(token as string),
    enabled: !!token && (user?.role === "responder" || user?.role === "admin"),
  });
}

export function useSimulatorState() {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.simulatorState(),
    queryFn: () => getSimulatorState(token as string),
    enabled: !!token,
  });
}

/** Active area-wide alerts, newest first. Realtime invalidates on
 * `alert.created` / `alert.updated`. */
export function useAlerts() {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.alerts(),
    queryFn: () => listAlerts(token as string),
    enabled: !!token,
  });
}

/** One incident by id. Realtime patches this key on `incident.updated`, so a
 * report-confirmation screen bound to it reflects a responder's verify/reject
 * without a manual refresh. */
export function useIncident(id: number | null | undefined) {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.incident(id ?? 0),
    queryFn: () => getIncident(id as number, token as string),
    enabled: !!token && typeof id === "number",
  });
}

// --- Mutations ---------------------------------------------------------

function useIncidentCreateMutation<TInput>(
  submit: (input: TInput, token: string) => Promise<Incident>,
) {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TInput) => submit(input, token as string),
    onSuccess: (incident: Incident) => {
      qc.setQueryData(queryKeys.incident(incident.id), incident);
      void qc.invalidateQueries({ queryKey: queryKeys.myReports() });
      void qc.invalidateQueries({ queryKey: queryKeys.incidents() });
      void qc.invalidateQueries({ queryKey: queryKeys.dashboardStats() });
      void qc.invalidateQueries({ queryKey: queryKeys.riskMap() });
    },
  });
}

/** Citizen non-emergency incident report (`POST /reports`). */
export function useSubmitReport() {
  return useIncidentCreateMutation<ReportInput>(submitReport);
}

/** Citizen emergency SOS (`POST /sos`). */
export function useSubmitSOS() {
  return useIncidentCreateMutation<SOSInput>(submitSOS);
}

/** Responder/admin manual incident logging (`POST /incidents`). */
export function useCreateIncident() {
  return useIncidentCreateMutation<ManualIncidentInput>(createIncident);
}

/** Citizen "I am Safe" self check-in. */
export function useCheckIn() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CheckInInput) => createCheckIn(input, token as string),
    onSuccess: (checkIn: CheckIn) => {
      qc.setQueryData(queryKeys.myCheckIn(), checkIn);
      void qc.invalidateQueries({ queryKey: queryKeys.myCheckIn() });
    },
  });
}

/** Add a person to the citizen's family safety circle. */
export function useAddFamilyMember() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AddFamilyMemberInput) => addFamilyMember(input, token as string),
    onSuccess: (member: RealFamilyMember) => {
      qc.setQueryData(
        queryKeys.family(),
        (prev: RealFamilyMember[] | undefined) => [...(prev ?? []), member]
      );
      void qc.invalidateQueries({ queryKey: queryKeys.family() });
    },
  });
}

/** Remove a person from the citizen's family safety circle. */
export function useRemoveFamilyMember() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => removeFamilyMember(id, token as string),
    onSuccess: (_void, id: number) => {
      qc.setQueryData(
        queryKeys.family(),
        (prev: RealFamilyMember[] | undefined) => prev?.filter((m) => m.id !== id) ?? prev
      );
      void qc.invalidateQueries({ queryKey: queryKeys.family() });
    },
  });
}

/** Accept or decline a "someone added you to their circle" request. */
export function useRespondToFamilyRequest() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; accept: boolean }) =>
      respondToFamilyRequest(vars.id, vars.accept, token as string),
    onSuccess: (_void, vars) => {
      qc.setQueryData(
        queryKeys.familyRequests(),
        (prev: { id: number }[] | undefined) => prev?.filter((r) => r.id !== vars.id) ?? prev
      );
      void qc.invalidateQueries({ queryKey: queryKeys.familyRequests() });
      void qc.invalidateQueries({ queryKey: queryKeys.family() });
    },
  });
}

/** Turn the caller's own location sharing on or off. */
export function useSetLocationSharing() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => setLocationSharing(enabled, token as string),
    onSuccess: (state) => {
      qc.setQueryData(queryKeys.locationSharing(), state);
      void qc.invalidateQueries({ queryKey: queryKeys.family() });
    },
  });
}

/** Push one location ping (only accepted while sharing is on). */
export function useSendLocationPing() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (coords: { latitude: number; longitude: number }) =>
      sendLocationPing(coords, token as string),
    onSuccess: (state) => {
      qc.setQueryData(queryKeys.locationSharing(), state);
    },
  });
}

/** Dispatch a verified incident to the nearest available responder. */
export function useDispatch() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (incidentId: number) => dispatchRescue(incidentId, token as string),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.rescueOps() });
      void qc.invalidateQueries({ queryKey: queryKeys.incidents() });
      void qc.invalidateQueries({ queryKey: queryKeys.responders() });
      void qc.invalidateQueries({ queryKey: queryKeys.dashboardStats() });
    },
  });
}

/** Advance a rescue operation's status (en_route → in_progress → completed / cancelled). */
export function useAdvanceRescue() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; status: RescueStatus }) =>
      advanceRescue(vars.id, vars.status, token as string),
    onSuccess: (op: RescueOperation) => {
      qc.setQueryData(
        queryKeys.rescueOps(),
        (prev: RescueOperation[] | undefined) =>
          prev?.map((o) => (o.id === op.id ? op : o)) ?? prev
      );
      void qc.invalidateQueries({ queryKey: queryKeys.rescueOps() });
      void qc.invalidateQueries({ queryKey: queryKeys.incidents() });
      void qc.invalidateQueries({ queryKey: queryKeys.responders() });
      void qc.invalidateQueries({ queryKey: queryKeys.dashboardStats() });
    },
  });
}

/** Responder/admin shelter status/occupancy update. */
export function usePatchShelter() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; update: { status?: string; occupied?: number } }) =>
      patchShelter(vars.id, token as string, vars.update),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.shelters() }),
  });
}

/** Support-chat companion turn (`POST /chat/support`). No cache — one round-trip. */
export function useSupportChat() {
  const { token } = useAuth();
  return useMutation({
    mutationFn: (messages: ChatMessage[]) => sendSupportChat(messages, token as string),
  });
}

/** Command-center admin issues an area-wide alert (`POST /alerts`). */
export function useCreateAlert() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAlertInput) => createAlert(input, token as string),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.alerts() }),
  });
}

/** Responder/admin verify / reject / lifecycle transition on an incident. */
export function useUpdateIncident() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id: number;
      update: { status?: IncidentStatus; severity?: SeverityLevel };
    }) => patchIncident(vars.id, token as string, vars.update),
    onSuccess: (updated: Incident) => {
      qc.setQueryData(queryKeys.incident(updated.id), updated);
      void qc.invalidateQueries({ queryKey: queryKeys.incidents() });
      void qc.invalidateQueries({ queryKey: queryKeys.myReports() });
      void qc.invalidateQueries({ queryKey: queryKeys.dashboardStats() });
      void qc.invalidateQueries({ queryKey: queryKeys.riskMap() });
    },
  });
}
