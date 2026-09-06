from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from sqlalchemy.orm import Session

from app.core.deps import require_role
from app.database import get_db
from app.models.enums import IncidentType, SeverityLevel
from app.models.user import User
from app.schemas.incident import IncidentOut
from app.services import incidents as incidents_service
from app.services.storage import save_upload

router = APIRouter(tags=["sos"])


@router.post("/sos", response_model=IncidentOut, status_code=status.HTTP_201_CREATED)
async def submit_sos(
    latitude: float = Form(..., ge=-90, le=90),
    longitude: float = Form(..., ge=-180, le=180),
    people_affected: int = Form(..., ge=0),
    description: str | None = Form(None),
    type_: IncidentType = Form(IncidentType.FLOOD, alias="type"),
    image: UploadFile | None = File(None),
    audio: UploadFile | None = File(None),
    current_user: User = Depends(require_role("citizen")),
    db: Session = Depends(get_db),
) -> IncidentOut:
    """An emergency, single-shot submission: GPS + people trapped/affected +
    description + optional image/voice note. Defaults to CRITICAL severity —
    a human (responder/admin) confirms or downgrades it via PATCH
    /incidents/{id}, an AI never does."""
    image_url = await save_upload(image, kind="image") if image is not None else None
    audio_url = await save_upload(audio, kind="audio") if audio is not None else None

    incident = incidents_service.create_incident_with_evidence(
        db,
        reported_by=current_user.id,
        type_=type_.value,
        latitude=latitude,
        longitude=longitude,
        severity=SeverityLevel.CRITICAL.value,
        description=description,
        people_affected=people_affected,
        image_url=image_url,
        audio_url=audio_url,
    )
    return IncidentOut.model_validate(incident)
