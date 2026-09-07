"""Citizen safety self check-ins ("I am Safe")."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.gis.points import make_point
from app.models.check_in import CheckIn


def create_check_in(
    db: Session,
    *,
    user_id: int,
    status: str = "safe",
    latitude: float | None = None,
    longitude: float | None = None,
) -> CheckIn:
    location = (
        make_point(latitude, longitude)
        if latitude is not None and longitude is not None
        else None
    )
    check_in = CheckIn(
        user_id=user_id,
        status=status,
        latitude=latitude,
        longitude=longitude,
        location=location,
    )
    db.add(check_in)
    db.commit()
    db.refresh(check_in)
    return check_in


def latest_for_user(db: Session, user_id: int) -> CheckIn | None:
    return (
        db.execute(
            select(CheckIn)
            .where(CheckIn.user_id == user_id)
            .order_by(CheckIn.created_at.desc())
        )
        .scalars()
        .first()
    )
