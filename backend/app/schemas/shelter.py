from pydantic import BaseModel, ConfigDict


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
