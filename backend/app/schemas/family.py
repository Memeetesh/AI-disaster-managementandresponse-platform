from datetime import datetime

from pydantic import BaseModel, Field


class FamilyMemberCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=6, max_length=20)
    relation: str | None = Field(default=None, max_length=40)


class FamilyMemberOut(BaseModel):
    id: int
    name: str
    phone: str
    relation: str | None
    on_drishti: bool
    # pending | accepted | declined
    link_status: str
    # not_registered | invite_pending | invite_declined
    #   | in_emergency | needs_help | safe | no_checkin
    status: str
    status_label: str
    last_check_in_at: datetime | None
    # live location — only populated for accepted members who turned sharing on
    shares_location: bool
    latitude: float | None
    longitude: float | None
    location_updated_at: datetime | None
    distance_km: float | None
    created_at: datetime


class FamilyRequestOut(BaseModel):
    """An incoming "someone added you to their family circle" request."""

    id: int
    owner_name: str
    relation: str | None
    created_at: datetime


class FamilyRequestResponse(BaseModel):
    accept: bool


class LocationSharingState(BaseModel):
    enabled: bool
    latitude: float | None = None
    longitude: float | None = None
    updated_at: datetime | None = None


class LocationSharingUpdate(BaseModel):
    enabled: bool


class LocationPing(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
