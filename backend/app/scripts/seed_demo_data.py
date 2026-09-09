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
from datetime import datetime, timezone

from app.core.security import hash_password
from app.database import SessionLocal
from app.gis.points import make_point
from app.models.alert import Alert
from app.models.responder import Responder
from app.models.risk_zone import RiskZone
from app.models.shelter import Shelter
from app.models.user import User
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


DEMO_ALERTS = [
    {
        "type": "flood_warning",
        "severity": "high",
        "message": (
            "IMD (Demo): Heavy to very heavy rainfall likely over Chennai and suburbs in the next "
            "24 hours. Residents in low-lying areas should move to higher ground and keep an "
            "emergency kit ready."
        ),
    },
    {
        "type": "advisory",
        "severity": "moderate",
        "message": (
            "City Disaster Cell (Demo): Note your nearest shelter, charge your phones, and keep "
            "documents in a waterproof bag. Call 112 or use the SOS button if you need help."
        ),
    },
]


DEMO_RESPONDERS = [
    {"name": "Boat Team Alpha (Demo)", "team": "NDRF-7", "latitude": 13.03, "longitude": 80.23, "vehicle": "boat", "capacity": 6},
    {"name": "Ambulance Unit 12 (Demo)", "team": "108 EMRI", "latitude": 13.06, "longitude": 80.26, "vehicle": "ambulance", "capacity": 2},
    {"name": "Rescue Truck Bravo (Demo)", "team": "Fire & Rescue", "latitude": 13.08, "longitude": 80.22, "vehicle": "truck", "capacity": 8},
    {"name": "Boat Team Charlie (Demo)", "team": "SDRF", "latitude": 13.09, "longitude": 80.29, "vehicle": "boat", "capacity": 6},
    {"name": "Foot Patrol Delta (Demo)", "team": "Civil Defence", "latitude": 13.05, "longitude": 80.25, "vehicle": "on_foot", "capacity": 3},
]


def seed_responders(db, force: bool) -> None:
    existing = db.query(Responder).count()
    if existing and not force:
        logger.info("responders already has %d rows, skipping (use --force to reseed)", existing)
        return
    if existing:
        db.query(Responder).delete()

    for entry in DEMO_RESPONDERS:
        db.add(
            Responder(
                name=entry["name"],
                team=entry["team"],
                latitude=entry["latitude"],
                longitude=entry["longitude"],
                location=make_point(entry["latitude"], entry["longitude"]),
                status="available",
                vehicle=entry["vehicle"],
                capacity=entry["capacity"],
            )
        )
    db.commit()
    logger.info("seeded %d demo responders", len(DEMO_RESPONDERS))


def seed_alerts(db, force: bool) -> None:
    existing = db.query(Alert).count()
    if existing and not force:
        logger.info("alerts already has %d rows, skipping (use --force to reseed)", existing)
        return
    if existing:
        db.query(Alert).delete()

    now = datetime.now(timezone.utc)
    for entry in DEMO_ALERTS:
        db.add(
            Alert(
                source="admin",
                type=entry["type"],
                severity=entry["severity"],
                message=entry["message"],
                issued_at=now,
                expires_at=None,
            )
        )
    db.commit()
    logger.info("seeded %d demo alerts", len(DEMO_ALERTS))


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


# Shared demo identities. Login/registration is removed for the *citizen*
# demo build — the frontend auto-signs-in as the resident so the app opens
# straight to the home screen. The operator account is what you log into on
# the /login page to reach the responder dashboard (e.g. to watch an SOS
# from the Android app land live). Not real users; safe to reset.
DEMO_USERS = [
    {
        "name": "Demo Resident",
        "phone": "9000000000",
        "password": "drishtidemo",
        "role": "citizen",
    },
    {
        "name": "Command Center Admin",
        "phone": "9000000001",
        "password": "drishtiops",
        "role": "admin",
    },
]


def _upsert_user(db, spec: dict, force: bool) -> None:
    existing = db.query(User).filter(User.phone == spec["phone"]).first()
    if existing is not None:
        if force:
            existing.name = spec["name"]
            existing.role = spec["role"]
            existing.hashed_password = hash_password(spec["password"])
            db.commit()
            logger.info("reset demo user %s (%s)", spec["phone"], spec["role"])
        else:
            logger.info("demo user %s already exists, skipping", spec["phone"])
        return
    db.add(
        User(
            name=spec["name"],
            phone=spec["phone"],
            hashed_password=hash_password(spec["password"]),
            role=spec["role"],
        )
    )
    db.commit()
    logger.info("seeded demo user %s (%s)", spec["phone"], spec["role"])


def seed_demo_user(db, force: bool) -> None:
    for spec in DEMO_USERS:
        _upsert_user(db, spec, force)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="wipe and reseed even if data exists")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        seed_demo_user(db, args.force)
        seed_risk_zones(db, args.force)
        seed_shelters(db, args.force)
        seed_responders(db, args.force)
        seed_alerts(db, args.force)
    finally:
        db.close()


if __name__ == "__main__":
    main()
