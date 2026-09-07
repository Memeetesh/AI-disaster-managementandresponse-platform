from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_role
from app.database import get_db
from app.models.enums import AlertSource
from app.models.user import User
from app.schemas.alert import AlertCreate, AlertOut
from app.services import alerts as alerts_service

router = APIRouter(tags=["alerts"])


@router.get("/alerts", response_model=list[AlertOut])
def list_alerts(
    _current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[AlertOut]:
    """Active alerts (unexpired), newest first — any authenticated user."""
    return [AlertOut.model_validate(a) for a in alerts_service.list_active_alerts(db)]


@router.post("/alerts", response_model=AlertOut, status_code=status.HTTP_201_CREATED)
def create_alert(
    payload: AlertCreate,
    _current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> AlertOut:
    """Command-center admin issues an alert. `source` is fixed to "admin"."""
    expires_at = None
    if payload.expires_in_hours:
        expires_at = datetime.now(timezone.utc) + timedelta(hours=payload.expires_in_hours)
    alert = alerts_service.create_alert(
        db,
        source=AlertSource.ADMIN.value,
        type_=payload.type,
        severity=payload.severity.value,
        message=payload.message,
        expires_at=expires_at,
    )
    return AlertOut.model_validate(alert)
