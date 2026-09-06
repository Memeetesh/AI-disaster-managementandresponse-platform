"""Shared enums used for validation at the Pydantic/schema layer.

Deliberately NOT implemented as native Postgres ENUM types on the model
columns (those are plain String columns). A native enum requires an ALTER
TYPE migration every time a value is added, which fights the requirement
that new disaster types / statuses can be introduced later without pain.
Validation still happens strictly, just at the API boundary.
"""
from enum import StrEnum


class UserRole(StrEnum):
    CITIZEN = "citizen"
    RESPONDER = "responder"
    ADMIN = "admin"


class IncidentType(StrEnum):
    FLOOD = "flood"
    FIRE = "fire"
    EARTHQUAKE = "earthquake"
    CYCLONE = "cyclone"
    LANDSLIDE = "landslide"
    OTHER = "other"


class IncidentStatus(StrEnum):
    REPORTED = "reported"
    AI_VERIFIED = "ai_verified"
    HUMAN_REVIEW = "human_review"
    VERIFIED = "verified"
    REJECTED = "rejected"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"


class SeverityLevel(StrEnum):
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    VERY_HIGH = "very_high"
    CRITICAL = "critical"


class PriorityLevel(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ResponderStatus(StrEnum):
    AVAILABLE = "available"
    EN_ROUTE = "en_route"
    BUSY = "busy"
    OFFLINE = "offline"


class ShelterStatus(StrEnum):
    OPEN = "open"
    NEAR_FULL = "near_full"
    FULL = "full"
    CLOSED = "closed"


class RescueStatus(StrEnum):
    PENDING = "pending"
    ASSIGNED = "assigned"
    EN_ROUTE = "en_route"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ResourceStatus(StrEnum):
    AVAILABLE = "available"
    DEPLOYED = "deployed"
    DEPLETED = "depleted"


class AlertSource(StrEnum):
    IMD = "imd"
    SACHET = "sachet"
    SIMULATOR = "simulator"
    ADMIN = "admin"
