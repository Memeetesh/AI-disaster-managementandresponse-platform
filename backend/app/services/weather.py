"""Rainfall forecast from Open-Meteo — free, no API key.

Location-agnostic: the caller passes the citizen's coordinates. Results are
cached per rounded coordinate for 15 minutes (forecasts don't refresh
faster, and Open-Meteo asks clients to cache). Any failure raises; the
route turns that into a 502 and the frontend falls back to demo data.
"""
from __future__ import annotations

import logging
import math
import time

import httpx

logger = logging.getLogger("aasha_setu.weather")

_OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
_OPEN_METEO_FLOOD_URL = "https://flood-api.open-meteo.com/v1/flood"
_OPEN_METEO_ELEVATION_URL = "https://api.open-meteo.com/v1/elevation"
# Generous on purpose: on a free-tier host the outbound TLS handshake to
# Open-Meteo (a different host from ours, sometimes a cold connection pool)
# regularly needs >4s. Too tight here means the route 502s and the card
# silently falls back to demo data.
_TIMEOUT_S = 12.0
# Long on purpose. A forecast doesn't meaningfully change in a few hours,
# and once we have a *real* value we want to keep showing it — a fresh miss
# should never drop the card back to demo data mid-demo.
_CACHE_TTL_S = 6 * 3600  # 6 hours
_cache: dict[tuple[float, float], tuple[float, dict]] = {}
_flood_cache: dict[tuple[float, float], tuple[float, dict]] = {}
_cyclone_cache: dict[tuple[float, float], tuple[float, dict]] = {}
_landslide_cache: dict[tuple[float, float], tuple[float, dict]] = {}


def _serve(
    cache: dict[tuple[float, float], tuple[float, dict]],
    key: tuple[float, float],
    fetch,
    label: str,
) -> dict:
    """Cache read-through with stale-on-error: a fresh hit is returned as-is;
    otherwise we try `fetch()`, and if that fails we fall back to any cached
    value (however old) before giving up. Real-but-stale always beats the
    frontend's demo card."""
    now = time.monotonic()
    hit = cache.get(key)
    if hit is not None and now - hit[0] < _CACHE_TTL_S:
        return hit[1]
    try:
        data = fetch()
    except Exception as exc:  # noqa: BLE001 - upstream (Open-Meteo) failure
        if hit is not None:
            logger.warning(
                "%s fetch failed (%s); serving cached value from %.0fs ago",
                label, exc, now - hit[0],
            )
            return hit[1]
        raise
    cache[key] = (now, data)
    return data


def _classify(rain_mm: float) -> str:
    """IMD-style 24h rainfall bands → the citizen UI's 4-band scale."""
    if rain_mm < 7.5:
        return "low"
    if rain_mm < 35.5:
        return "moderate"
    if rain_mm < 115.5:
        return "high"
    return "critical"


_RECOMMENDATION = {
    "low": "Light or no rain expected. No action needed.",
    "moderate": "Moderate rain likely. Carry rain protection.",
    "high": "Heavy rain likely. Avoid low-lying areas and waterlogged roads.",
    "critical": (
        "Very heavy rain expected. Flooding risk — stay indoors and keep an "
        "emergency kit ready."
    ),
}


def _fetch(lat: float, lon: float) -> dict:
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": "precipitation,rain,weather_code",
        "daily": "precipitation_sum,precipitation_probability_max",
        "forecast_days": 7,
        "timezone": "auto",
    }
    resp = httpx.get(_OPEN_METEO_URL, params=params, timeout=_TIMEOUT_S)
    resp.raise_for_status()
    data = resp.json()

    daily = data.get("daily", {}) or {}
    sums = [float(x or 0.0) for x in (daily.get("precipitation_sum") or [])][:7]
    probs = [int(x or 0) for x in (daily.get("precipitation_probability_max") or [])][:7]
    current = data.get("current", {}) or {}

    today_mm = sums[0] if sums else 0.0
    tomorrow_mm = sums[1] if len(sums) > 1 else 0.0
    peak_mm = max([today_mm, tomorrow_mm], default=0.0)
    probability = max(probs[:2], default=0)

    level = _classify(peak_mm)
    return {
        "latitude": lat,
        "longitude": lon,
        "probability": probability,  # % chance of precipitation, next 48h
        "rain_24h_mm": round(today_mm, 1),
        "rain_48h_mm": round(today_mm + tomorrow_mm, 1),
        "current_precipitation_mm": round(float(current.get("precipitation") or 0.0), 2),
        "level": level,
        "recommendation": _RECOMMENDATION[level],
        "trend": [round(x, 1) for x in sums],  # daily totals (mm), 7 days
        "source": "open-meteo",
    }


