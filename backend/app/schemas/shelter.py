from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import ShelterStatus


class ShelterOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    latitude: float
    longitude: float
    capacity: int
    occupied: int
    facilities: list[str] | None
    accessibility: str | None
    status: str


class NearbyShelterOut(ShelterOut):
    distance_km: float


class ShelterUpdate(BaseModel):
    """Responder/admin shelter management."""

    status: ShelterStatus | None = None
    occupied: int | None = Field(default=None, ge=0)
