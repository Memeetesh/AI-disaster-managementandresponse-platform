from typing import Literal

from pydantic import BaseModel


class RiskZoneProperties(BaseModel):
    id: int
    risk_score: float
    risk_category: str
    hazard_score: float
    population_exposure: float
    infrastructure_vulnerability: float
    accessibility_score: float
    historical_risk_score: float
    nearby_incident_count: int


class RiskZoneOut(RiskZoneProperties):
    geometry: dict


class RiskZoneFeature(BaseModel):
    type: Literal["Feature"] = "Feature"
    geometry: dict
    properties: RiskZoneProperties


class RiskMapResponse(BaseModel):
    type: Literal["FeatureCollection"] = "FeatureCollection"
    features: list[RiskZoneFeature]
