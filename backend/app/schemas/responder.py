from pydantic import BaseModel, ConfigDict

from app.models.enums import ResponderStatus


class ResponderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    team: str | None
    latitude: float
    longitude: float
    status: str
    vehicle: str | None
    capacity: int


class ResponderUpdate(BaseModel):
    status: ResponderStatus | None = None
    latitude: float | None = None
    longitude: float | None = None
