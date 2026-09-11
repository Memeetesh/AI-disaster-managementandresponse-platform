"use client";

import { useEffect, useRef, useState } from "react";
import {
  Map as MapLibreMap,
  NavigationControl,
  Popup,
  GeoJSONSource,
  type MapLayerMouseEvent,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type {
  Incident,
  RescueOperation,
  Responder,
  RiskMapResponse,
  RiskZoneProperties,
  Shelter,
} from "@/types";

// Demo area: Chennai — a recurring urban-flooding case study in India.
// Matches the seeded risk-zone grid in backend/app/risk/demo_baseline.py.
const DEFAULT_CENTER: [number, number] = [80.2707, 13.0827];
const DEFAULT_ZOOM = 11;

// CARTO's free raster tiles: OSM data, permissive CORS, confirmed 200 from
// this environment. We use an inline style object (not a remote style URL)
// so there are no external font/sprite/glyph dependencies that can fail
// silently and leave the canvas white.
const PRIMARY_TILE_URL =
  "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

// Fallback CDN — different origin, so if CARTO is blocked the user still
// gets background imagery. Also confirmed reachable (404 on wrong tile
// coords means it's reachable, just no tile at that location).
const FALLBACK_TILE_URL =
  "https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png";

// How many consecutive tile errors trigger a CDN switch.
const TILE_ERROR_THRESHOLD = 4;

const RISK_COLORS: Record<string, string> = {
  low: "#16a34a",
  moderate: "#ca8a04",
  high: "#ea580c",
  very_high: "#dc2626",
  critical: "#7f1d1d",
};

const SEVERITY_COLORS: Record<string, string> = {
  low: "#16a34a",
  moderate: "#ca8a04",
  high: "#ea580c",
  very_high: "#dc2626",
  critical: "#b91c1c",
};

const EMPTY_FC = { type: "FeatureCollection" as const, features: [] };

// maplibre-gl v6 made WebGL2 mandatory. Feature-detect up front so a
// WebGL2-less browser gets an error message instead of a silent blank canvas.
function supportsWebGL2(): boolean {
  if (typeof document === "undefined") return true; // SSR: assume yes
  try {
    const canvas = document.createElement("canvas");
    return !!canvas.getContext("webgl2");
  } catch {
    return false;
  }
}

function buildInlineStyle(tileUrl: string) {
  return {
    version: 8 as const,
    sources: {
      osm: {
        type: "raster" as const,
        tiles: [tileUrl],
        tileSize: 256,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      },
    },
    layers: [{ id: "osm", type: "raster" as const, source: "osm" }],
  };
}

function incidentsToGeoJSON(incidents: Incident[]) {
  return {
    type: "FeatureCollection" as const,
    features: incidents
      .filter((i) => i.status !== "rejected")
      .map((i) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [i.longitude, i.latitude] },
        properties: { id: i.id, severity: i.severity, type: i.type, status: i.status },
      })),
  };
}

function sheltersToGeoJSON(shelters: Shelter[]) {
  return {
    type: "FeatureCollection" as const,
    features: shelters.map((s) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [s.longitude, s.latitude] },
      properties: { id: s.id, name: s.name, status: s.status },
    })),
  };
}

function respondersToGeoJSON(responders: Responder[]) {
  return {
    type: "FeatureCollection" as const,
    features: responders.map((r) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [r.longitude, r.latitude] },
      properties: { id: r.id, name: r.name, status: r.status, vehicle: r.vehicle ?? "" },
    })),
  };
}

const ACTIVE_RESCUE_STATUSES = new Set(["assigned", "en_route", "in_progress"]);

function routesToGeoJSON(rescueOps: RescueOperation[]) {
  return {
    type: "FeatureCollection" as const,
    features: rescueOps
      .filter((op) => op.route && ACTIVE_RESCUE_STATUSES.has(op.status))
      .map((op) => ({
        type: "Feature" as const,
        geometry: op.route as GeoJSON.LineString,
        properties: { id: op.id, status: op.status },
      })),
  };
}

interface RiskMapProps {
  className?: string;
  riskMap?: RiskMapResponse;
  incidents?: Incident[];
  shelters?: Shelter[]
  responders?: Responder[];
  rescueOps?: RescueOperation[];
  onZoneClick?: (properties: RiskZoneProperties) => void;
  /** Fires when an incident marker is clicked. */
  onIncidentClick?: (incidentId: number) => void;
  /** `[lng, lat]` to pan/zoom to (e.g. a new SOS). Changing it re-triggers the fly. */
  focus?: [number, number] | null;
}

