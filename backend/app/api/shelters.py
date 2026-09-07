from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_role
from app.database import get_db
from app.models.shelter import Shelter
from app.models.user import User
from app.schemas.shelter import NearbyShelterOut, ShelterOut, ShelterUpdate
from app.services import shelters as shelters_service

router = APIRouter(tags=["shelters"])


@router.get("/shelters", response_model=list[ShelterOut])
def list_shelters(
    _current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ShelterOut]:
    return [ShelterOut.model_validate(s) for s in shelters_service.list_shelters(db)]


@router.get("/shelters/nearest", response_model=list[NearbyShelterOut])
def nearest_shelters(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    limit: int = Query(5, ge=1, le=50),
    _current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[NearbyShelterOut]:
    """Shelters nearest to a point, closest first, with distance in km."""
    rows = shelters_service.nearest_shelters(db, latitude=lat, longitude=lon, limit=limit)
    return [
        NearbyShelterOut(
            **ShelterOut.model_validate(shelter).model_dump(),
            distance_km=round(distance_m / 1000, 2),
        )
        for shelter, distance_m in rows
    ]


@router.patch("/shelters/{shelter_id}", response_model=ShelterOut)
def patch_shelter(
    shelter_id: int,
    payload: ShelterUpdate,
    _current_user: User = Depends(require_role("responder", "admin")),
    db: Session = Depends(get_db),
) -> ShelterOut:
    shelter = db.get(Shelter, shelter_id)
    if shelter is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shelter not found")
    updated = shelters_service.update_shelter(
        db,
        shelter,
        status=payload.status.value if payload.status else None,
        occupied=payload.occupied,
    )
    return ShelterOut.model_validate(updated)
