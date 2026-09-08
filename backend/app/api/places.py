from fastapi import APIRouter, Depends, Query

from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.place import NearbyPlaceOut
from app.services import places as places_service

router = APIRouter(tags=["places"])

_KINDS = ("hospital", "shelter", "police", "fire_station", "pharmacy")


@router.get("/places/nearby", response_model=list[NearbyPlaceOut])
def nearby_places(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    kind: str = Query("hospital", pattern="^(hospital|shelter|police|fire_station|pharmacy)$"),
    radius_km: float = Query(8.0, ge=0.5, le=40),
    limit: int = Query(8, ge=1, le=25),
    _current_user: User = Depends(get_current_user),
) -> list[NearbyPlaceOut]:
    """Real points of interest near a location, from OpenStreetMap (Overpass).
    Returns [] if Overpass is unreachable — callers should fall back."""
    return places_service.nearby_places(lat, lon, kind, radius_km=radius_km, limit=limit)
