from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import require_role
from app.database import get_db
from app.models.incident import Incident
from app.models.rescue_operation import RescueOperation
from app.models.responder import Responder
from app.models.shelter import Shelter
from app.models.user import User

router = APIRouter(tags=["dashboard"])

_OPEN_INCIDENT_STATUSES = ("reported", "ai_verified", "human_review", "verified", "in_progress")


class DashboardStats(BaseModel):
    active_incidents: int
    critical_incidents: int
    people_affected: int
    responders_available: int
    rescues_completed: int
    shelters_available: int


@router.get("/dashboard/stats", response_model=DashboardStats)
def get_dashboard_stats(
    _current_user: User = Depends(require_role("responder", "admin")),
    db: Session = Depends(get_db),
) -> DashboardStats:
    open_incidents = list(
        db.execute(select(Incident).where(Incident.status.in_(_OPEN_INCIDENT_STATUSES)))
        .scalars()
        .all()
    )
    return DashboardStats(
        active_incidents=len(open_incidents),
        critical_incidents=sum(1 for i in open_incidents if i.severity == "critical"),
        people_affected=sum(i.people_affected or 0 for i in open_incidents),
        responders_available=db.execute(
            select(func.count(Responder.id)).where(Responder.status == "available")
        ).scalar()
        or 0,
        rescues_completed=db.execute(
            select(func.count(RescueOperation.id)).where(RescueOperation.status == "completed")
        ).scalar()
        or 0,
        shelters_available=db.execute(
            select(func.count(Shelter.id)).where(Shelter.status == "open")
        ).scalar()
        or 0,
    )
