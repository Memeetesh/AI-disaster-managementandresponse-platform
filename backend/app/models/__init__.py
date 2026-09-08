"""Import every model here so Alembic autogenerate and Base.metadata.create_all
see the full schema from a single import of `app.models`.
"""
from app.models.alert import Alert
from app.models.check_in import CheckIn
from app.models.family_link import FamilyLink
from app.models.incident import Incident
from app.models.incident_evidence import IncidentEvidence
from app.models.location_share import LocationShare
from app.models.rescue_operation import RescueOperation
from app.models.resource import Resource
from app.models.responder import Responder
from app.models.risk_zone import RiskZone
from app.models.shelter import Shelter
from app.models.user import User

__all__ = [
    "Alert",
    "CheckIn",
    "FamilyLink",
    "Incident",
    "IncidentEvidence",
    "LocationShare",
    "RescueOperation",
    "Resource",
    "Responder",
    "RiskZone",
    "Shelter",
    "User",
]
