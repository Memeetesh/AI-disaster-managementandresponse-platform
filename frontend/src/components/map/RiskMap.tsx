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
import type { Incident, RiskMapResponse, RiskZoneProperties, Shelter } from "@/types";

// Demo area: Chennai — a recurring urban-flooding case study in India.
// Matches the seeded risk-zone grid in backend/app/risk/demo_baseline.py.
const DEFAULT_CENTER: [number, number] = [80.2707, 13.0827];
const DEFAULT_ZOOM = 11;

const TILE_URL =
  process.env.NEXT_PUBLIC_MAP_TILE_URL ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

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

interface RiskMapProps {
  className?: string;
  riskMap?: RiskMapResponse;
  incidents?: Incident[];
  shelters?: Shelter[];
  onZoneClick?: (properties: RiskZoneProperties) => void;
}

export function RiskMap({ className, riskMap, incidents, shelters, onZoneClick }: RiskMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [loaded, setLoaded] = useState(false);
  const onZoneClickRef = useRef(onZoneClick);
  useEffect(() => {
    onZoneClickRef.current = onZoneClick;
  }, [onZoneClick]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: [TILE_URL],
            tileSize: 256,
            attribution: "&copy; OpenStreetMap contributors",
          },
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    });
    mapRef.current = map;
    map.addControl(new NavigationControl(), "top-right");

    map.on("load", () => {
      map.addSource("risk-zones", { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: "risk-zones-fill",
        type: "fill",
        source: "risk-zones",
        paint: {
          "fill-color": [
            "match",
            ["get", "risk_category"],
            "low",
            RISK_COLORS.low,
            "moderate",
            RISK_COLORS.moderate,
            "high",
            RISK_COLORS.high,
            "very_high",
            RISK_COLORS.very_high,
            "critical",
            RISK_COLORS.critical,
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
          "circle-radius": 6,
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
          "circle-radius": 7,
          "circle-color": [
            "match",
            ["get", "severity"],
            "low",
            SEVERITY_COLORS.low,
            "moderate",
            SEVERITY_COLORS.moderate,
            "high",
            SEVERITY_COLORS.high,
            "very_high",
            SEVERITY_COLORS.very_high,
            "critical",
            SEVERITY_COLORS.critical,
            "#334155",
          ],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

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
      map.on("mouseenter", "risk-zones-fill", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "risk-zones-fill", () => {
        map.getCanvas().style.cursor = "";
      });

      setLoaded(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      setLoaded(false);
    };
  }, []);

  useEffect(() => {
    if (!loaded || !mapRef.current) return;
    const source = mapRef.current.getSource("risk-zones") as GeoJSONSource | undefined;
    source?.setData(riskMap ?? EMPTY_FC);
  }, [loaded, riskMap]);

  useEffect(() => {
    if (!loaded || !mapRef.current) return;
    const source = mapRef.current.getSource("incidents") as GeoJSONSource | undefined;
    source?.setData(incidents ? incidentsToGeoJSON(incidents) : EMPTY_FC);
  }, [loaded, incidents]);

  useEffect(() => {
    if (!loaded || !mapRef.current) return;
    const source = mapRef.current.getSource("shelters") as GeoJSONSource | undefined;
    source?.setData(shelters ? sheltersToGeoJSON(shelters) : EMPTY_FC);
  }, [loaded, shelters]);

  return <div ref={containerRef} className={className ?? "h-full w-full"} />;
}