def get_rainfall_forecast(lat: float, lon: float) -> dict:
    return _serve(_cache, (round(lat, 2), round(lon, 2)), lambda: _fetch(lat, lon), "rainfall")


# --- Flood forecast (GloFAS river discharge via Open-Meteo Flood API) --------

_PAST_DAYS = 92
_FORECAST_DAYS = 30
_NEGLIGIBLE_DISCHARGE = 0.1  # m³/s — below this the point has no modelled river


def _median(values: list[float]) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    mid = len(s) // 2
    return s[mid] if len(s) % 2 else (s[mid - 1] + s[mid]) / 2


_FLOOD_RECOMMENDATION = {
    "low": "River levels near normal. No flood action needed.",
    "moderate": "River flow rising above normal. Stay alert and avoid river banks.",
    "high": "Significant flood risk — river flow well above normal. Move valuables up and be ready to evacuate.",
    "critical": (
        "Severe flood risk — river flow far above normal. Move to higher ground now and follow "
        "official instructions."
    ),
}


def _classify_flood(ratio: float | None) -> str:
    if ratio is None or ratio < 1.1:
        return "low"
    if ratio < 1.7:
        return "moderate"
    if ratio < 2.8:
        return "high"
    return "critical"


def _flood_score(ratio: float | None) -> int:
    """0–100 for the citizen card headline. ratio 1.0→15, 2.0→55, 3.0→95."""
    if ratio is None:
        return 5
    return int(max(0.0, min(100.0, (ratio - 1.0) * 40.0 + 15.0)))


def _fetch_flood(lat: float, lon: float) -> dict:
    params = {
        "latitude": lat,
        "longitude": lon,
        "daily": "river_discharge",
        "past_days": _PAST_DAYS,
        "forecast_days": _FORECAST_DAYS,
    }
    resp = httpx.get(_OPEN_METEO_FLOOD_URL, params=params, timeout=_TIMEOUT_S)
    resp.raise_for_status()
    daily = resp.json().get("daily", {}) or {}
    series = [float(x) if x is not None else 0.0 for x in (daily.get("river_discharge") or [])]

    n_past = min(_PAST_DAYS, len(series))
    past = series[:n_past]
    forecast = series[n_past:]
    current = series[n_past - 1] if n_past else (series[-1] if series else 0.0)
    baseline = _median([d for d in past if d > 0]) or (max(past) if past else 0.0)
    peak = max(forecast) if forecast else current

    if baseline < _NEGLIGIBLE_DISCHARGE and peak < _NEGLIGIBLE_DISCHARGE:
        ratio: float | None = None
        source = "open-meteo-flood (no major river at this location)"
    else:
        ratio = round(peak / max(baseline, _NEGLIGIBLE_DISCHARGE), 2)
        source = "open-meteo-flood (GloFAS)"

    level = _classify_flood(ratio)
    trend_src = forecast[:10] if forecast else past[-10:]
    return {
        "latitude": lat,
        "longitude": lon,
        "flood_risk_score": _flood_score(ratio),
        "anomaly_ratio": ratio,
        "current_discharge_m3s": round(current, 1),
        "forecast_peak_m3s": round(peak, 1),
        "baseline_discharge_m3s": round(baseline, 1),
        "level": level,
        "recommendation": _FLOOD_RECOMMENDATION[level],
        "trend": [round(x, 1) for x in trend_src],
        "source": source,
    }


def get_flood_forecast(lat: float, lon: float) -> dict:
    return _serve(
        _flood_cache, (round(lat, 2), round(lon, 2)), lambda: _fetch_flood(lat, lon), "flood"
    )


# --- Cyclone indicator (forecast wind + surface pressure, Open-Meteo) --------
#
# There is no free named-storm-track API. This is an honest *indicator*
# built from forecast 10 m winds/gusts and the minimum surface pressure over
# the next week — the signature of an approaching cyclonic system — not a
# probability that a specific cyclone will hit.

_CYCLONE_FORECAST_DAYS = 7

_CYCLONE_RECOMMENDATION = {
    "low": "No cyclonic activity indicated — forecast winds are within the normal range.",
    "moderate": "Gale-force gusts forecast. Secure loose objects and keep an eye on official updates.",
    "high": (
        "Cyclonic-storm-force winds are possible. Prepare for power cuts, stock water, and stay "
        "indoors during the strongest winds."
    ),
    "critical": (
        "Severe cyclonic conditions forecast. Move to a cyclone shelter or a strong building and "
        "follow official evacuation warnings."
    ),
}


