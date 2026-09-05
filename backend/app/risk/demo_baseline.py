"""Synthetic baseline risk inputs for the demo grid — NOT real IMD rainfall,
census, or infrastructure data. There is no live rainfall/elevation/census
feed wired up yet (that's a later phase), so each cell's baseline hazard /
population-exposure / infrastructure-vulnerability / accessibility /
historical-risk is derived deterministically from its position in the demo
bounding box: higher hazard toward the coast (the east edge, modeling
storm-surge/coastal-flood exposure), higher population exposure toward the
city center, and a small fixed "jitter" per cell (hashed from its index, not
random — reproducible seeding) for visual variety. Swapping this for a real
elevation/rainfall/census source later only means replacing this module.
"""
import hashlib

from app.risk.grid import BoundingBox, GridCell

# Central Chennai, India — a recurring urban-flooding case study — as the
# demo bounding box. ~11km x 11km.
CHENNAI_DEMO_BBOX = BoundingBox(min_lon=80.20, min_lat=13.00, max_lon=80.30, max_lat=13.10)
DEMO_CELL_SIZE_DEG = 0.02  # ~2.2km per cell -> a 5x5 demo grid


def _jitter(seed: int, spread: float = 8.0) -> float:
    digest = hashlib.sha256(str(seed).encode()).hexdigest()
    unit = (int(digest[:8], 16) % 1000) / 1000  # deterministic pseudo-random in [0, 1)
    return (unit - 0.5) * 2 * spread


def _clamp(value: float) -> float:
    return max(0.0, min(100.0, value))


def synthetic_baseline(cell: GridCell, bbox: BoundingBox) -> dict[str, float]:
    lon_frac = (cell.center[0] - bbox.min_lon) / (bbox.max_lon - bbox.min_lon)
    lat_frac = (cell.center[1] - bbox.min_lat) / (bbox.max_lat - bbox.min_lat)
    dist_from_center = ((lon_frac - 0.5) ** 2 + (lat_frac - 0.5) ** 2) ** 0.5

    return {
        "hazard_score": _clamp(40 + lon_frac * 45 + _jitter(cell.index)),
        "population_exposure": _clamp(75 - dist_from_center * 90 + _jitter(cell.index + 1)),
        "infrastructure_vulnerability": _clamp(35 + dist_from_center * 40 + _jitter(cell.index + 2)),
        "accessibility_score": _clamp(30 + dist_from_center * 50 + lon_frac * 15 + _jitter(cell.index + 3)),
        "historical_risk_score": _clamp(30 + lon_frac * 40 + _jitter(cell.index + 4)),
    }
