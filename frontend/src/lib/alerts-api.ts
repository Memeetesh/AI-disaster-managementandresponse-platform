import { apiFetch } from "@/lib/api";
import type { Alert, SeverityLevel } from "@/types";

export function listAlerts(token: string): Promise<Alert[]> {
  return apiFetch<Alert[]>("/alerts", {}, token);
}

export interface CreateAlertInput {
  type: string;
  severity: SeverityLevel;
  message: string;
  expires_in_hours?: number;
}

export function createAlert(input: CreateAlertInput, token: string): Promise<Alert> {
  return apiFetch<Alert>(
    "/alerts",
    { method: "POST", body: JSON.stringify(input) },
    token
  );
}
