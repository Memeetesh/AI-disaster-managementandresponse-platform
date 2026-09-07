"""Rescue-operation lifecycle: dispatch a verified incident to the nearest
available responder, compute a safe route + ETA, then walk the operation
through en_route → in_progress → completed (with the incident/responder
status cascades). Every change emits `rescue.updated` over SSE.
"""
import json
from datetime import datetime, timezone

from fastapi import HTTPException, status as http_status
from geoalchemy2.elements import WKTElement
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.events.broker import broker
from app.models.incident import Incident
from app.models.rescue_operation import RescueOperation
from app.models.responder import Responder
from app.routing import safe_route
from app.services import incidents as incidents_service
from app.services import priority as priority_service
from app.services import responders as responders_service

DISPATCHABLE_INCIDENT_STATUSES = ("verified", "in_progress")
_TERMINAL = ("completed", "cancelled")


def _serialize(db: Session, op: RescueOperation) -> dict:
    route_geojson = None
    if op.route is not None:
        raw = db.execute(
            select(func.ST_AsGeoJSON(RescueOperation.route)).where(RescueOperation.id == op.id)
        ).scalar()
        route_geojson = json.loads(raw) if raw else None
    responder = db.get(Responder, op.responder_id) if op.responder_id else None
    incident = db.get(Incident, op.incident_id)
    reported_by = incident.reported_by if incident else None
    return {
        "id": op.id,
        "incident_id": op.incident_id,
        "responder_id": op.responder_id,
        "priority": op.priority,
        "eta_minutes": op.eta_minutes,
        "status": op.status,
        "created_at": op.created_at.isoformat() if op.created_at else None,
        "completed_at": op.completed_at.isoformat() if op.completed_at else None,
        "route": route_geojson,
        "responder_name": responder.name if responder else None,
        "incident_reported_by": reported_by,
        # Alias so the SSE role filter (app/api/stream.py) can scope this
        # event to the citizen who reported the incident.
        "reported_by": reported_by,
    }


def _emit(db: Session, op: RescueOperation) -> dict:
    payload = _serialize(db, op)
    broker.publish("rescue.updated", payload)
    return payload


def list_rescue_operations(db: Session) -> list[dict]:
    ops = (
        db.execute(select(RescueOperation).order_by(RescueOperation.created_at.desc()))
        .scalars()
        .all()
    )
    return [_serialize(db, op) for op in ops]


def create_rescue_operation(db: Session, *, incident_id: int) -> dict:
    incident = db.get(Incident, incident_id)
    if incident is None:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Incident not found")
    if incident.status not in DISPATCHABLE_INCIDENT_STATUSES:
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT,
            detail=f"Incident must be verified before dispatch (current status: {incident.status})",
        )
    active = (
        db.execute(
            select(RescueOperation).where(
                RescueOperation.incident_id == incident_id,
                RescueOperation.status.notin_(_TERMINAL),
            )
        )
        .scalars()
        .first()
    )
    if active is not None:
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT,
            detail="This incident already has an active rescue operation",
        )
    responder = responders_service.nearest_available(
        db, latitude=incident.latitude, longitude=incident.longitude
    )
    if responder is None:
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT, detail="No responders available"
        )

    route = safe_route(
        responder.latitude, responder.longitude, incident.latitude, incident.longitude
    )
    priority_label = priority_service.active_priority_for_incident(db, incident)

    op = RescueOperation(
        incident_id=incident_id,
        responder_id=responder.id,
        priority=priority_label,
        route=WKTElement(route.to_wkt(), srid=4326),
        eta_minutes=round(route.duration_min),
        status="en_route",
    )
    db.add(op)
    db.flush()

    responders_service.set_status(db, responder, "en_route")
    incidents_service.update_incident(db, incident, new_status="in_progress", new_severity=None)

    db.refresh(op)
    return _emit(db, op)


def update_rescue_operation(db: Session, op_id: int, *, new_status: str) -> dict:
    op = db.get(RescueOperation, op_id)
    if op is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND, detail="Rescue operation not found"
        )
    if op.status in _TERMINAL:
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT,
            detail=f"Rescue operation is already {op.status}",
        )

    op.status = new_status
    responder = db.get(Responder, op.responder_id) if op.responder_id else None
    incident = db.get(Incident, op.incident_id)

    if new_status == "completed":
        op.completed_at = datetime.now(timezone.utc)
        if responder is not None:
            responders_service.set_status(db, responder, "available")
        if incident is not None:
            incidents_service.update_incident(db, incident, new_status="resolved", new_severity=None)
    elif new_status == "cancelled":
        if responder is not None:
            responders_service.set_status(db, responder, "available")
        if incident is not None and incident.status == "in_progress":
            incidents_service.update_incident(db, incident, new_status="verified", new_severity=None)

    db.commit()
    db.refresh(op)
    return _emit(db, op)
