"""Family safety circle.

A citizen saves people by phone number. If a saved phone belongs to a
registered Aasha Setu user, the link starts as **pending** — that user must
accept it before the owner sees anything. Once accepted, the owner sees the
member's live safety status (from their check-ins / active SOS) and, if the
member has separately turned on location sharing, their last known point.

Privacy:
  * Live status/location is gated on the member's explicit acceptance.
  * Location sharing is a second, separate opt-in the member controls, and
    can turn off at any time (which clears the stored point).
  * The SSE `family.updated` event carries no names, phones or coordinates
    — it's a bare "refetch" nudge (see app/api/stream.py::_visible_to).
"""
from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.check_in import CheckIn
from app.models.family_link import FamilyLink
from app.models.incident import Incident
from app.models.location_share import LocationShare
from app.models.user import User
from app.schemas.family import (
    FamilyMemberOut,
    FamilyRequestOut,
    LocationSharingState,
)

# A "safe" check-in older than this no longer counts as current.
_CHECK_IN_FRESH = timedelta(hours=24)

# Incident statuses that mean "this is still an open emergency".
_ACTIVE_INCIDENT_STATUSES = (
    "reported",
    "ai_verified",
    "human_review",
    "verified",
    "in_progress",
)

_STATUS_LABELS = {
    "not_registered": "Not on Aasha Setu",
    "invite_pending": "Invite pending",
    "invite_declined": "Invite declined",
    "in_emergency": "In emergency",
    "needs_help": "Needs help",
    "safe": "Safe",
    "no_checkin": "No recent check-in",
}


def _normalise_phone(phone: str) -> str:
    """Reduce to digits and keep the last 10 (Indian mobile length) so
    "+91 98765 43210" and "9876543210" match the same user."""
    digits = "".join(ch for ch in phone if ch.isdigit())
    return digits[-10:] if len(digits) >= 10 else digits


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0088
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _find_user_by_phone(db: Session, phone: str) -> User | None:
    user = db.execute(select(User).where(User.phone == phone)).scalars().first()
    if user is not None:
        return user
    tail = _normalise_phone(phone)
    if len(tail) < 10:
        return None
    return db.execute(select(User).where(User.phone.like(f"%{tail}"))).scalars().first()


def _as_utc(dt: datetime | None) -> datetime | None:
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _live_status(db: Session, member_id: int) -> tuple[str, datetime | None]:
    """(status_code, last_check_in_at) for an accepted, registered member."""
    active_emergency = (
        db.execute(
            select(Incident.id)
            .where(Incident.reported_by == member_id)
            .where(Incident.severity == "critical")
            .where(Incident.status.in_(_ACTIVE_INCIDENT_STATUSES))
            .limit(1)
        )
        .scalars()
        .first()
    )
    if active_emergency is not None:
        return "in_emergency", None

    latest = (
        db.execute(
            select(CheckIn)
            .where(CheckIn.user_id == member_id)
            .order_by(CheckIn.created_at.desc())
            .limit(1)
        )
        .scalars()
        .first()
    )
    if latest is None:
        return "no_checkin", None
    if latest.status == "need_help":
        return "needs_help", latest.created_at

    created = _as_utc(latest.created_at)
    if created is not None and datetime.now(timezone.utc) - created <= _CHECK_IN_FRESH:
        return "safe", latest.created_at
    return "no_checkin", latest.created_at


def _location_for(db: Session, member_id: int) -> LocationShare | None:
    share = (
        db.execute(select(LocationShare).where(LocationShare.user_id == member_id))
        .scalars()
        .first()
    )
    if share and share.enabled and share.latitude is not None and share.longitude is not None:
        return share
    return None


def _to_out(
    db: Session,
    link: FamilyLink,
    *,
    origin_lat: float | None = None,
    origin_lon: float | None = None,
) -> FamilyMemberOut:
    on_drishti = link.member_user_id is not None
    status_code: str
    last_check_in_at: datetime | None = None
    share: LocationShare | None = None

    if not on_drishti:
        status_code = "not_registered"
    elif link.status == "pending":
        status_code = "invite_pending"
    elif link.status == "declined":
        status_code = "invite_declined"
    else:  # accepted
        status_code, last_check_in_at = _live_status(db, link.member_user_id)  # type: ignore[arg-type]
        share = _location_for(db, link.member_user_id)  # type: ignore[arg-type]

    distance_km: float | None = None
    if share is not None and origin_lat is not None and origin_lon is not None:
        distance_km = round(
            _haversine_km(origin_lat, origin_lon, share.latitude, share.longitude), 2
        )

    return FamilyMemberOut(
        id=link.id,
        name=link.name,
        phone=link.phone,
        relation=link.relation,
        on_drishti=on_drishti,
        link_status=link.status,
        status=status_code,
        status_label=_STATUS_LABELS.get(status_code, "Unknown"),
        last_check_in_at=last_check_in_at,
        shares_location=share is not None,
        latitude=share.latitude if share else None,
        longitude=share.longitude if share else None,
        location_updated_at=_as_utc(share.updated_at) if share else None,
        distance_km=distance_km,
        created_at=link.created_at,
    )


