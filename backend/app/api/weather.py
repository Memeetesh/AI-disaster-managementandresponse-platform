from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.weather import (
    CycloneForecastOut,
    FloodForecastOut,
    LandslideForecastOut,
    RainfallForecastOut,
)
from app.services import weather as weather_service

router = APIRouter(tags=["weather"])


@router.get("/weather/rainfall", response_model=RainfallForecastOut)
def get_rainfall(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    _current_user: User = Depends(get_current_user),
) -> RainfallForecastOut:
    """Rainfall forecast for a point, from Open-Meteo (free, keyless).
    502 if the provider is unreachable — the citizen app then falls back to
    its demo rainfall card."""
    try:
        return weather_service.get_rainfall_forecast(lat, lon)
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001 - upstream failure → 502
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Rainfall forecast provider is unavailable",
        ) from exc


@router.get("/weather/flood", response_model=FloodForecastOut)
def get_flood(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    _current_user: User = Depends(get_current_user),
) -> FloodForecastOut:
    """Flood forecast for a point — GloFAS river-discharge forecast vs its
    recent normal, via the Open-Meteo Flood API (free, keyless). This is a
    location-agnostic signal; the seeded risk-zone score (GET /risk-map) is
    the richer model where it exists. 502 on provider failure."""
    try:
        return weather_service.get_flood_forecast(lat, lon)
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001 - upstream failure → 502
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Flood forecast provider is unavailable",
        ) from exc


@router.get("/weather/cyclone", response_model=CycloneForecastOut)
def get_cyclone(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    _current_user: User = Depends(get_current_user),
) -> CycloneForecastOut:
    """Cyclonic-conditions indicator for a point — built from Open-Meteo
    forecast winds/gusts and minimum surface pressure over the next week.
    This is NOT a named-storm track (no free API exists); it flags when the
    forecast looks cyclonic. 502 on provider failure."""
    try:
        return weather_service.get_cyclone_forecast(lat, lon)
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001 - upstream failure → 502
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Cyclone forecast provider is unavailable",
        ) from exc


@router.get("/weather/landslide", response_model=LandslideForecastOut)
def get_landslide(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    _current_user: User = Depends(get_current_user),
) -> LandslideForecastOut:
    """Rainfall-triggered landslide indicator — local slope (Open-Meteo 90 m
    DEM samples) combined with antecedent + forecast rainfall. A heuristic,
    not a geological susceptibility model. 502 on provider failure."""
    try:
        return weather_service.get_landslide_forecast(lat, lon)
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001 - upstream failure → 502
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Landslide indicator provider is unavailable",
        ) from exc
