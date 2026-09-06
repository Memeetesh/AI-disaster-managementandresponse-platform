"""One-off demo data seeder: populates risk_zones (synthetic baseline grid
over the Chennai demo bounding box) and a handful of demo shelters.

This is SEED/DEMO data, not real GIS/census/shelter-registry data — every
shelter name is suffixed "(Demo)" so it's never mistaken for a real,
verified facility. Run once against a fresh database:

    cd backend && source venv/bin/activate
    python -m app.scripts.seed_demo_data          # skips if already seeded
    python -m app.scripts.seed_demo_data --force  # wipes and reseeds
"""
import argparse
import logging

from app.database import SessionLocal
from app.gis.points import make_point
from app.models.risk_zone import RiskZone
from app.models.shelter import Shelter
from app.risk.demo_baseline import CHENNAI_DEMO_BBOX, DEMO_CELL_SIZE_DEG, synthetic_baseline
from app.risk.grid import generate_grid

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seed_demo_data")

DEMO_SHELTERS = [
    {
        "name": "Zone 1 Community Hall (Demo)",
        "latitude": 13.02,
        "longitude": 80.22,
        "capacity": 200,
        "occupied": 40,
        "facilities": ["water", "power", "toilets"],
        "accessibility": "wheelchair_accessible",
    },
    {
        "name": "Coastal Relief Camp (Demo)",
        "latitude": 13.03,
        "longitude": 80.27,
        "capacity": 150,
        "occupied": 90,
        "facilities": ["water", "medical"],
        "accessibility": "limited_access",
    },
    {
        "name": "Central Municipal School Shelter (Demo)",
        "latitude": 13.05,
        "longitude": 80.24,
        "capacity": 300,
        "occupied": 60,
        "facilities": ["water", "power", "medical", "toilets"],
        "accessibility": "wheelchair_accessible",
    },
    {
        "name": "North Zone Sports Complex (Demo)",
        "latitude": 13.08,
        "longitude": 80.21,
        "capacity": 250,
        "occupied": 10,
        "facilities": ["water", "power"],
        "accessibility": "wheelchair_accessible",
    },
    {
        "name": "Riverside Relief Center (Demo)",
        "latitude": 13.09,
        "longitude": 80.28,
        "capacity": 120,
        "occupied": 115,
        "facilities": ["water"],
        "accessibility": "limited_access",
    },
]


def seed_risk_zones(db, force: bool) -> None:
    existing = db.query(RiskZone).count()
    if existing and not force:
        logger.info("risk_zones already has %d rows, skipping (use --force to reseed)", existing)
        return
    if existing:
        db.query(RiskZone).delete()

    cells = generate_grid(CHENNAI_DEMO_BBOX, DEMO_CELL_SIZE_DEG)
    for cell in cells:
        baseline = synthetic_baseline(cell, CHENNAI_DEMO_BBOX)
        db.add(RiskZone(geometry=cell.to_wkt_polygon(), risk_score=0.0, **baseline))
    db.commit()
    logger.info("seeded %d risk zones", len(cells))


def seed_shelters(db, force: bool) -> None:
    existing = db.query(Shelter).count()
    if existing and not force:
        logger.info("shelters already has %d rows, skipping (use --force to reseed)", existing)
        return
    if existing:
        db.query(Shelter).delete()

    for entry in DEMO_SHELTERS:
        db.add(
            Shelter(
                name=entry["name"],
                latitude=entry["latitude"],
                longitude=entry["longitude"],
                location=make_point(entry["latitude"], entry["longitude"]),
                capacity=entry["capacity"],
                occupied=entry["occupied"],
                facilities=entry["facilities"],
                accessibility=entry["accessibility"],
                status="open",
            )
        )
    db.commit()
    logger.info("seeded %d demo shelters", len(DEMO_SHELTERS))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="wipe and reseed even if data exists")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        seed_risk_zones(db, args.force)
        seed_shelters(db, args.force)
    finally:
        db.close()


if __name__ == "__main__":
    main()
