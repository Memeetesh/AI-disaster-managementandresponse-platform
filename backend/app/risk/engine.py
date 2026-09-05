"""The risk formula from the spec, kept as pure functions with no DB/HTTP
dependency so it's trivially unit-testable and reusable from the simulator
(Phase 4) and the priority engine (Phase 8).

Risk Score = 0.35*Hazard + 0.25*PopulationExposure + 0.20*InfrastructureVulnerability
             + 0.10*Accessibility + 0.10*HistoricalRisk

All five inputs and the output are 0-100. "Accessibility" here means
*inaccessibility* (higher = harder to reach / more blocked), matching the
spec's example (Accessibility: 65 contributing positively to Risk: 82) —
poor accessibility raises risk, it doesn't lower it.
"""
from app.config import settings

_BANDS = (
    (20, "low"),
    (40, "moderate"),
    (60, "high"),
    (80, "very_high"),
)


def classify_risk(score: float) -> str:
    for ceiling, label in _BANDS:
        if score <= ceiling:
            return label
    return "critical"


def compute_risk_score(
    hazard: float,
    population_exposure: float,
    infrastructure_vulnerability: float,
    accessibility: float,
    historical_risk: float,
) -> float:
    score = (
        settings.RISK_WEIGHT_HAZARD * hazard
        + settings.RISK_WEIGHT_POPULATION * population_exposure
        + settings.RISK_WEIGHT_INFRASTRUCTURE * infrastructure_vulnerability
        + settings.RISK_WEIGHT_ACCESSIBILITY * accessibility
        + settings.RISK_WEIGHT_HISTORICAL * historical_risk
    )
    return max(0.0, min(100.0, score))
