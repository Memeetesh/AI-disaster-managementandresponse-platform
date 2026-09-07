from pydantic import BaseModel


class RainfallForecastOut(BaseModel):
    latitude: float
    longitude: float
    probability: int  # % chance of precipitation, next 48h
    rain_24h_mm: float
    rain_48h_mm: float
    current_precipitation_mm: float
    level: str  # low | moderate | high | critical
    recommendation: str
    trend: list[float]  # daily precipitation totals (mm), next 7 days
    source: str


class FloodForecastOut(BaseModel):
    latitude: float
    longitude: float
    flood_risk_score: int  # 0-100, for the card headline
    anomaly_ratio: float | None  # forecast peak discharge / recent-normal; null if no river
    current_discharge_m3s: float
    forecast_peak_m3s: float
    baseline_discharge_m3s: float
    level: str  # low | moderate | high | critical
    recommendation: str
    trend: list[float]  # daily river discharge (m³/s), next ~10 days
    source: str


class CycloneForecastOut(BaseModel):
    latitude: float
    longitude: float
    cyclone_risk_score: int  # 0-100, for the card headline
    peak_wind_kmh: float
    peak_gust_kmh: float
    min_pressure_hpa: float | None
    level: str  # low | moderate | high | critical
    recommendation: str
    trend: list[float]  # daily peak gusts (km/h), next 7 days
    source: str


class LandslideForecastOut(BaseModel):
    latitude: float
    longitude: float
    landslide_risk_score: int  # 0-100, for the card headline
    slope_degrees: float
    local_relief_m: float
    elevation_m: float
    antecedent_rain_mm: float
    forecast_rain_mm: float
    rain_trigger_mm: float
    level: str  # low | moderate | high | critical
    recommendation: str
    trend: list[float]  # daily precipitation (mm), forward
    source: str