def _classify_cyclone(peak_gust_kmh: float, min_pressure_hpa: float | None) -> str:
    if peak_gust_kmh >= 89:
        level = "critical"
    elif peak_gust_kmh >= 62:
        level = "high"
    elif peak_gust_kmh >= 45:
        level = "moderate"
    else:
        level = "low"
    # A deep surface low corroborates / escalates a windy forecast.
    if min_pressure_hpa is not None:
        if min_pressure_hpa < 980:
            level = "critical"
        elif min_pressure_hpa < 995 and level in ("moderate", "high"):
            order = ["low", "moderate", "high", "critical"]
            level = order[min(order.index(level) + 1, 3)]
    return level


def _cyclone_score(peak_gust_kmh: float) -> int:
    """0–100 headline. gust 45→~22, 90→~63, 130→~99."""
    return int(max(5.0, min(100.0, (peak_gust_kmh - 20.0) * 0.9)))


def _fetch_cyclone(lat: float, lon: float) -> dict:
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": "pressure_msl",
        "daily": "wind_speed_10m_max,wind_gusts_10m_max",
        "forecast_days": _CYCLONE_FORECAST_DAYS,
        "timezone": "auto",
    }
    resp = httpx.get(_OPEN_METEO_URL, params=params, timeout=_TIMEOUT_S)
    resp.raise_for_status()
    data = resp.json()

    daily = data.get("daily", {}) or {}
    winds = [float(x) for x in (daily.get("wind_speed_10m_max") or []) if x is not None]
    gusts = [float(x) for x in (daily.get("wind_gusts_10m_max") or []) if x is not None]
    hourly = data.get("hourly", {}) or {}
    pressures = [float(x) for x in (hourly.get("pressure_msl") or []) if x is not None]

    peak_wind = max(winds, default=0.0)
    peak_gust = max(gusts, default=peak_wind)
    min_pressure = min(pressures) if pressures else None

    level = _classify_cyclone(peak_gust, min_pressure)
    return {
        "latitude": lat,
        "longitude": lon,
        "cyclone_risk_score": _cyclone_score(peak_gust),
        "peak_wind_kmh": round(peak_wind, 1),
        "peak_gust_kmh": round(peak_gust, 1),
        "min_pressure_hpa": round(min_pressure, 1) if min_pressure is not None else None,
        "level": level,
        "recommendation": _CYCLONE_RECOMMENDATION[level],
        "trend": [round(g, 1) for g in gusts[:7]],  # daily peak gusts (km/h)
        "source": "open-meteo (forecast wind & pressure indicator — not a storm track)",
    }


def get_cyclone_forecast(lat: float, lon: float) -> dict:
    return _serve(
        _cyclone_cache, (round(lat, 2), round(lon, 2)), lambda: _fetch_cyclone(lat, lon), "cyclone"
    )


# --- Landslide indicator (slope from a 90 m DEM × rainfall trigger) ---------
#
# Rainfall-triggered landslide heuristic: landslides need BOTH steep terrain
# AND water. Slope comes from four Open-Meteo elevation samples (Copernicus
# GLO-90 DEM); the trigger is antecedent + forecast rainfall. This is a
# heuristic, NOT a geological susceptibility model (that would be a hosted
# NRSC/Bhuvan layer, region-limited).

_SAMPLE_OFFSET_DEG = 0.009  # ~1 km — a ring of samples this far from the point
_FLAT_SLOPE_DEG = 6.0
_M_PER_DEG_LAT = 111_320.0
# 8 compass directions (N, NE, E, SE, S, SW, W, NW) as (d_lat, d_lon) unit steps
_RING = [
    (1, 0), (1, 1), (0, 1), (-1, 1),
    (-1, 0), (-1, -1), (0, -1), (1, -1),
]

_LANDSLIDE_RECOMMENDATION = {
    "flat": "Terrain here is flat — landslides are not a local risk.",
    "low": "Low landslide risk — slopes are stable for the current rainfall.",
    "moderate": (
        "Watch for slips on steep slopes and road cuttings after prolonged rain. Don't park or "
        "shelter directly below hill cuts."
    ),
    "high": (
        "High landslide risk — heavy rain on steep terrain. Avoid hill roads and slopes; report "
        "fresh cracks, tilting trees, or subsidence."
    ),
    "critical": (
        "Severe landslide risk — move away from steep slopes and hillside structures now and follow "
        "local warnings."
    ),
}


def _slope_degrees(elevations: list[float], center_lat: float) -> tuple[float, float]:
    """`elevations` = [centre, + one per `_RING` direction]. Returns
    (slope_degrees, local_relief_m). Slope is the steepest drop across the
    sampled neighbourhood taken over its diameter — a terrain-ruggedness
    proxy that copes with a coarse DEM better than a single N-S/E-W cross."""
    ring = elevations[1:]
    if not ring:
        return 0.0, 0.0
    relief = max(ring) - min(ring)
    # Approx metres from the centre to a ring point (lat/lon averaged).
    m_per_deg_lon = _M_PER_DEG_LAT * max(0.05, math.cos(math.radians(center_lat)))
    radius_m = _SAMPLE_OFFSET_DEG * (_M_PER_DEG_LAT + m_per_deg_lon) / 2
    diameter_m = 2 * radius_m
    return math.degrees(math.atan(relief / diameter_m)), relief


