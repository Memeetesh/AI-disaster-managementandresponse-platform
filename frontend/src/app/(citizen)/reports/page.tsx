"use client";

import Link from "next/link";
import { Icon } from "@/components/citizen/Icon";
import { useMyReports } from "@/lib/queries";
import type { IncidentStatus, SeverityLevel } from "@/types";

const MEDIA_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1").replace(
  /\/api\/v1\/?$/,
  ""
);

const SEVERITY_BADGE: Record<SeverityLevel, string> = {
  low: "bg-safe-100 text-safe-700",
  moderate: "bg-warn-100 text-warn-700",
  high: "bg-danger-100 text-danger-700",
  very_high: "bg-danger-600 text-white",
  critical: "bg-danger-600 text-white",
};

const STATUS_BADGE: Record<IncidentStatus, string> = {
  reported: "bg-warn-100 text-warn-700",
  ai_verified: "bg-warn-100 text-warn-700",
  human_review: "bg-warn-100 text-warn-700",
  verified: "bg-safe-100 text-safe-700",
  rejected: "bg-slate2-100 text-slate2-500",
  in_progress: "bg-navy-100 text-navy-700",
  resolved: "bg-safe-100 text-safe-700",
};

const STATUS_LABEL: Record<IncidentStatus, string> = {
  reported: "Reported",
  ai_verified: "Under review",
  human_review: "Under review",
  verified: "Verified by responder",
  rejected: "Not verified",
  in_progress: "Response in progress",
  resolved: "Resolved",
};

export default function MyReportsPage() {
  const { data: reports = [], isLoading, isError } = useMyReports();

  return (
    <div className="mx-auto max-w-2xl animate-fade-in">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-xl bg-navy-100 flex items-center justify-center">
          <Icon name="FileText" className="w-5 h-5 text-navy-600" />
        </div>
        <h1 className="text-xl font-bold text-navy-900">My Reports</h1>
      </div>
      <p className="text-sm text-slate2-500">
        Everything you&apos;ve reported through SOS or the incident form. Status updates live as
        responders review each one.
      </p>

      <div className="mt-6 space-y-3">
        {isLoading ? (
          <div className="card p-6 text-sm text-slate2-500">Loading your reports…</div>
        ) : isError ? (
          <div className="card p-6 text-sm text-danger-600">
            Could not load your reports. Check your connection and try again.
          </div>
        ) : reports.length === 0 ? (
          <div className="card p-8 text-center">
            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate2-100 text-slate2-400">
              <Icon name="FileText" className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-navy-900">No reports yet</p>
            <p className="mt-1 text-xs text-slate2-500">
              Use{" "}
              <Link href="/report" className="font-semibold text-navy-600 underline">
                Report an Incident
              </Link>{" "}
              or the{" "}
              <Link href="/emergency" className="font-semibold text-danger-600 underline">
                Emergency SOS
              </Link>{" "}
              button.
            </p>
          </div>
        ) : (
          reports.map((incident) => (
            <div key={incident.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-navy-900">
                    #{incident.id} · <span className="capitalize">{incident.type}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate2-500">
                    {new Date(incident.created_at).toLocaleString()} ·{" "}
                    {incident.people_affected} affected
                  </p>
                </div>
                <div className="flex flex-shrink-0 flex-col items-end gap-1">
                  <span className={`badge ${SEVERITY_BADGE[incident.severity]}`}>
                    {incident.severity.replace("_", " ")}
                  </span>
                  <span className={`badge ${STATUS_BADGE[incident.status]}`}>
                    {STATUS_LABEL[incident.status]}
                  </span>
                </div>
              </div>

              {incident.description && (
                <p className="mt-2 text-sm text-slate2-700">{incident.description}</p>
              )}

              {incident.evidence.some((e) => e.image_url) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {incident.evidence
                    .filter((e) => e.image_url)
                    .map((e) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={e.id}
                        src={`${MEDIA_BASE}${e.image_url}`}
                        alt={`Evidence for incident ${incident.id}`}
                        className="h-16 w-16 rounded-lg object-cover ring-1 ring-slate2-200"
                      />
                    ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
