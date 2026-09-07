from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_role
from app.database import get_db
from app.models.enums import IncidentStatus, IncidentType, SeverityLevel
from app.models.user import User
from app.schemas.incident import EvidenceOut, IncidentCreate, IncidentOut, IncidentUpdate
from app.services import incidents as incidents_service
from app.services import priority as priority_service
from app.services.storage import save_upload

router = APIRouter(prefix="/incidents", tags=["incidents"])


@router.post("", response_model=IncidentOut, status_code=status.HTTP_201_CREATED)
def create_incident(
    payload: IncidentCreate,
    current_user: User = Depends(require_role("responder", "admin")),
    db: Session = Depends(get_db),
) -> IncidentOut:
    """Manual incident logging by a responder/admin (e.g. a phoned-in report).
    Citizen-originated incidents go through /sos or /reports instead."""
    incident = incidents_service.create_incident(
        db,
        reported_by=current_user.id,
        type_=payload.type.value,
        latitude=payload.latitude,
        longitude=payload.longitude,
        severity=payload.severity.value,
        description=payload.description,
        people_affected=payload.people_affected,
    )
    return IncidentOut.model_validate(incident)


@router.get("", response_model=list[IncidentOut])
def list_incidents(
    status_filter: IncidentStatus | None = None,
    type_filter: IncidentType | None = None,
    severity_filter: SeverityLevel | None = None,
    sort: str | None = None,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[IncidentOut]:
    """Citizens see only their own reports; responders/admins see everything.
    `sort=priority` orders by the priority engine's score (highest first)."""
    rows = incidents_service.list_incidents_for_user(
        db,
        current_user,
        status_filter=status_filter.value if status_filter else None,
        type_filter=type_filter.value if type_filter else None,
        severity_filter=severity_filter.value if severity_filter else None,
        limit=limit,
        offset=offset,
    )
    priorities = priority_service.annotate_priorities(db, rows)
    if sort == "priority":
        rows.sort(key=lambda i: priorities.get(i.id, ("low", 0.0))[1], reverse=True)
    return [
        IncidentOut.model_validate(row).model_copy(
            update={"priority": priorities.get(row.id, (None, 0.0))[0]}
        )
        for row in rows
    ]


@router.get("/{incident_id}", response_model=IncidentOut)
def get_incident(
    incident_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> IncidentOut:
    incident = incidents_service.get_incident_for_user(db, incident_id, current_user)
    return IncidentOut.model_validate(incident)


@router.patch("/{incident_id}", response_model=IncidentOut)
def patch_incident(
    incident_id: int,
    payload: IncidentUpdate,
    current_user: User = Depends(require_role("responder", "admin")),
    db: Session = Depends(get_db),
) -> IncidentOut:
    """The only way an incident's status/severity changes — always a human
    (responder/admin) action, never automatic, even after AI verification
    signals land in a later phase."""
    incident = incidents_service.get_incident_for_user(db, incident_id, current_user)
    updated = incidents_service.update_incident(
        db,
        incident,
        new_status=payload.status.value if payload.status else None,
        new_severity=payload.severity.value if payload.severity else None,
    )
    return IncidentOut.model_validate(updated)


@router.post("/{incident_id}/evidence", response_model=EvidenceOut, status_code=status.HTTP_201_CREATED)
async def add_incident_evidence(
    incident_id: int,
    image: UploadFile | None = File(None),
    audio: UploadFile | None = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EvidenceOut:
    incident = incidents_service.get_incident_for_user(db, incident_id, current_user)
    if image is None and audio is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Attach an image or audio file")

    image_url = await save_upload(image, kind="image") if image is not None else None
    audio_url = await save_upload(audio, kind="audio") if audio is not None else None

    evidence = incidents_service.add_evidence(
        db, incident=incident, image_url=image_url, audio_url=audio_url
    )
    return EvidenceOut.model_validate(evidence)
