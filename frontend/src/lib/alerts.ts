import type { Alert, SeverityLevel } from "@/types";

export const SEVERITY_RANK: Record<SeverityLevel, number> = {
  low: 0,
  moderate: 1,
  high: 2,
  very_high: 3,
  critical: 4,
};

/** Most-severe active alert, tie-broken by most recent. */
export function topAlert(alerts: Alert[]): Alert | null {
  if (alerts.length === 0) return null;
  return [...alerts].sort(
    (a, b) =>
      SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
      new Date(b.issued_at).getTime() - new Date(a.issued_at).getTime()
  )[0];
}

export function alertSourceLabel(source: Alert["source"]): string {
  switch (source) {
    case "imd":
      return "IMD";
    case "sachet":
      return "SACHET";
    case "simulator":
      return "Disaster Simulator";
    case "admin":
      return "Command Center";
    default:
      return "Alert";
  }
}

export function alertRelativeTime(iso: string): string {
  const secs = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}
