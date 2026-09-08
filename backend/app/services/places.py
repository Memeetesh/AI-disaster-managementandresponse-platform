"""Nearby points of interest (hospitals, shelters, ...) from OpenStreetMap
via the public Overpass API. Free, no key.

Overpass is rate-limited and occasionally down, so results are cached for an
hour per rounded coordinate, mirrors are tried in turn, and any total
failure returns an empty list — the caller falls back (e.g. to the app's
own operator-managed shelters).
"""
from __future__ import annotations

import logging
import math
import time

import httpx

logger = logging.getLogger("drishti.places")

_OVERPASS_MIRRORS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
)
# Overpass's frontend 406s some of httpx's default headers (Accept-Encoding
# with br/zstd); send conservative ones + a meaningful UA per OSM policy.
_HEADERS = {
    "User-Agent": "DRISHTI/1.0 (disaster-response demo; +https://github.com/Memeetesh)",
    "Accept": "application/json",
    "Accept-Encoding": "gzip",
}
_TIMEOUT_S = 30.0
_CACHE_TTL_S = 3600
_cache: dict[tuple, tuple[float, list[dict]]] = {}

# kind -> Overpass tag filters (each applied to node/way/relation)
_KIND_FILTERS: dict[str, tuple[str, ...]] = {
    "hospital": ('[amenity=hospital]', '[amenity=clinic]', '[healthcare=hospital]'),
    "shelter": (
        '[amenity=shelter]',
        '[emergency=assembly_point]',
        '[social_facility=shelter]',
    ),
    "police": ('[amenity=police]',),
    "fire_station": ('[amenity=fire_station]',),
    "pharmacy": ('[amenity=pharmacy]',),
}


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _build_query(lat: float, lon: float, kind: str, radius_m: int) -> str:
    parts = "".join(
        f"nwr{f}(around:{radius_m},{lat},{lon});" for f in _KIND_FILTERS[kind]
    )
    return f"[out:json][timeout:25];({parts});out center tags 40;"


def _parse(elements: list[dict], lat: float, lon: float, kind: str, limit: int) -> list[dict]:
    out: list[dict] = []
    for el in elements:
        plat = el.get("lat") or (el.get("center") or {}).get("lat")
        plon = el.get("lon") or (el.get("center") or {}).get("lon")
        if plat is None or plon is None:
            continue
        tags = el.get("tags", {}) or {}
        name = tags.get("name") or tags.get("official_name") or tags.get("operator")
        if not name:
            continue
        addr = ", ".join(
            v
            for v in (
                tags.get("addr:street"),
                tags.get("addr:suburb") or tags.get("addr:city"),
            )
            if v
        )
        out.append(
            {
                "name": name,
                "kind": kind,
                "latitude": float(plat),
                "longitude": float(plon),
                "distance_km": round(_haversine_km(lat, lon, float(plat), float(plon)), 2),
                "phone": tags.get("phone") or tags.get("contact:phone") or tags.get("emergency:phone"),
                "address": addr or None,
            }
        )
    out.sort(key=lambda p: p["distance_km"])
    # de-dupe near-identical entries (same name within 150 m)
    deduped: list[dict] = []
    for p in out:
        if any(
            p["name"] == q["name"] and _haversine_km(p["latitude"], p["longitude"], q["latitude"], q["longitude"]) < 0.15
            for q in deduped
        ):
            continue
        deduped.append(p)
    return deduped[:limit]


def nearby_places(
    lat: float, lon: float, kind: str, *, radius_km: float = 8.0, limit: int = 8
) -> list[dict]:
    if kind not in _KIND_FILTERS:
        raise ValueError(f"unknown place kind: {kind}")
    radius_m = int(max(0.5, min(radius_km, 40.0)) * 1000)
    key = (round(lat, 3), round(lon, 3), kind, radius_m)
    now = time.monotonic()
    hit = _cache.get(key)
    if hit is not None and now - hit[0] < _CACHE_TTL_S:
        return hit[1][:limit]

    query = _build_query(lat, lon, kind, radius_m)
    for url in _OVERPASS_MIRRORS:
        try:
            resp = httpx.post(
                url, data={"data": query}, headers=_HEADERS, timeout=_TIMEOUT_S
            )
            resp.raise_for_status()
            elements = resp.json().get("elements", [])
            result = _parse(elements, lat, lon, kind, max(limit, 20))
            _cache[key] = (now, result)
            return result[:limit]
        except Exception as exc:  # noqa: BLE001 - try the next mirror
            logger.info("overpass mirror %s failed (%s)", url, exc.__class__.__name__)
            continue
    logger.warning("all overpass mirrors failed for kind=%s", kind)
    return []
