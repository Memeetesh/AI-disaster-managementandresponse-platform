"""Pure tests for the incident priority engine (no database, no AI input)."""
from app.services.priority import classify_priority, compute_priority_score


def test_classify_priority_bands():
    assert classify_priority(0) == "low"
    assert classify_priority(24.9) == "low"
    assert classify_priority(25) == "medium"
    assert classify_priority(49.9) == "medium"
    assert classify_priority(50) == "high"
    assert classify_priority(74.9) == "high"
    assert classify_priority(75) == "critical"
    assert classify_priority(100) == "critical"


def test_score_increases_with_severity():
    base = dict(people_affected=0, zone_risk_score=0.0, age_minutes=0.0)
    low = compute_priority_score(severity="low", **base)
    moderate = compute_priority_score(severity="moderate", **base)
    critical = compute_priority_score(severity="critical", **base)
    assert low < moderate < critical


def test_score_increases_with_people_zone_and_age():
    base = dict(severity="moderate")
    quiet = compute_priority_score(people_affected=0, zone_risk_score=0.0, age_minutes=0.0, **base)
    crowded = compute_priority_score(people_affected=15, zone_risk_score=0.0, age_minutes=0.0, **base)
    risky = compute_priority_score(people_affected=0, zone_risk_score=90.0, age_minutes=0.0, **base)
    stale = compute_priority_score(people_affected=0, zone_risk_score=0.0, age_minutes=600.0, **base)
    assert crowded > quiet
    assert risky > quiet
    assert stale > quiet


def test_score_is_clamped_and_extremes_classify():
    worst = compute_priority_score(
        severity="critical", people_affected=99, zone_risk_score=100.0, age_minutes=99999.0
    )
    assert worst == 100.0
    assert classify_priority(worst) == "critical"

    calmest = compute_priority_score(
        severity="low", people_affected=0, zone_risk_score=0.0, age_minutes=0.0
    )
    assert 0.0 <= calmest <= 100.0
    assert classify_priority(calmest) == "low"
