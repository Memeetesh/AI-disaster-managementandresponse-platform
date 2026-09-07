"""Incident priority engine (no AI).

`priority = f(severity, people affected, risk-zone score at the incident
point, how long it has been waiting)`. Pure and deterministic — the AI
confidence field is deliberately NOT an input (it is always 0.0 until a
later phase, and priority must work without it).
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.incident import Incident
from app.models.risk_zone import RiskZone

_SEVERITY_WEIGHT = {
    "low": 10.0,
    "moderate": 30.0,
    "high": 55.0,
    "very_high": 75.0,
    "critical": 95.0,
}


def compute_priority_score(
    *,
    severity: str,
    people_affected: int,
    zone_risk_score: float,
    age_minutes: float,
) -> float:
    """0–100. Higher = dispatch sooner."""
    score = _SEVERITY_WEIGHT.get(severity, 30.0)
    score += min(people_affected, 20) * 1.5  # up to +30
    score += zone_risk_score * 0.2  # up to +20
    score += min(age_minutes / 60.0, 6.0) * 3.0  # up to +18 as it waits
    return max(0.0, min(100.0, score))


def classify_priority(score: float) -> str:
    if score < 25:
        return "low"
    if score < 50:
        return "medium"
    if score < 75:
        return "high"
    return "critical"


def _zone_risk_by_incident(db: Session, incident_ids: list[int]) -> dict[int, float]:
    """risk_zones.risk_score of the grid cell each incident sits in (0 if
    the incident falls outside the demo grid)."""
    if not incident_ids:
        return {}
    stmt = (
        select(Incident.id, func.coalesce(func.max(RiskZone.risk_score), 0.0))
        .select_from(Incident)
        .outerjoin(RiskZone, func.ST_Contains(RiskZone.geometry, Incident.location))
        .where(Incident.id.in_(incident_ids))
        .group_by(Incident.id)
    )
    return {row[0]: float(row[1]) for row in db.execute(stmt).all()}


def annotate_priorities(db: Session, incidents: list[Incident]) -> dict[int, tuple[str, float]]:
    """{incident_id: (priority_label, score)} for a batch of incidents."""
    if not incidents:
        return {}
    zone_risk = _zone_risk_by_incident(db, [i.id for i in incidents])
    now = datetime.now(timezone.utc)
    out: dict[int, tuple[str, float]] = {}
    for inc in incidents:
        created = inc.created_at
        if created is not None and created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        age_minutes = (now - created).total_seconds() / 60.0 if created else 0.0
        score = compute_priority_score(
            severity=inc.severity,
            people_affected=inc.people_affected or 0,
            zone_risk_score=zone_risk.get(inc.id, 0.0),
            age_minutes=age_minutes,
        )
        out[inc.id] = (classify_priority(score), round(score, 1))
    return out


def active_priority_for_incident(db: Session, incident: Incident) -> str:
    """Single-incident convenience (used when creating a rescue op)."""
    return annotate_priorities(db, [incident]).get(incident.id, ("medium", 0.0))[0]
