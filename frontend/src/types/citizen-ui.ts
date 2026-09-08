// Ported from the teammate's "Aasha Setu" UI prototype (bolt.new export).
// These back the citizen-app pages that are still mock UI (family, lost &
// found, authority messages, emotional support) — see src/data/citizen-mock.ts
// for a note on which of these have no backend yet.

export type CitizenRiskLevel = "low" | "moderate" | "high" | "critical";

export interface RiskCard {
  id: string;
  icon: string;
  title: string;
  level: CitizenRiskLevel;
  probability: number;
  recommendation: string;
  trend: number[];
}

export interface FamilyMember {
  id: string;
  name: string;
  role: string;
  status: "safe" | "warning" | "danger";
  statusLabel: string;
  lastUpdated: string;
  location: string;
  contact: string;
  avatarColor: string;
  initials: string;
  /** Dummy profile picture served from /public/avatars (demo data only). */
  photoUrl: string;
}

export interface AuthorityMessage {
  id: string;
  source: string;
  sourceType: "government" | "ngo" | "local";
  title: string;
  body: string;
  time: string;
  priority: "info" | "warning" | "critical";
  verified: boolean;
}

export interface LostFoundItem {
  id: string;
  type: "missing-person" | "found-person" | "belonging";
  name: string;
  description: string;
  location: string;
  status: "active" | "resolved";
  date: string;
  contact: string;
}

export interface QuickAction {
  id: string;
  icon: string;
  label: string;
  detail: string;
  color: string;
}
