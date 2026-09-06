from pydantic import BaseModel, Field


class SimulatorStateOut(BaseModel):
    active: bool
    rainfall_mm: float
    water_level_m: float
    road_blockage_pct: float


class SimulatorStartRequest(BaseModel):
    rainfall_mm: float = Field(220.0, ge=0, le=300)
    water_level_m: float = Field(3.5, ge=0, le=5)
    road_blockage_pct: float = Field(40.0, ge=0, le=100)


class SimulatorUpdateRequest(BaseModel):
    rainfall_mm: float | None = Field(None, ge=0, le=300)
    water_level_m: float | None = Field(None, ge=0, le=5)
    road_blockage_pct: float | None = Field(None, ge=0, le=100)


class SpawnIncidentsRequest(BaseModel):
    count: int = Field(3, ge=1, le=20)
    max_people_affected: int = Field(5, ge=0, le=50)
