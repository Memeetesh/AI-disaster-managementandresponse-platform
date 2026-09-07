"""Tests for the alerts API + simulator-driven alerts (Phase 2)."""
from app.core.security import hash_password
from app.models.user import User


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


def test_citizen_can_list_alerts(client):
    token = register_citizen(client, "8400000001")
    resp = client.get("/api/v1/alerts", headers=auth_headers(token))
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_citizen_cannot_create_alert(client):
    token = register_citizen(client, "8400000002")
    resp = client.post(
        "/api/v1/alerts",
        headers=auth_headers(token),
        json={"type": "flood_warning", "message": "test"},
    )
    assert resp.status_code == 403


def test_admin_creates_alert_and_it_appears_in_active_list(client, db_session):
    make_admin(db_session, "8400000009")
    admin_token = login(client, "8400000009")
    citizen_token = register_citizen(client, "8400000003")

    resp = client.post(
        "/api/v1/alerts",
        headers=auth_headers(admin_token),
        json={"type": "flood_warning", "severity": "high", "message": "Move to higher ground."},
    )
    assert resp.status_code == 201
    created = resp.json()
    assert created["source"] == "admin"
    assert created["severity"] == "high"

    listed = client.get("/api/v1/alerts", headers=auth_headers(citizen_token)).json()
    assert any(a["id"] == created["id"] and a["message"] == "Move to higher ground." for a in listed)


def test_simulator_start_raises_alert_and_stop_clears_it(client, db_session):
    make_admin(db_session, "8400000010")
    admin_token = login(client, "8400000010")

    before = client.get("/api/v1/alerts", headers=auth_headers(admin_token)).json()

    client.post(
        "/api/v1/simulator/start",
        headers=auth_headers(admin_token),
        json={"rainfall_mm": 260, "water_level_m": 4, "road_blockage_pct": 55},
    )
    during = client.get("/api/v1/alerts", headers=auth_headers(admin_token)).json()
    sim_alerts = [a for a in during if a["source"] == "simulator"]
    assert len(sim_alerts) == 1
    assert "Simulated severe weather" in sim_alerts[0]["message"]

    # Nudging a slider updates the standing alert rather than stacking a new one.
    client.patch(
        "/api/v1/simulator/state",
        headers=auth_headers(admin_token),
        json={"rainfall_mm": 280},
    )
    client.post(
        "/api/v1/simulator/start",
        headers=auth_headers(admin_token),
        json={"rainfall_mm": 280, "water_level_m": 4, "road_blockage_pct": 55},
    )
    still = client.get("/api/v1/alerts", headers=auth_headers(admin_token)).json()
    assert len([a for a in still if a["source"] == "simulator"]) == 1

    client.post("/api/v1/simulator/stop", headers=auth_headers(admin_token))
    after = client.get("/api/v1/alerts", headers=auth_headers(admin_token)).json()
    assert not [a for a in after if a["source"] == "simulator"]
    assert len(after) == len(before)
