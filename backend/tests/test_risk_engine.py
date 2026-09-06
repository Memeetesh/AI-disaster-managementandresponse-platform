"""Pure unit tests — no database required."""
from app.risk.engine import classify_risk, compute_risk_score
from app.risk.grid import BoundingBox, generate_grid


def test_classify_risk_bands():
    assert classify_risk(0) == "low"
    assert classify_risk(20) == "low"
    assert classify_risk(21) == "moderate"
    assert classify_risk(40) == "moderate"
    assert classify_risk(41) == "high"
    assert classify_risk(60) == "high"
    assert classify_risk(61) == "very_high"
    assert classify_risk(80) == "very_high"
    assert classify_risk(81) == "critical"
    assert classify_risk(100) == "critical"


def test_compute_risk_score_matches_spec_example():
    # From the spec's explainability example: Hazard 91, Population 78,
    # Infrastructure 84, Accessibility 62, historical unspecified (using a
    # value that reproduces the example's Risk = 83).
    score = compute_risk_score(
        hazard=91, population_exposure=78, infrastructure_vulnerability=84, accessibility=62, historical_risk=70
    )
    assert 80 <= score <= 86


def test_compute_risk_score_clamped_to_0_100():
    assert compute_risk_score(200, 200, 200, 200, 200) == 100.0
    assert compute_risk_score(-50, -50, -50, -50, -50) == 0.0


def test_generate_grid_covers_bbox_without_gaps():
    bbox = BoundingBox(min_lon=0, min_lat=0, max_lon=0.1, max_lat=0.1)
    cells = generate_grid(bbox, cell_size_deg=0.04)
    # 0.1 / 0.04 -> 3 steps per axis (0.04, 0.04, 0.02 remainder) => 3x3
    assert len(cells) == 9
    assert min(c.min_lon for c in cells) == bbox.min_lon
    assert max(c.max_lon for c in cells) == bbox.max_lon
    assert min(c.min_lat for c in cells) == bbox.min_lat
    assert max(c.max_lat for c in cells) == bbox.max_lat
