from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CheckInCreate(BaseModel):
    status: str = Field(default="safe", pattern="^(safe|need_help)$")
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)


class CheckInOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    status: str
    latitude: float | None
    longitude: float | None
    created_at: datetime
