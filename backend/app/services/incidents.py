"""Incident/evidence business logic. Routers call these; they never touch
the ORM directly, so every access rule (who can see/change what) lives in
exactly one place.
"""
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.events.broker import broker
from app.gis.points import make_point
from app.models.enums import IncidentStatus
from app.models.incident import Incident
from app.models.incident_evidence import IncidentEvidence
from app.models.user import User
from app.schemas.incident import IncidentOut


def _publish_incident(event_type: str, incident: Incident) -> None:
    """Fan an incident change out over SSE (see app/api/stream.py). Payload
    is the same IncidentOut shape the REST endpoints return."""
    broker.publish(event_type, IncidentOut.model_validate(incident).model_dump(mode="json"))


def create_incident(
    db: Session,
    *,
    reported_by: int | None,
    type_: str,
    latitude: float,
    longitude: float,
    severity: str,
    description: str | None,
    people_affected: int,
) -> Incident:
    incident = Incident(
        type=type_,
        latitude=latitude,
        longitude=longitude,
        location=make_point(latitude, longitude),
        severity=severity,
        confidence=0.0,  # set by the verification/confidence engine (Phase 7)
        status=IncidentStatus.REPORTED.value,
        description=description,
        reported_by=reported_by,
        people_affected=people_affected,
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)
    _publish_incident("incident.created", incident)
    # A new incident shifts nearby risk-zone scores (see risk_zones.compute_zones).
    broker.publish("risk.updated", {"reason": "incident"})
    # The reporter's status in someone's family circle may have just changed.
    if reported_by is not None:
        broker.publish("family.updated", {"reason": "incident"})
    return incident


def create_incident_with_evidence(
    db: Session,
    *,
    reported_by: int,
    type_: str,
    latitude: float,
    longitude: float,
    severity: str,
    description: str | None,
    people_affected: int,
    image_url: str | None,
    audio_url: str | None,
) -> Incident:
    """Used by /sos and /reports: a citizen's single submission becomes one
    incident row plus (optionally) one evidence row, in one transaction."""
    incident = create_incident(
        db,
        reported_by=reported_by,
        type_=type_,
        latitude=latitude,
        longitude=longitude,
        severity=severity,
        description=description,
        people_affected=people_affected,
    )
    if image_url or audio_url:
        add_evidence(db, incident=incident, image_url=image_url, audio_url=audio_url)
        db.refresh(incident)
    return incident


def add_evidence(
    db: Session,
    *,
    incident: Incident,
    image_url: str | None = None,
    video_url: str | None = None,
    audio_url: str | None = None,
) -> IncidentEvidence:
    evidence = IncidentEvidence(
        incident_id=incident.id,
        image_url=image_url,
        video_url=video_url,
        audio_url=audio_url,
    )
    db.add(evidence)
    db.commit()
    db.refresh(evidence)
    db.refresh(incident)
    _publish_incident("incident.updated", incident)
    return evidence


def _can_view(incident: Incident, user: User) -> bool:
    if user.role in ("responder", "admin"):
        return True
    return incident.reported_by == user.id


def get_incident_for_user(db: Session, incident_id: int, user: User) -> Incident:
    incident = db.get(Incident, incident_id)
    if incident is None or not _can_view(incident, user):
        # 404, not 403 — a citizen shouldn't learn that another citizen's
        # incident ID exists at all.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")
    return incident


def list_incidents_for_user(
    db: Session,
    user: User,
    *,
    status_filter: str | None = None,
    type_filter: str | None = None,
    severity_filter: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Incident]:
    query = select(Incident).order_by(Incident.created_at.desc())

    if user.role == "citizen":
        query = query.where(Incident.reported_by == user.id)
    if status_filter:
        query = query.where(Incident.status == status_filter)
    if type_filter:
        query = query.where(Incident.type == type_filter)
    if severity_filter:
        query = query.where(Incident.severity == severity_filter)

    query = query.limit(min(limit, 200)).offset(max(offset, 0))
    return list(db.execute(query).scalars().all())


def update_incident(
    db: Session,
    incident: Incident,
    *,
    new_status: str | None,
    new_severity: str | None,
) -> Incident:
    if new_status is not None:
        incident.status = new_status
        if new_status == IncidentStatus.VERIFIED.value and incident.verified_at is None:
            incident.verified_at = datetime.now(timezone.utc)
    if new_severity is not None:
        incident.severity = new_severity
    db.commit()
    db.refresh(incident)
    _publish_incident("incident.updated", incident)
    # Status/severity changes affect which incidents count toward nearby risk.
    broker.publish("risk.updated", {"reason": "incident"})
    # Resolving/escalating an incident can flip the reporter's family status.
    if incident.reported_by is not None:
        broker.publish("family.updated", {"reason": "incident"})
    return incident
