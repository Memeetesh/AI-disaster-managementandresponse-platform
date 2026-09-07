from geoalchemy2 import Geography
from sqlalchemy import cast, func, select
from sqlalchemy.orm import Session

from app.events.broker import broker
from app.gis.points import make_point
from app.models.responder import Responder
from app.schemas.responder import ResponderOut


def _publish(responder: Responder) -> None:
    broker.publish(
        "responder.updated",
        ResponderOut.model_validate(responder).model_dump(mode="json"),
    )


def list_responders(db: Session) -> list[Responder]:
    return list(db.execute(select(Responder).order_by(Responder.name)).scalars().all())


def nearest_available(
    db: Session, *, latitude: float, longitude: float
) -> Responder | None:
    point = func.ST_SetSRID(func.ST_MakePoint(longitude, latitude), 4326)
    distance = func.ST_Distance(cast(Responder.location, Geography), cast(point, Geography))
    stmt = (
        select(Responder)
        .where(Responder.status == "available")
        .where(Responder.location.isnot(None))
        .order_by(distance)
        .limit(1)
    )
    return db.execute(stmt).scalars().first()


def update_responder(
    db: Session,
    responder: Responder,
    *,
    status: str | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
) -> Responder:
    if status is not None:
        responder.status = status
    if latitude is not None and longitude is not None:
        responder.latitude = latitude
        responder.longitude = longitude
        responder.location = make_point(latitude, longitude)
    db.commit()
    db.refresh(responder)
    _publish(responder)
    return responder


def set_status(db: Session, responder: Responder, status: str) -> Responder:
    return update_responder(db, responder, status=status)
