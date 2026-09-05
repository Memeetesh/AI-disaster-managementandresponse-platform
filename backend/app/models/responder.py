from geoalchemy2 import Geometry
from sqlalchemy import Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Responder(Base):
    __tablename__ = "responders"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    team: Mapped[str | None] = mapped_column(String(100), nullable=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    location: Mapped[str | None] = mapped_column(
        Geometry(geometry_type="POINT", srid=4326), nullable=True
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="available", index=True)
    vehicle: Mapped[str | None] = mapped_column(String(50), nullable=True)  # boat | ambulance | truck | on_foot
    capacity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
