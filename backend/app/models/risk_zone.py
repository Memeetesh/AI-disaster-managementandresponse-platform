from datetime import datetime

from geoalchemy2 import Geometry
from sqlalchemy import DateTime, Float, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class RiskZone(Base):
    """A grid cell / spatial polygon scored by the risk engine (see app/risk).

    risk_score is the weighted composite (0-100); the remaining *_score
    columns are its explainable inputs, each also 0-100, so the UI can show
    "Risk = 83 because Hazard=91, Population Exposure=78, ...".
    """

    __tablename__ = "risk_zones"

    id: Mapped[int] = mapped_column(primary_key=True)
    geometry: Mapped[str] = mapped_column(Geometry(geometry_type="POLYGON", srid=4326), nullable=False)
    risk_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0, index=True)
    hazard_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    population_exposure: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    infrastructure_vulnerability: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    accessibility_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    historical_risk_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
