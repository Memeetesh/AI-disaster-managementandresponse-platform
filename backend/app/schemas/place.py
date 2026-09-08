from pydantic import BaseModel


class NearbyPlaceOut(BaseModel):
    name: str
    kind: str  # hospital | shelter | police | fire_station | pharmacy
    latitude: float
    longitude: float
    distance_km: float
    phone: str | None
    address: str | None