export function RiskMap({
  className,
  riskMap,
  incidents,
  shelters,
  responders,
  rescueOps,
  onZoneClick,
  onIncidentClick,
  focus,
}: RiskMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [tileWarning, setTileWarning] = useState<string | null>(null);
  const tileErrorCount = useRef(0);
  const didSwitchFallback = useRef(false);

  const onZoneClickRef = useRef(onZoneClick);
  useEffect(() => { onZoneClickRef.current = onZoneClick; }, [onZoneClick]);
  const onIncidentClickRef = useRef(onIncidentClick);
  useEffect(() => { onIncidentClickRef.current = onIncidentClick; }, [onIncidentClick]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    if (!supportsWebGL2()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMapError(
        "This browser/device doesn't support WebGL2, which the map requires. Try a recent Chrome, Firefox, or Edge."
      );
      return;
    }

    const container = containerRef.current;

    const map = new MapLibreMap({
      container,
      style: buildInlineStyle(PRIMARY_TILE_URL),
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    });
    mapRef.current = map;
    map.addControl(new NavigationControl(), "top-right");

    // Resize whenever the container dimensions change (e.g. when the
    // auth-loading overlay clears and the dashboard fills in). Without this
    // MapLibre can initialise with a 0×0 canvas and stay blank forever.
    const ro = new ResizeObserver(() => {
      if (mapRef.current) mapRef.current.resize();
    });
    ro.observe(container);

    let hasLoaded = false;

    map.on("error", (e) => {
      const isTileError = !!(e as unknown as Record<string, unknown>).tile;

      if (!hasLoaded && !isTileError) {
        // Fatal pre-load error (WebGL context loss, bad style JSON, etc.)
        setMapError(e?.error?.message ?? "Map failed to load.");
        return;
      }

      if (isTileError) {
        tileErrorCount.current += 1;

        if (!didSwitchFallback.current && tileErrorCount.current >= TILE_ERROR_THRESHOLD) {
          // Primary CDN is flaky — switch tile source to the fallback.
          didSwitchFallback.current = true;
          try {
            const src = map.getSource("osm") as GeoJSONSource & { setTiles?: (t: string[]) => void };
            if (typeof src?.setTiles === "function") {
              src.setTiles([FALLBACK_TILE_URL]);
              tileErrorCount.current = 0; // reset so fallback errors don't re-trigger
            } else {
              setTileWarning("Map tiles unavailable (network). SOS overlays still work.");
            }
          } catch {
            setTileWarning("Map tiles unavailable (network). SOS overlays still work.");
          }
        } else if (didSwitchFallback.current && tileErrorCount.current >= TILE_ERROR_THRESHOLD) {
          // Both CDNs failed — show a soft warning, keep overlays visible.
          setTileWarning("Map background tiles unavailable — no internet. SOS pins and overlays still work.");
        }
      }
    });

    map.on("load", () => {
      hasLoaded = true;
      // Force a resize in case the container grew after the MapLibreMap
      // constructor ran (ResizeObserver may not fire synchronously on mount).
      map.resize();

      // ── GeoJSON data sources ─────────────────────────────────────────────
      map.addSource("risk-zones", { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: "risk-zones-fill",
        type: "fill",
        source: "risk-zones",
        paint: {
          "fill-color": [
            "match", ["get", "risk_category"],
            "low",       RISK_COLORS.low,
            "moderate",  RISK_COLORS.moderate,
            "high",      RISK_COLORS.high,
            "very_high", RISK_COLORS.very_high,
            "critical",  RISK_COLORS.critical,
            "#64748b",
          ],
          "fill-opacity": 0.35,
        },
      });
      map.addLayer({
        id: "risk-zones-outline",
        type: "line",
        source: "risk-zones",
        paint: { "line-color": "#0f172a", "line-width": 1 },
      });

      map.addSource("shelters", { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: "shelters-points",
        type: "circle",
        source: "shelters",
        paint: {
          "circle-radius": 7,
          "circle-color": "#0ea5e9",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.addSource("incidents", { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: "incidents-points",
        type: "circle",
        source: "incidents",
        paint: {
          "circle-radius": 8,
          "circle-color": [
            "match", ["get", "severity"],
            "low",       SEVERITY_COLORS.low,
            "moderate",  SEVERITY_COLORS.moderate,
            "high",      SEVERITY_COLORS.high,
            "very_high", SEVERITY_COLORS.very_high,
            "critical",  SEVERITY_COLORS.critical,
            "#334155",
          ],
          "circle-stroke-width": 2.5,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.addSource("rescue-routes", { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: "rescue-routes-line",
        type: "line",
        source: "rescue-routes",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#f59e0b",
          "line-width": 3,
          "line-dasharray": [2, 1.5],
          "line-opacity": 0.9,
        },
      });

      map.addSource("responders", { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: "responders-points",
        type: "circle",
        source: "responders",
        paint: {
          "circle-radius": 6,
          "circle-color": [
            "match", ["get", "status"],
            "available", "#22c55e",
            "en_route",  "#f59e0b",
            "busy",      "#ef4444",
            "offline",   "#94a3b8",
            "#94a3b8",
          ],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#0f172a",
        },
      });

      // ── Popups & click handlers ──────────────────────────────────────────
      const pointPopup = (
        layer: string,
        html: (props: Record<string, unknown>) => string
      ) => {
        map.on("click", layer, (e: MapLayerMouseEvent) => {
          const f = e.features?.[0];
          if (!f) return;
          new Popup({ closeButton: true })
            .setLngLat(e.lngLat)
            .setHTML(`<div style="font:12px system-ui;color:#0f172a;line-height:1.5">${html(f.properties as Record<string, unknown>)}</div>`)
            .addTo(map);
        });
        map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
      };

      pointPopup("incidents-points", (p) =>
        `<strong>Incident #${p.id}</strong><br/>${p.type} · ${p.severity}<br/>status: ${p.status}`
      );
      map.on("click", "incidents-points", (e: MapLayerMouseEvent) => {
        const id = e.features?.[0]?.properties?.id;
        if (typeof id === "number") onIncidentClickRef.current?.(id);
      });
      pointPopup("shelters-points", (p) =>
        `<strong>${p.name}</strong><br/>status: ${p.status}`
      );
      pointPopup("responders-points", (p) =>
        `<strong>${p.name}</strong><br/>${p.vehicle || "team"} · ${p.status}`
      );

      map.on("click", "risk-zones-fill", (e: MapLayerMouseEvent) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const props = feature.properties as unknown as RiskZoneProperties;
        onZoneClickRef.current?.(props);
        const category = String(props.risk_category).replace("_", " ").toUpperCase();
        new Popup({ closeButton: true })
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font:12px system-ui;color:#0f172a;line-height:1.5">` +
            `<strong>Risk ${props.risk_score} — ${category}</strong><br/>` +
            `Hazard: ${props.hazard_score}<br/>` +
            `Population exposure: ${props.population_exposure}<br/>` +
            `Infrastructure vulnerability: ${props.infrastructure_vulnerability}<br/>` +
            `Accessibility: ${props.accessibility_score}<br/>` +
            `Historical risk: ${props.historical_risk_score}<br/>` +
            `Nearby incidents: ${props.nearby_incident_count}` +
            `</div>`
          )
          .addTo(map);
      });
      map.on("mouseenter", "risk-zones-fill", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "risk-zones-fill", () => { map.getCanvas().style.cursor = ""; });

      setLoaded(true);
    });

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      setLoaded(false);
    };
  }, []);

  // ── Live data updates ────────────────────────────────────────────────────

  useEffect(() => {
    if (!loaded || !mapRef.current) return;
    (mapRef.current.getSource("risk-zones") as GeoJSONSource | undefined)?.setData(riskMap ?? EMPTY_FC);
  }, [loaded, riskMap]);

  useEffect(() => {
    if (!loaded || !mapRef.current) return;
    (mapRef.current.getSource("incidents") as GeoJSONSource | undefined)
      ?.setData(incidents ? incidentsToGeoJSON(incidents) : EMPTY_FC);
  }, [loaded, incidents]);

  useEffect(() => {
    if (!loaded || !mapRef.current) return;
    (mapRef.current.getSource("shelters") as GeoJSONSource | undefined)
      ?.setData(shelters ? sheltersToGeoJSON(shelters) : EMPTY_FC);
  }, [loaded, shelters]);

  useEffect(() => {
    if (!loaded || !mapRef.current) return;
    (mapRef.current.getSource("responders") as GeoJSONSource | undefined)
      ?.setData(responders ? respondersToGeoJSON(responders) : EMPTY_FC);
  }, [loaded, responders]);

  useEffect(() => {
    if (!loaded || !mapRef.current) return;
    (mapRef.current.getSource("rescue-routes") as GeoJSONSource | undefined)
      ?.setData(rescueOps ? routesToGeoJSON(rescueOps) : EMPTY_FC);
  }, [loaded, rescueOps]);

  useEffect(() => {
    if (!loaded || !mapRef.current || !focus) return;
    mapRef.current.flyTo({ center: focus, zoom: Math.max(mapRef.current.getZoom(), 14), speed: 1.4 });
  }, [loaded, focus]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={`relative ${className ?? "h-full w-full"}`}>
      <div ref={containerRef} className="h-full w-full" />

      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950 p-6 text-center z-10">
          <div className="max-w-sm">
            <p className="text-sm font-semibold text-slate-300 mb-1">Map failed to load</p>
            <p className="text-xs text-slate-500">{mapError}</p>
          </div>
        </div>
      )}

      {tileWarning && !mapError && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 max-w-xs w-[calc(100%-1rem)] pointer-events-none">
          <div className="flex items-start gap-2 rounded-xl bg-warn-900/90 backdrop-blur-sm border border-warn-700/60 px-3 py-2 shadow-lg">
            <span className="mt-0.5 text-warn-400 text-sm flex-shrink-0">⚠</span>
            <p className="text-[11px] leading-snug text-warn-200">{tileWarning}</p>
          </div>
        </div>
      )}
    </div>
  );
}
