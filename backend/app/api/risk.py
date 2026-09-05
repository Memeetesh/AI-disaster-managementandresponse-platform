from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.schemas.risk_zone import RiskMapResponse, RiskZoneFeature, RiskZoneOut, RiskZoneProperties
from app.services import risk_zones as risk_service

router = APIRouter(tags=["risk"])


def _to_properties(zone: dict) -> RiskZoneProperties:
    return RiskZoneProperties(**{k: v for k, v in zone.items() if k != "geometry"})


@router.get("/risk-map", response_model=RiskMapResponse)
def get_risk_map(
    _current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RiskMapResponse:
    """GeoJSON FeatureCollection for the map layer — one polygon feature per
    grid cell, properties carrying the full explainable score breakdown."""
    zones = risk_service.compute_zones(db)
    features = [
        RiskZoneFeature(geometry=zone["geometry"], properties=_to_properties(zone)) for zone in zones
    ]
    return RiskMapResponse(features=features)


@router.get("/risk-zones", response_model=list[RiskZoneOut])
def list_risk_zones(
    _current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[RiskZoneOut]:
    return [RiskZoneOut(**zone) for zone in risk_service.compute_zones(db)]


@router.get("/risk-zones/{zone_id}", response_model=RiskZoneOut)
def get_risk_zone(
    zone_id: int,
    _current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RiskZoneOut:
    zones = risk_service.compute_zones(db, zone_id=zone_id)
    if not zones:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Risk zone not found")
    return RiskZoneOut(**zones[0])
