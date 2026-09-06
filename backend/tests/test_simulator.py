from app.core.security import hash_password
from app.models.user import User
from app.services import simulator


# --- Pure unit tests (no database) ---


def test_hazard_boost_zero_when_calm():
    simulator.stop()
    assert simulator.hazard_boost() == 0.0
    assert simulator.accessibility_boost() == 0.0


def test_hazard_boost_increases_with_rainfall_and_water_level():
    simulator.set_state(rainfall_mm=300, water_level_m=5)
    assert simulator.hazard_boost() == simulator.MAX_HAZARD_BOOST


def test_accessibility_boost_scales_with_road_blockage():
    simulator.set_state(road_blockage_pct=50)
    assert simulator.accessibility_boost() == simulator.MAX_ACCESSIBILITY_BOOST / 2


def test_start_sets_active_and_stop_resets():
    state = simulator.start(rainfall_mm=200, water_level_m=3, road_blockage_pct=20)
    assert state.active is True
    assert state.rainfall_mm == 200
    reset = simulator.stop()
    assert reset.active is False
    assert reset.rainfall_mm == 0.0


# --- Integration tests (need a real Postgres+PostGIS DB) ---


def register_citizen(client, phone: str) -> str:
    resp = client.post(
        "/api/v1/auth/register",
        json={"name": "Citizen", "phone": phone, "password": "supersecret123"},
    )
    assert resp.status_code == 201
    return resp.json()["access_token"]


def make_admin(db_session, phone: str) -> User:
    user = User(name="Admin", phone=phone, hashed_password=hash_password("supersecret123"), role="admin")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def login(client, phone: str) -> str:
    resp = client.post("/api/v1/auth/login", json={"phone": phone, "password": "supersecret123"})
    assert resp.status_code == 200
    return resp.json()["access_token"]


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_citizen_cannot_control_simulator(client, db_session):
    token = register_citizen(client, "8200000001")
    resp = client.post("/api/v1/simulator/start", headers=auth_headers(token), json={})
    assert resp.status_code == 403


def test_admin_can_start_and_stop_simulator(client, db_session):
    make_admin(db_session, "8200000002")
    token = login(client, "8200000002")

    resp = client.post(
        "/api/v1/simulator/start",
        headers=auth_headers(token),
        json={"rainfall_mm": 250, "water_level_m": 4, "road_blockage_pct": 60},
    )
    assert resp.status_code == 200
    assert resp.json()["active"] is True

    resp = client.get("/api/v1/simulator/state", headers=auth_headers(token))
    assert resp.json()["rainfall_mm"] == 250

    resp = client.post("/api/v1/simulator/stop", headers=auth_headers(token))
    assert resp.status_code == 200
    assert resp.json()["active"] is False


def test_starting_simulator_raises_risk_zone_scores(client, db_session):
    from tests.test_risk_and_shelters import make_zone

    zone = make_zone(db_session)
    make_admin(db_session, "8200000003")
    admin_token = login(client, "8200000003")
    citizen_token = register_citizen(client, "8200000004")

    baseline = client.get(f"/api/v1/risk-zones/{zone.id}", headers=auth_headers(citizen_token)).json()

    client.post(
        "/api/v1/simulator/start",
        headers=auth_headers(admin_token),
        json={"rainfall_mm": 300, "water_level_m": 5, "road_blockage_pct": 80},
    )

    boosted = client.get(f"/api/v1/risk-zones/{zone.id}", headers=auth_headers(citizen_token)).json()

    assert boosted["hazard_score"] > baseline["hazard_score"]
    assert boosted["accessibility_score"] > baseline["accessibility_score"]
    assert boosted["risk_score"] > baseline["risk_score"]


def test_spawn_incidents_creates_requested_count(client, db_session):
    make_admin(db_session, "8200000005")
    admin_token = login(client, "8200000005")

    resp = client.post(
        "/api/v1/simulator/spawn-incidents",
        headers=auth_headers(admin_token),
        json={"count": 4, "max_people_affected": 3},
    )
    assert resp.status_code == 200
    incidents = resp.json()
    assert len(incidents) == 4
    for incident in incidents:
        assert incident["type"] == "flood"
        assert incident["reported_by"] is None
        assert "simulator" in incident["description"].lower()
        assert 0 <= incident["people_affected"] <= 3
