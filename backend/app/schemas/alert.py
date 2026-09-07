from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import SeverityLevel


class AlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source: str  # imd | sachet | simulator | admin
    type: str
    severity: str
    message: str
    issued_at: datetime
    expires_at: datetime | None


class AlertCreate(BaseModel):
    """Admin-issued alert. `source` is forced to "admin" server-side — the
    frontend can never mint an `imd`/`sachet` alert."""

    type: str = Field(min_length=1, max_length=30, examples=["flood_warning", "advisory"])
    severity: SeverityLevel = SeverityLevel.HIGH
    message: str = Field(min_length=1, max_length=2000)
    expires_in_hours: float | None = Field(default=24, gt=0, le=168)
