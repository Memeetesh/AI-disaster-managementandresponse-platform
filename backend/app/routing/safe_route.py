"""OSRM-backed route with a straight-line fallback."""
from __future__ import annotations

import logging
import math
from dataclasses import dataclass

import httpx

from app.config import settings

logger = logging.getLogger("aasha_setu.routing")

_AVG_SPEED_KMH = 28.0  # rough urban-flood response speed for the fallback ETA
_OSRM_TIMEOUT_S = 2.0


@dataclass(frozen=True)
class SafeRoute:
    geometry: dict  # GeoJSON LineString, [lon, lat] pairs
    distance_m: float
    duration_min: float
    source: str  # "osrm" | "straight_line"

    def to_wkt(self) -> str:
        pts = ", ".join(f"{lon} {lat}" for lon, lat in self.geometry["coordinates"])
        return f"LINESTRING({pts})"


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6_371_000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _straight_line(from_lat: float, from_lon: float, to_lat: float, to_lon: float) -> SafeRoute:
    dist = _haversine_m(from_lat, from_lon, to_lat, to_lon)
    duration_min = (dist / 1000.0) / _AVG_SPEED_KMH * 60.0
    return SafeRoute(
        geometry={"type": "LineString", "coordinates": [[from_lon, from_lat], [to_lon, to_lat]]},
        distance_m=round(dist, 1),
        duration_min=round(duration_min, 1),
        source="straight_line",
    )


def safe_route(from_lat: float, from_lon: float, to_lat: float, to_lon: float) -> SafeRoute:
    url = (
        f"{settings.OSRM_URL.rstrip('/')}/route/v1/driving/"
        f"{from_lon},{from_lat};{to_lon},{to_lat}"
    )
    try:
        resp = httpx.get(
            url,
            params={"overview": "full", "geometries": "geojson"},
            timeout=_OSRM_TIMEOUT_S,
        )
        resp.raise_for_status()
        route = resp.json()["routes"][0]
        return SafeRoute(
            geometry=route["geometry"],
            distance_m=round(float(route["distance"]), 1),
            duration_min=round(float(route["duration"]) / 60.0, 1),
            source="osrm",
        )
    except Exception as exc:  # noqa: BLE001 - any failure → fallback, never raise
        logger.info("OSRM unavailable (%s); using straight-line route", exc.__class__.__name__)
        return _straight_line(from_lat, from_lon, to_lat, to_lon)
