from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.schemas.shelter import ShelterOut
from app.services import shelters as shelters_service

router = APIRouter(tags=["shelters"])


@router.get("/shelters", response_model=list[ShelterOut])
def list_shelters(
    _current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ShelterOut]:
    return [ShelterOut.model_validate(s) for s in shelters_service.list_shelters(db)]
