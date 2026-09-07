from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_role
from app.database import get_db
from app.models.responder import Responder
from app.models.user import User
from app.schemas.responder import ResponderOut, ResponderUpdate
from app.services import responders as responders_service

router = APIRouter(tags=["responders"])


@router.get("/responders", response_model=list[ResponderOut])
def list_responders(
    _current_user: User = Depends(require_role("responder", "admin")),
    db: Session = Depends(get_db),
) -> list[ResponderOut]:
    return [ResponderOut.model_validate(r) for r in responders_service.list_responders(db)]


@router.patch("/responders/{responder_id}", response_model=ResponderOut)
def patch_responder(
    responder_id: int,
    payload: ResponderUpdate,
    _current_user: User = Depends(require_role("responder", "admin")),
    db: Session = Depends(get_db),
) -> ResponderOut:
    responder = db.get(Responder, responder_id)
    if responder is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Responder not found")
    updated = responders_service.update_responder(
        db,
        responder,
        status=payload.status.value if payload.status else None,
        latitude=payload.latitude,
        longitude=payload.longitude,
    )
    return ResponderOut.model_validate(updated)
