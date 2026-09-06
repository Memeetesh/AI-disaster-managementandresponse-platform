"""Risk-zone read path. Every read recomputes risk_score from the zone's
baseline inputs PLUS two live signals: how many active incidents currently
sit near it, and the disaster simulator's rainfall/water-level/road-blockage
state (see app/services/simulator.py) — this is what keeps the risk map from
being "simply a static colored map": real incidents AND "START DISASTER"
both move it immediately. The recomputed score is also persisted
(risk_zones.risk_score/updated_at) so any other consumer reading the table
directly sees the same number.
"""
import json

from geoalchemy2 import Geography
from sqlalchemy import cast, func, select, update
from sqlalchemy.orm import Session

from app.models.incident import Incident
from app.models.risk_zone import RiskZone
from app.risk.engine import classify_risk, compute_risk_score
from app.services import simulator

ACTIVE_INCIDENT_STATUSES = ("reported", "ai_verified", "human_review", "verified", "in_progress")
NEARBY_INCIDENT_RADIUS_METERS = 2000
INCIDENT_HAZARD_BOOST_PER_INCIDENT = 6.0
INCIDENT_HAZARD_BOOST_CAP = 30.0


def _nearby_incident_count_subquery():
    return (
        select(func.count(Incident.id))
        .where(Incident.status.in_(ACTIVE_INCIDENT_STATUSES))
        .where(Incident.location.isnot(None))
        .where(
            func.ST_DWithin(
                cast(Incident.location, Geography),
                cast(func.ST_Centroid(RiskZone.geometry), Geography),
                NEARBY_INCIDENT_RADIUS_METERS,
            )
        )
        .correlate(RiskZone)
        .scalar_subquery()
    )


def compute_zones(db: Session, *, zone_id: int | None = None) -> list[dict]:
    stmt = select(
        RiskZone.id,
        RiskZone.hazard_score,
        RiskZone.population_exposure,
        RiskZone.infrastructure_vulnerability,
        RiskZone.accessibility_score,
        RiskZone.historical_risk_score,
        func.ST_AsGeoJSON(RiskZone.geometry).label("geometry_json"),
        _nearby_incident_count_subquery().label("nearby_incidents"),
    )
    if zone_id is not None:
        stmt = stmt.where(RiskZone.id == zone_id)

    rows = db.execute(stmt).all()

    sim_hazard_boost = simulator.hazard_boost()
    sim_accessibility_boost = simulator.accessibility_boost()

    results: list[dict] = []
    for row in rows:
        incident_boost = min(
            row.nearby_incidents * INCIDENT_HAZARD_BOOST_PER_INCIDENT, INCIDENT_HAZARD_BOOST_CAP
        )
        effective_hazard = min(100.0, row.hazard_score + incident_boost + sim_hazard_boost)
        effective_accessibility = min(100.0, row.accessibility_score + sim_accessibility_boost)
        risk_score = compute_risk_score(
            effective_hazard,
            row.population_exposure,
            row.infrastructure_vulnerability,
            effective_accessibility,
            row.historical_risk_score,
        )

        db.execute(
            update(RiskZone).where(RiskZone.id == row.id).values(risk_score=risk_score, updated_at=func.now())
        )

        results.append(
            {
                "id": row.id,
                "risk_score": round(risk_score, 1),
                "risk_category": classify_risk(risk_score),
                "hazard_score": round(effective_hazard, 1),
                "population_exposure": round(row.population_exposure, 1),
                "infrastructure_vulnerability": round(row.infrastructure_vulnerability, 1),
                "accessibility_score": round(effective_accessibility, 1),
                "historical_risk_score": round(row.historical_risk_score, 1),
                "nearby_incident_count": row.nearby_incidents,
                "geometry": json.loads(row.geometry_json),
            }
        )

    db.commit()
    return results
