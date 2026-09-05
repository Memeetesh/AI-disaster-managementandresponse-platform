// Mirrors backend/app/models/enums.py and backend/app/schemas/user.py.
// Keep these in sync by hand for now — a generated OpenAPI client can
// replace this once the API surface stabilizes past Phase 1.

export type UserRole = "citizen" | "responder" | "admin";

export interface User {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  role: UserRole;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface ApiErrorBody {
  detail: string | { msg: string; loc: (string | number)[] }[];
}

export type IncidentType = "flood" | "fire" | "earthquake" | "cyclone" | "landslide" | "other";
export type IncidentStatus =
  | "reported"
  | "ai_verified"
  | "human_review"
  | "verified"
  | "rejected"
  | "in_progress"
  | "resolved";
export type SeverityLevel = "low" | "moderate" | "high" | "very_high" | "critical";

export interface Evidence {
  id: number;
  image_url: string | null;
  video_url: string | null;
  audio_url: string | null;
  extracted_text: string | null;
  ai_detection: Record<string, unknown> | null;
  ai_confidence: number | null;
  created_at: string;
}

export interface Incident {
  id: number;
  type: IncidentType;
  latitude: number;
  longitude: number;
  severity: SeverityLevel;
  confidence: number;
  status: IncidentStatus;
  description: string | null;
  reported_by: number | null;
  people_affected: number;
  created_at: string;
  verified_at: string | null;
  evidence: Evidence[];
}

export type RiskCategory = "low" | "moderate" | "high" | "very_high" | "critical";

export interface RiskZoneProperties {
  id: number;
  risk_score: number;
  risk_category: RiskCategory;
  hazard_score: number;
  population_exposure: number;
  infrastructure_vulnerability: number;
  accessibility_score: number;
  historical_risk_score: number;
  nearby_incident_count: number;
}

export interface GeoJSONPolygon {
  type: "Polygon";
  coordinates: number[][][];
}

export interface RiskZoneFeature {
  type: "Feature";
  geometry: GeoJSONPolygon;
  properties: RiskZoneProperties;
}

export interface RiskMapResponse {
  type: "FeatureCollection";
  features: RiskZoneFeature[];
}

export interface SimulatorState {
  active: boolean;
  rainfall_mm: number;
  water_level_m: number;
  road_blockage_pct: number;
}

export interface Shelter {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  capacity: number;
  occupied: number;
  facilities: string[] | null;
  accessibility: string | null;
  status: string;
}
