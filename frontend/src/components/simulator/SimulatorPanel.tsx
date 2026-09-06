"use client";

import { useEffect, useState } from "react";
import {
  getSimulatorState,
  spawnSimulatedIncidents,
  startSimulator,
  stopSimulator,
} from "@/lib/simulator-api";
import { apiFetch } from "@/lib/api";
import type { SimulatorState } from "@/types";
import { Badge } from "@/components/ui/Badge";

function patchSimulatorState(
  token: string,
  update: { rainfall_mm?: number; water_level_m?: number; road_blockage_pct?: number }
): Promise<SimulatorState> {
  return apiFetch<SimulatorState>("/simulator/state", { method: "PATCH", body: JSON.stringify(update) }, token);
}

interface SimulatorPanelProps {
  token: string;
  isAdmin: boolean;
  onChanged: () => void;
}

export function SimulatorPanel({ token, isAdmin, onChanged }: SimulatorPanelProps) {
  const [state, setState] = useState<SimulatorState | null>(null);
  const [rainfall, setRainfall] = useState(220);
  const [waterLevel, setWaterLevel] = useState(3.5);
  const [blockage, setBlockage] = useState(40);
  const [spawnCount, setSpawnCount] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSimulatorState(token)
      .then((s) => {
        setState(s);
        setRainfall(s.rainfall_mm || 220);
        setWaterLevel(s.water_level_m || 3.5);
        setBlockage(s.road_blockage_pct || 40);
      })
      .catch(() => setError("Could not load simulator state."));
  }, [token]);

  async function runAction(action: () => Promise<SimulatorState>) {
    setBusy(true);
    setError(null);
    try {
      const next = await action();
      setState(next);
      onChanged();
    } catch {
      setError("Simulator action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleStart() {
    await runAction(() =>
      startSimulator(token, { rainfall_mm: rainfall, water_level_m: waterLevel, road_blockage_pct: blockage })
    );
  }

  async function handleStop() {
    await runAction(() => stopSimulator(token));
    setRainfall(0);
    setWaterLevel(0);
    setBlockage(0);
  }

  async function commitSlider(field: "rainfall_mm" | "water_level_m" | "road_blockage_pct") {
    const values = { rainfall_mm: rainfall, water_level_m: waterLevel, road_blockage_pct: blockage };
    await runAction(() => patchSimulatorState(token, { [field]: values[field] }));
  }

  async function handleSpawn() {
    setBusy(true);
    setError(null);
    try {
      await spawnSimulatedIncidents(token, { count: spawnCount, max_people_affected: 5 });
      onChanged();
    } catch {
      setError("Could not spawn incidents.");
    } finally {
      setBusy(false);
    }
  }

  if (!isAdmin) {
    return (
      <div className="border-t border-slate-800 px-4 py-3 text-xs text-slate-500">
        Disaster simulator: {state?.active ? <span className="text-red-400">ACTIVE</span> : "inactive"}{" "}
        (admin-controlled)
      </div>
    );
  }

  return (
    <div className="border-t border-slate-800 px-4 py-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Disaster Simulator</h2>
        <Badge tone={state?.active ? "critical" : "neutral"}>{state?.active ? "ACTIVE" : "inactive"}</Badge>
      </div>

      <div className="space-y-3 text-xs">
        <label className="block">
          <div className="mb-1 flex justify-between text-slate-400">
            <span>Rainfall</span>
            <span className="font-mono">{rainfall} mm</span>
          </div>
          <input
            type="range"
            min={0}
            max={300}
            value={rainfall}
            onChange={(e) => setRainfall(Number(e.target.value))}
            onMouseUp={() => void commitSlider("rainfall_mm")}
            onTouchEnd={() => void commitSlider("rainfall_mm")}
            className="w-full"
          />
        </label>

        <label className="block">
          <div className="mb-1 flex justify-between text-slate-400">
            <span>Water level</span>
            <span className="font-mono">{waterLevel.toFixed(1)} m</span>
          </div>
          <input
            type="range"
            min={0}
            max={5}
            step={0.1}
            value={waterLevel}
            onChange={(e) => setWaterLevel(Number(e.target.value))}
            onMouseUp={() => void commitSlider("water_level_m")}
            onTouchEnd={() => void commitSlider("water_level_m")}
            className="w-full"
          />
        </label>

        <label className="block">
          <div className="mb-1 flex justify-between text-slate-400">
            <span>Road blockage</span>
            <span className="font-mono">{blockage}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={blockage}
            onChange={(e) => setBlockage(Number(e.target.value))}
            onMouseUp={() => void commitSlider("road_blockage_pct")}
            onTouchEnd={() => void commitSlider("road_blockage_pct")}
            className="w-full"
          />
        </label>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={handleStart}
          disabled={busy}
          className="flex-1 rounded bg-red-700 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-red-600 disabled:opacity-50"
        >
          Start Disaster
        </button>
        <button
          onClick={handleStop}
          disabled={busy}
          className="rounded border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-slate-500 disabled:opacity-50"
        >
          Stop / Reset
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          type="number"
          min={1}
          max={20}
          value={spawnCount}
          onChange={(e) => setSpawnCount(Number(e.target.value))}
          className="w-16 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
        />
        <button
          onClick={handleSpawn}
          disabled={busy}
          className="flex-1 rounded bg-slate-800 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50"
        >
          Spawn SOS reports
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      <p className="mt-2 text-[10px] text-slate-500">
        Rainfall/water level raise flood hazard; road blockage raises inaccessibility — both feed the
        risk-map formula directly (app/services/risk_zones.py). Not real weather data.
      </p>
    </div>
  );
}
