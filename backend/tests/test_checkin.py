"""Tests for citizen safety check-ins (Phase 3)."""
from app.core.security import hash_password
from app.models.user import User


def register_citizen(client, phone: str) -> str:
    resp = client.post(
        "/api/v1/auth/register",
        json={"name": "Citizen", "phone": phone, "password": "supersecret123"},
    )
    assert resp.status_code == 201
    return resp.json()["access_token"]


def make_responder(db_session, phone: str) -> User:
    user = User(
        name="Responder",
        phone=phone,
        hashed_password=hash_password("supersecret123"),
        role="responder",
    )
    db_session.add(user)
    db_session.commit()
    return user


def login(client, phone: str) -> str:
    resp = client.post("/api/v1/auth/login", json={"phone": phone, "password": "supersecret123"})
    assert resp.status_code == 200
    return resp.json()["access_token"]


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_check_in_round_trip(client):
    token = register_citizen(client, "8600000001")

    assert client.get("/api/v1/check-in/me", headers=auth_headers(token)).json() is None

    resp = client.post(
        "/api/v1/check-in",
        headers=auth_headers(token),
        json={"status": "safe", "latitude": 13.05, "longitude": 80.25},
    )
    assert resp.status_code == 201
    created = resp.json()
    assert created["status"] == "safe"
    assert created["latitude"] == 13.05

    latest = client.get("/api/v1/check-in/me", headers=auth_headers(token)).json()
    assert latest["id"] == created["id"]
    assert latest["status"] == "safe"


def test_check_in_returns_most_recent(client):
    token = register_citizen(client, "8600000002")
    client.post("/api/v1/check-in", headers=auth_headers(token), json={"status": "safe"})
    second = client.post(
        "/api/v1/check-in", headers=auth_headers(token), json={"status": "need_help"}
    )
    latest = client.get("/api/v1/check-in/me", headers=auth_headers(token)).json()
    assert latest["id"] == second.json()["id"]
    assert latest["status"] == "need_help"


def test_non_citizen_cannot_check_in(client, db_session):
    make_responder(db_session, "8600000009")
    token = login(client, "8600000009")
    resp = client.post("/api/v1/check-in", headers=auth_headers(token), json={"status": "safe"})
    assert resp.status_code == 403