def _landslide_score(slope_deg: float, trigger_mm: float) -> int:
    slope_factor = max(0.0, min(1.0, (slope_deg - 8.0) / 27.0))  # 0 at 8°, 1 at 35°+
    rain_factor = max(0.0, min(1.2, trigger_mm / 150.0))  # 150 mm total = strong trigger
    return int(max(0.0, min(100.0, slope_factor * rain_factor * 100.0)))


def _classify_landslide(score: int, slope_deg: float) -> str:
    if slope_deg < _FLAT_SLOPE_DEG:
        return "low"
    if score < 20:
        return "low"
    if score < 45:
        return "moderate"
    if score < 70:
        return "high"
    return "critical"


def _fetch_landslide(lat: float, lon: float) -> dict:
    off = _SAMPLE_OFFSET_DEG
    lats = [lat] + [lat + dlat * off for dlat, _ in _RING]
    lons = [lon] + [lon + dlon * off for _, dlon in _RING]
    elev_resp = httpx.get(
        _OPEN_METEO_ELEVATION_URL,
        params={
            "latitude": ",".join(f"{x:.5f}" for x in lats),
            "longitude": ",".join(f"{x:.5f}" for x in lons),
        },
        timeout=_TIMEOUT_S,
    )
    elev_resp.raise_for_status()
    elevations = [float(x) for x in elev_resp.json().get("elevation", [])]
    if len(elevations) < 1 + len(_RING):
        raise ValueError("elevation API returned too few points")

    rain_resp = httpx.get(
        _OPEN_METEO_URL,
        params={
            "latitude": lat,
            "longitude": lon,
            "daily": "precipitation_sum",
            "past_days": 4,
            "forecast_days": 5,
            "timezone": "auto",
        },
        timeout=_TIMEOUT_S,
    )
    rain_resp.raise_for_status()
    sums = [float(x) if x is not None else 0.0 for x in
            (rain_resp.json().get("daily", {}) or {}).get("precipitation_sum", [])]
    antecedent = sum(sums[:4])          # past 4 days
    upcoming = sum(sums[4:8])           # today + next 3 days
    trigger_mm = round(antecedent * 0.6 + upcoming, 1)

    slope_raw, relief_m = _slope_degrees(elevations, lat)
    slope_deg = round(slope_raw, 1)
    flat = slope_deg < _FLAT_SLOPE_DEG
    score = 0 if flat else _landslide_score(slope_deg, trigger_mm)
    level = _classify_landslide(score, slope_deg)

    return {
        "latitude": lat,
        "longitude": lon,
        "landslide_risk_score": score,
        "slope_degrees": slope_deg,
        "local_relief_m": round(relief_m, 0),
        "elevation_m": round(elevations[0], 1),
        "antecedent_rain_mm": round(antecedent, 1),
        "forecast_rain_mm": round(upcoming, 1),
        "rain_trigger_mm": trigger_mm,
        "level": level,
        "recommendation": _LANDSLIDE_RECOMMENDATION["flat" if flat else level],
        "trend": [round(x, 1) for x in sums[4:11]],  # daily precip, forward
        "source": (
            "open-meteo (slope from 90 m DEM × rainfall trigger — heuristic, not a geological model)"
        ),
    }


def get_landslide_forecast(lat: float, lon: float) -> dict:
    return _serve(
        _landslide_cache,
        (round(lat, 2), round(lon, 2)),
        lambda: _fetch_landslide(lat, lon),
        "landslide",
    )


def warm_up() -> None:
    """Pre-fetch all four forecasts for the configured demo coordinates so
    the citizen home cards are live on the very first page load — before
    Open-Meteo latency or a cold free-tier dyno can bite. Best-effort."""
    from app.config import settings

    lat, lon = settings.DEMO_LAT, settings.DEMO_LON
    if lat is None or lon is None:
        logger.info("weather warm-up: DEMO_LAT/DEMO_LON unset — skipping")
        return
    for label, fn in (
        ("rainfall", get_rainfall_forecast),
        ("flood", get_flood_forecast),
        ("cyclone", get_cyclone_forecast),
        ("landslide", get_landslide_forecast),
    ):
        try:
            fn(lat, lon)
            logger.info("weather warm-up: %s cached for %.4f,%.4f", label, lat, lon)
        except Exception as exc:  # noqa: BLE001
            logger.warning("weather warm-up: %s failed: %s", label, exc)
