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

export type PriorityLevel = "low" | "medium" | "high" | "critical";

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
  priority: PriorityLevel | null;
  evidence: Evidence[];
}

export type ResponderStatus = "available" | "en_route" | "busy" | "offline";

export interface Responder {
  id: number;
  name: string;
  team: string | null;
  latitude: number;
  longitude: number;
  status: ResponderStatus;
  vehicle: string | null;
  capacity: number;
}

export type RescueStatus =
  | "pending"
  | "assigned"
  | "en_route"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface GeoJSONLineString {
  type: "LineString";
  coordinates: [number, number][];
}

export interface RescueOperation {
  id: number;
  incident_id: number;
  responder_id: number | null;
  priority: PriorityLevel;
  eta_minutes: number | null;
  status: RescueStatus;
  created_at: string | null;
  completed_at: string | null;
  route: GeoJSONLineString | null;
  responder_name: string | null;
  incident_reported_by: number | null;
}

export interface DashboardStats {
  active_incidents: number;
  critical_incidents: number;
  people_affected: number;
  responders_available: number;
  rescues_completed: number;
  shelters_available: number;
}

export interface SafeRoute {
  geometry: GeoJSONLineString;
  distance_m: number;
  duration_min: number;
  source: "osrm" | "straight_line";
}

export type AlertSource = "imd" | "sachet" | "simulator" | "admin";

export interface Alert {
  id: number;
  source: AlertSource;
  type: string;
  severity: SeverityLevel;
  message: string;
  issued_at: string;
  expires_at: string | null;
}

export interface RainfallForecast {
  latitude: number;
  longitude: number;
  probability: number; // % chance of precipitation, next 48h
  rain_24h_mm: number;
  rain_48h_mm: number;
  current_precipitation_mm: number;
  level: "low" | "moderate" | "high" | "critical";
  recommendation: string;
  trend: number[]; // daily totals (mm), next 7 days
  source: string;
}

export interface FloodForecast {
  latitude: number;
  longitude: number;
  flood_risk_score: number; // 0-100
  anomaly_ratio: number | null; // forecast peak discharge / recent normal; null if no river
  current_discharge_m3s: number;
  forecast_peak_m3s: number;
  baseline_discharge_m3s: number;
  level: "low" | "moderate" | "high" | "critical";
  recommendation: string;
  trend: number[]; // daily river discharge (m³/s), next ~10 days
  source: string;
}

export interface CycloneForecast {
  latitude: number;
  longitude: number;
  cyclone_risk_score: number; // 0-100
  peak_wind_kmh: number;
  peak_gust_kmh: number;
  min_pressure_hpa: number | null;
  level: "low" | "moderate" | "high" | "critical";
  recommendation: string;
  trend: number[]; // daily peak gusts (km/h), next 7 days
  source: string;
}

export interface LandslideForecast {
  latitude: number;
  longitude: number;
  landslide_risk_score: number; // 0-100
  slope_degrees: number;
  local_relief_m: number;
  elevation_m: number;
  antecedent_rain_mm: number;
  forecast_rain_mm: number;
  rain_trigger_mm: number;
  level: "low" | "moderate" | "high" | "critical";
  recommendation: string;
  trend: number[]; // daily precipitation (mm), forward
  source: string;
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

export interface NearbyShelter extends Shelter {
  distance_km: number;
}

export interface CheckIn {
  id: number;
  user_id: number;
  status: "safe" | "need_help";
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}
