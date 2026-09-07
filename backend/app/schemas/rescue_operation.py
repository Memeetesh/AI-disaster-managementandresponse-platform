from datetime import datetime

from pydantic import BaseModel

from app.models.enums import RescueStatus


class RescueOperationCreate(BaseModel):
    incident_id: int


class RescueOperationUpdate(BaseModel):
    status: RescueStatus


class RescueOperationOut(BaseModel):
    id: int
    incident_id: int
    responder_id: int | None
    priority: str
    eta_minutes: int | None
    status: str
    created_at: datetime | None
    completed_at: datetime | None
    route: dict | None  # GeoJSON LineString ([lon, lat] pairs)
    responder_name: str | None
    incident_reported_by: int | None
