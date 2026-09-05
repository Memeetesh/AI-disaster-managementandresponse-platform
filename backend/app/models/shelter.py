from geoalchemy2 import Geometry
from sqlalchemy import Float, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Shelter(Base):
    __tablename__ = "shelters"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    location: Mapped[str | None] = mapped_column(
        Geometry(geometry_type="POINT", srid=4326), nullable=True
    )
    capacity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    occupied: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    facilities: Mapped[list | None] = mapped_column(JSON, nullable=True)  # ["water", "medical", "power"]
    accessibility: Mapped[str | None] = mapped_column(String(50), nullable=True)  # e.g. "wheelchair_accessible"
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open", index=True)
