from datetime import datetime

from geoalchemy2 import Geometry
from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.incident_evidence import IncidentEvidence


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[int] = mapped_column(primary_key=True)
    type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    # Derived PostGIS point, kept in sync with latitude/longitude by the service
    # layer on write. Powers ST_DWithin / ST_Distance spatial queries.
    location: Mapped[str | None] = mapped_column(
        Geometry(geometry_type="POINT", srid=4326), nullable=True
    )
    severity: Mapped[str] = mapped_column(String(20), nullable=False, default="moderate", index=True)
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="reported", index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    reported_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    people_affected: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    evidence: Mapped[list[IncidentEvidence]] = relationship(
        back_populates="incident", cascade="all, delete-orphan", order_by=IncidentEvidence.created_at
    )
