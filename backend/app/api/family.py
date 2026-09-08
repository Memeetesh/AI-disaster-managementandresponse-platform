"""Citizen family safety circle.

  * Add people by phone; a registered user must accept before you see
    their live status/location.
  * See incoming "someone added you" requests and accept / decline them.
  * Opt in / out of sharing your own live location with your circle, and
    push location pings while sharing is on.
"""
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.deps import require_role
from app.database import get_db
from app.events.broker import broker
from app.models.user import User
from app.schemas.family import (
    FamilyMemberCreate,
    FamilyMemberOut,
    FamilyRequestOut,
    FamilyRequestResponse,
    LocationPing,
    LocationSharingState,
    LocationSharingUpdate,
)
from app.services import family as family_service

router = APIRouter(tags=["family"])


def _nudge() -> None:
    """Broadcast a payload-free refetch hint to every citizen's app."""
    broker.publish("family.updated", {"reason": "family"})


@router.get("/family", response_model=list[FamilyMemberOut])
def list_family(
    lat: float | None = Query(None, ge=-90, le=90),
    lon: float | None = Query(None, ge=-180, le=180),
    current_user: User = Depends(require_role("citizen")),
    db: Session = Depends(get_db),
) -> list[FamilyMemberOut]:
    """The caller's circle. Pass the caller's `lat`/`lon` to get a
    `distance_km` to each member who is sharing their location."""
    return family_service.list_family(
        db, owner_id=current_user.id, origin_lat=lat, origin_lon=lon
    )


@router.post("/family", response_model=FamilyMemberOut, status_code=status.HTTP_201_CREATED)
def add_family_member(
    payload: FamilyMemberCreate,
    current_user: User = Depends(require_role("citizen")),
    db: Session = Depends(get_db),
) -> FamilyMemberOut:
    member = family_service.add_family_member(
        db,
        owner=current_user,
        name=payload.name,
        phone=payload.phone,
        relation=payload.relation,
    )
    _nudge()
    return member


@router.delete("/family/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_family_member(
    link_id: int,
    current_user: User = Depends(require_role("citizen")),
    db: Session = Depends(get_db),
) -> None:
    family_service.remove_family_member(db, owner_id=current_user.id, link_id=link_id)
    _nudge()


@router.get("/family/requests", response_model=list[FamilyRequestOut])
def list_requests(
    current_user: User = Depends(require_role("citizen")),
    db: Session = Depends(get_db),
) -> list[FamilyRequestOut]:
    """People who added the caller to their circle and are awaiting a reply."""
    return family_service.list_incoming_requests(db, user_id=current_user.id)


@router.post("/family/requests/{link_id}/respond", status_code=status.HTTP_204_NO_CONTENT)
def respond_to_request(
    link_id: int,
    payload: FamilyRequestResponse,
    current_user: User = Depends(require_role("citizen")),
    db: Session = Depends(get_db),
) -> None:
    family_service.respond_to_request(
        db, user_id=current_user.id, link_id=link_id, accept=payload.accept
    )
    _nudge()


@router.get("/family/location-sharing", response_model=LocationSharingState)
def get_location_sharing(
    current_user: User = Depends(require_role("citizen")),
    db: Session = Depends(get_db),
) -> LocationSharingState:
    return family_service.get_location_sharing(db, user_id=current_user.id)


@router.put("/family/location-sharing", response_model=LocationSharingState)
def set_location_sharing(
    payload: LocationSharingUpdate,
    current_user: User = Depends(require_role("citizen")),
    db: Session = Depends(get_db),
) -> LocationSharingState:
    state = family_service.set_location_sharing(
        db, user_id=current_user.id, enabled=payload.enabled
    )
    _nudge()
    return state


@router.post("/family/location-sharing/ping", response_model=LocationSharingState)
def location_ping(
    payload: LocationPing,
    current_user: User = Depends(require_role("citizen")),
    db: Session = Depends(get_db),
) -> LocationSharingState:
    state = family_service.record_ping(
        db,
        user_id=current_user.id,
        latitude=payload.latitude,
        longitude=payload.longitude,
    )
    _nudge()
    return state
