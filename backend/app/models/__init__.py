"""Import every model here so Alembic autogenerate and Base.metadata.create_all
see the full schema from a single import of `app.models`.
"""
from app.models.alert import Alert
from app.models.incident import Incident
from app.models.incident_evidence import IncidentEvidence
from app.models.rescue_operation import RescueOperation
from app.models.resource import Resource
from app.models.responder import Responder
from app.models.risk_zone import RiskZone
from app.models.shelter import Shelter
from app.models.user import User

__all__ = [
    "Alert",
    "Incident",
    "IncidentEvidence",
    "RescueOperation",
    "Resource",
    "Responder",
    "RiskZone",
    "Shelter",
    "User",
]