def _upgrade_unlinked(db: Session, links: list[FamilyLink]) -> None:
    """A contact saved before its owner registered (member_user_id is null)
    but whose phone now matches a user: attach it and drop it back to
    pending so that user gets the chance to accept."""
    changed = False
    for link in links:
        if link.member_user_id is not None:
            continue
        user = _find_user_by_phone(db, link.phone)
        if user is not None and user.id != link.owner_id:
            link.member_user_id = user.id
            link.status = "pending"
            changed = True
    if changed:
        db.commit()


def list_family(
    db: Session,
    *,
    owner_id: int,
    origin_lat: float | None = None,
    origin_lon: float | None = None,
) -> list[FamilyMemberOut]:
    links = list(
        db.execute(
            select(FamilyLink)
            .where(FamilyLink.owner_id == owner_id)
            .order_by(FamilyLink.created_at.asc())
        )
        .scalars()
        .all()
    )
    _upgrade_unlinked(db, links)
    return [_to_out(db, link, origin_lat=origin_lat, origin_lon=origin_lon) for link in links]


def add_family_member(
    db: Session,
    *,
    owner: User,
    name: str,
    phone: str,
    relation: str | None,
) -> FamilyMemberOut:
    phone = phone.strip()
    if _normalise_phone(phone) and _normalise_phone(phone) == _normalise_phone(owner.phone):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You can't add your own number.",
        )
    existing = (
        db.execute(
            select(FamilyLink)
            .where(FamilyLink.owner_id == owner.id)
            .where(FamilyLink.phone == phone)
            .limit(1)
        )
        .scalars()
        .first()
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That phone number is already in your family circle.",
        )

    member = _find_user_by_phone(db, phone)
    link = FamilyLink(
        owner_id=owner.id,
        name=name.strip(),
        phone=phone,
        relation=relation.strip() if relation else None,
        member_user_id=member.id if member else None,
        status="pending" if member else "accepted",
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    return _to_out(db, link)


def remove_family_member(db: Session, *, owner_id: int, link_id: int) -> None:
    link = db.get(FamilyLink, link_id)
    if link is None or link.owner_id != owner_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Family member not found"
        )
    db.delete(link)
    db.commit()


# --- incoming requests (the member's side) ----------------------------------


def list_incoming_requests(db: Session, *, user_id: int) -> list[FamilyRequestOut]:
    rows = db.execute(
        select(FamilyLink, User.name)
        .join(User, User.id == FamilyLink.owner_id)
        .where(FamilyLink.member_user_id == user_id)
        .where(FamilyLink.status == "pending")
        .order_by(FamilyLink.created_at.asc())
    ).all()
    return [
        FamilyRequestOut(
            id=link.id,
            owner_name=owner_name,
            relation=link.relation,
            created_at=link.created_at,
        )
        for link, owner_name in rows
    ]


def respond_to_request(
    db: Session, *, user_id: int, link_id: int, accept: bool
) -> None:
    link = db.get(FamilyLink, link_id)
    if link is None or link.member_user_id != user_id or link.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Request not found"
        )
    link.status = "accepted" if accept else "declined"
    db.commit()


# --- location sharing (the member's own opt-in) ---------------------------


def _get_or_create_share(db: Session, user_id: int) -> LocationShare:
    share = (
        db.execute(select(LocationShare).where(LocationShare.user_id == user_id))
        .scalars()
        .first()
    )
    if share is None:
        share = LocationShare(user_id=user_id, enabled=False)
        db.add(share)
        db.commit()
        db.refresh(share)
    return share


def _to_state(share: LocationShare) -> LocationSharingState:
    return LocationSharingState(
        enabled=share.enabled,
        latitude=share.latitude,
        longitude=share.longitude,
        updated_at=_as_utc(share.updated_at) if share.latitude is not None else None,
    )


def get_location_sharing(db: Session, *, user_id: int) -> LocationSharingState:
    return _to_state(_get_or_create_share(db, user_id))


def set_location_sharing(
    db: Session, *, user_id: int, enabled: bool
) -> LocationSharingState:
    share = _get_or_create_share(db, user_id)
    share.enabled = enabled
    if not enabled:
        share.latitude = None
        share.longitude = None
    db.commit()
    db.refresh(share)
    return _to_state(share)


def record_ping(
    db: Session, *, user_id: int, latitude: float, longitude: float
) -> LocationSharingState:
    share = _get_or_create_share(db, user_id)
    if not share.enabled:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Turn on location sharing before sending your location.",
        )
    share.latitude = latitude
    share.longitude = longitude
    share.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(share)
    return _to_state(share)
