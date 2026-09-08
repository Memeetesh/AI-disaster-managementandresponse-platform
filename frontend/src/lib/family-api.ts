import { apiFetch } from "@/lib/api";

/** Live status the backend derives from a saved contact's check-ins / SOS. */
export type FamilyStatus =
  | "not_registered"
  | "invite_pending"
  | "invite_declined"
  | "in_emergency"
  | "needs_help"
  | "safe"
  | "no_checkin";

export type LinkStatus = "pending" | "accepted" | "declined";

export interface RealFamilyMember {
  id: number;
  name: string;
  phone: string;
  relation: string | null;
  on_drishti: boolean;
  link_status: LinkStatus;
  status: FamilyStatus;
  status_label: string;
  last_check_in_at: string | null;
  shares_location: boolean;
  latitude: number | null;
  longitude: number | null;
  location_updated_at: string | null;
  distance_km: number | null;
  created_at: string;
}

export interface AddFamilyMemberInput {
  name: string;
  phone: string;
  relation?: string | null;
}

export interface FamilyRequest {
  id: number;
  owner_name: string;
  relation: string | null;
  created_at: string;
}

export interface LocationSharingState {
  enabled: boolean;
  latitude: number | null;
  longitude: number | null;
  updated_at: string | null;
}

export function listFamily(
  token: string,
  origin?: { lat: number; lon: number } | null
): Promise<RealFamilyMember[]> {
  const qs = origin ? `?lat=${origin.lat}&lon=${origin.lon}` : "";
  return apiFetch<RealFamilyMember[]>(`/family${qs}`, {}, token);
}

export function addFamilyMember(
  input: AddFamilyMemberInput,
  token: string
): Promise<RealFamilyMember> {
  return apiFetch<RealFamilyMember>(
    "/family",
    { method: "POST", body: JSON.stringify(input) },
    token
  );
}

export function removeFamilyMember(id: number, token: string): Promise<void> {
  return apiFetch<void>(`/family/${id}`, { method: "DELETE" }, token);
}

export function listFamilyRequests(token: string): Promise<FamilyRequest[]> {
  return apiFetch<FamilyRequest[]>("/family/requests", {}, token);
}

export function respondToFamilyRequest(
  id: number,
  accept: boolean,
  token: string
): Promise<void> {
  return apiFetch<void>(
    `/family/requests/${id}/respond`,
    { method: "POST", body: JSON.stringify({ accept }) },
    token
  );
}

export function getLocationSharing(token: string): Promise<LocationSharingState> {
  return apiFetch<LocationSharingState>("/family/location-sharing", {}, token);
}

export function setLocationSharing(
  enabled: boolean,
  token: string
): Promise<LocationSharingState> {
  return apiFetch<LocationSharingState>(
    "/family/location-sharing",
    { method: "PUT", body: JSON.stringify({ enabled }) },
    token
  );
}

export function sendLocationPing(
  coords: { latitude: number; longitude: number },
  token: string
): Promise<LocationSharingState> {
  return apiFetch<LocationSharingState>(
    "/family/location-sharing/ping",
    { method: "POST", body: JSON.stringify(coords) },
    token
  );
}
