from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.core.deps import require_role
from app.models.user import User
from app.routing import safe_route

router = APIRouter(tags=["routes"])


class SafeRouteOut(BaseModel):
    geometry: dict  # GeoJSON LineString
    distance_m: float
    duration_min: float
    source: str  # "osrm" | "straight_line"


@router.get("/routes/safe", response_model=SafeRouteOut)
def get_safe_route(
    from_lat: float = Query(..., ge=-90, le=90),
    from_lon: float = Query(..., ge=-180, le=180),
    to_lat: float = Query(..., ge=-90, le=90),
    to_lon: float = Query(..., ge=-180, le=180),
    _current_user: User = Depends(require_role("responder", "admin")),
) -> SafeRouteOut:
    route = safe_route(from_lat, from_lon, to_lat, to_lon)
    return SafeRouteOut(
        geometry=route.geometry,
        distance_m=route.distance_m,
        duration_min=route.duration_min,
        source=route.source,
    )
