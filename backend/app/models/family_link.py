from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class FamilyLink(Base):
    """A person a citizen added to their family safety circle, by phone.

    If that phone belongs to a registered Aasha Setu user, `member_user_id` is
    set and `status` starts as "pending" — that user must accept the link
    before the owner sees any live status or location. A phone that isn't a
    registered user is stored as "accepted" straight away (nothing to
    consent to; it's only a saved contact)."""

    __tablename__ = "family_links"
    __table_args__ = (UniqueConstraint("owner_id", "phone", name="uq_family_owner_phone"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    relation: Mapped[str | None] = mapped_column(String(40), nullable=True)
    member_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )
    # pending | accepted | declined
    status: Mapped[str] = mapped_column(String(12), nullable=False, default="accepted")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
