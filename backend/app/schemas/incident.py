from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import IncidentStatus, IncidentType, SeverityLevel


class EvidenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    image_url: str | None
    video_url: str | None
    audio_url: str | None
    extracted_text: str | None
    ai_detection: dict | None
    ai_confidence: float | None
    created_at: datetime


class IncidentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: str
    latitude: float
    longitude: float
    severity: str
    confidence: float
    status: str
    description: str | None
    reported_by: int | None
    people_affected: int
    created_at: datetime
    verified_at: datetime | None
    evidence: list[EvidenceOut] = []


class IncidentCreate(BaseModel):
    """Manual incident creation by a responder/admin (e.g. logging a phoned-in report)."""

    type: IncidentType = IncidentType.FLOOD
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    severity: SeverityLevel = SeverityLevel.MODERATE
    description: str | None = None
    people_affected: int = Field(default=0, ge=0)


class IncidentUpdate(BaseModel):
    """Responder/admin verification action — the only way status/severity change."""

    status: IncidentStatus | None = None
    severity: SeverityLevel | None = None
