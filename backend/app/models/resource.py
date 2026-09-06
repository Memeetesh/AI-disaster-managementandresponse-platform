from geoalchemy2 import Geometry
from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Resource(Base):
    __tablename__ = "resources"

    id: Mapped[int] = mapped_column(primary_key=True)
    type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # boat | ambulance | food | water | medical_kit
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    location: Mapped[str | None] = mapped_column(
        Geometry(geometry_type="POINT", srid=4326), nullable=True
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="available", index=True)
