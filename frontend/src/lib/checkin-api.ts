import { apiFetch } from "@/lib/api";
import type { CheckIn } from "@/types";

export interface CheckInInput {
  status?: "safe" | "need_help";
  latitude?: number | null;
  longitude?: number | null;
}

export function createCheckIn(input: CheckInInput, token: string): Promise<CheckIn> {
  return apiFetch<CheckIn>(
    "/check-in",
    { method: "POST", body: JSON.stringify({ status: "safe", ...input }) },
    token
  );
}

export function getMyCheckIn(token: string): Promise<CheckIn | null> {
  return apiFetch<CheckIn | null>("/check-in/me", {}, token);
}
