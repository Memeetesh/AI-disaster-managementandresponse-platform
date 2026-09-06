"""Test fixtures.

Requires a real Postgres+PostGIS instance reachable at DATABASE_URL (models
use PostGIS Geometry columns, which SQLite cannot represent).

The suite NEVER runs against DATABASE_URL directly — it always targets a
separate "<database>_test" database on the same server, created here if it
doesn't exist yet. This isn't just a style preference: the fixture below
calls Base.metadata.drop_all() at teardown, which would silently wipe a
real dev/demo database (this happened once — running pytest against the
seeded local Postgres dropped every table, alembic_version included).
Isolating onto a dedicated test database makes that class of mistake
impossible regardless of what DATABASE_URL happens to point at.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

from app import models  # noqa: F401  (registers all tables on Base.metadata)
from app.config import settings
from app.database import Base, get_db
from app.main import app
from app.services import simulator

_dev_url = make_url(settings.DATABASE_URL)
_test_db_name = f"{_dev_url.database}_test"
_test_url = _dev_url.set(database=_test_db_name)


def _ensure_test_database_exists() -> None:
    admin_engine = create_engine(_dev_url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    try:
        with admin_engine.connect() as conn:
            exists = conn.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": _test_db_name}
            ).scalar()
            if not exists:
                conn.execute(text(f'CREATE DATABASE "{_test_db_name}"'))
    finally:
        admin_engine.dispose()


# create_engine() itself doesn't connect — only _prepare_database() (called
# lazily, only by tests that request db_session/client) actually touches the
# network, so pure unit tests still run with zero database dependency.
engine = create_engine(_test_url, future=True)
TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


@pytest.fixture(autouse=True)
def _reset_simulator_state():
    """The simulator is deliberately an in-memory module-level singleton
    (see app/services/simulator.py) — reset it around every test so one
    test's "START DISASTER" can't leak into another's risk-score math."""
    simulator.stop()
    yield
    simulator.stop()


@pytest.fixture(scope="session")
def _prepare_database():
    """DB setup/teardown — only runs for tests that actually request
    db_session/client (directly or transitively), so pure unit tests (e.g.
    tests/test_risk_engine.py) can run without any database at all."""
    _ensure_test_database_exists()
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        conn.commit()
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db_session(_prepare_database):
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture()
def client(db_session):
    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
