from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.shelter import Shelter


def list_shelters(db: Session) -> list[Shelter]:
    return list(db.execute(select(Shelter).order_by(Shelter.name)).scalars().all())
