from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_role
from app.database import get_db
from app.models.user import User
from app.schemas.check_in import CheckInCreate, CheckInOut
from app.services import check_ins as check_ins_service

router = APIRouter(tags=["check-in"])


@router.post("/check-in", response_model=CheckInOut, status_code=status.HTTP_201_CREATED)
def create_check_in(
    payload: CheckInCreate,
    current_user: User = Depends(require_role("citizen")),
    db: Session = Depends(get_db),
) -> CheckInOut:
    """Citizen marks themselves safe (optionally with their location)."""
    check_in = check_ins_service.create_check_in(
        db,
        user_id=current_user.id,
        status=payload.status,
        latitude=payload.latitude,
        longitude=payload.longitude,
    )
    return CheckInOut.model_validate(check_in)


@router.get("/check-in/me", response_model=CheckInOut | None)
def get_my_check_in(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CheckInOut | None:
    """The caller's most recent check-in, or null if they've never checked in."""
    check_in = check_ins_service.latest_for_user(db, current_user.id)
    return CheckInOut.model_validate(check_in) if check_in else None
