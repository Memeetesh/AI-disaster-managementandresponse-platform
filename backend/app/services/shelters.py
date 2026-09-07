from geoalchemy2 import Geography
from sqlalchemy import cast, func, select
from sqlalchemy.orm import Session

from app.events.broker import broker
from app.models.shelter import Shelter
from app.schemas.shelter import ShelterOut


def list_shelters(db: Session) -> list[Shelter]:
    return list(db.execute(select(Shelter).order_by(Shelter.name)).scalars().all())


def nearest_shelters(
    db: Session, *, latitude: float, longitude: float, limit: int = 5
) -> list[tuple[Shelter, float]]:
    """Shelters ordered by great-circle distance from a point, with the
    distance in metres. Uses the PostGIS geography cast — same idiom as
    services/risk_zones.py."""
    point = func.ST_SetSRID(func.ST_MakePoint(longitude, latitude), 4326)
    distance_m = func.ST_Distance(cast(Shelter.location, Geography), cast(point, Geography))
    stmt = (
        select(Shelter, distance_m.label("distance_m"))
        .where(Shelter.location.isnot(None))
        .order_by(distance_m)
        .limit(min(limit, 50))
    )
    return [(row[0], float(row[1])) for row in db.execute(stmt).all()]


def update_shelter(
    db: Session,
    shelter: Shelter,
    *,
    status: str | None = None,
    occupied: int | None = None,
) -> Shelter:
    if status is not None:
        shelter.status = status
    if occupied is not None:
        shelter.occupied = max(0, occupied)
    db.commit()
    db.refresh(shelter)
    broker.publish("shelter.updated", ShelterOut.model_validate(shelter).model_dump(mode="json"))
    return shelter
