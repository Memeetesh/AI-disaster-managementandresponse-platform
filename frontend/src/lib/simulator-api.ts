import { apiFetch } from "@/lib/api";
import type { Incident, SimulatorState } from "@/types";

export function getSimulatorState(token: string): Promise<SimulatorState> {
  return apiFetch<SimulatorState>("/simulator/state", {}, token);
}

export function startSimulator(
  token: string,
  input: { rainfall_mm: number; water_level_m: number; road_blockage_pct: number }
): Promise<SimulatorState> {
  return apiFetch<SimulatorState>(
    "/simulator/start",
    { method: "POST", body: JSON.stringify(input) },
    token
  );
}

export function stopSimulator(token: string): Promise<SimulatorState> {
  return apiFetch<SimulatorState>("/simulator/stop", { method: "POST" }, token);
}

export function spawnSimulatedIncidents(
  token: string,
  input: { count: number; max_people_affected: number }
): Promise<Incident[]> {
  return apiFetch<Incident[]>(
    "/simulator/spawn-incidents",
    { method: "POST", body: JSON.stringify(input) },
    token
  );
}
