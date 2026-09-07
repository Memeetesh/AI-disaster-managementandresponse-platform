"""Tests for shelter intelligence: nearest search + management PATCH (Phase 3)."""
from app.core.security import hash_password
from app.gis.points import make_point
from app.models.shelter import Shelter
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
    return user


def login(client, phone: str) -> str:
    resp = client.post("/api/v1/auth/login", json={"phone": phone, "password": "supersecret123"})
    assert resp.status_code == 200
    return resp.json()["access_token"]


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# Deliberately far from the Chennai demo area so shelters committed by other
# test files (the test DB is shared and rollback doesn't undo commits) can't
# interleave with these fixtures.
_ANCHOR_LAT, _ANCHOR_LON = 22.500, 78.500
_SHELTER_NAMES = ("SH Near", "SH Mid", "SH Far")


def _seed_shelters(db_session) -> None:
    rows = [
        (_SHELTER_NAMES[0], _ANCHOR_LAT, _ANCHOR_LON),
        (_SHELTER_NAMES[1], _ANCHOR_LAT + 0.05, _ANCHOR_LON + 0.05),
        (_SHELTER_NAMES[2], _ANCHOR_LAT + 0.20, _ANCHOR_LON + 0.20),
    ]
    for name, lat, lon in rows:
        db_session.add(
            Shelter(
                name=name,
                latitude=lat,
                longitude=lon,
                location=make_point(lat, lon),
                capacity=100,
                occupied=10,
                facilities=["water"],
                accessibility="wheelchair_accessible",
                status="open",
            )
        )
    db_session.commit()


def test_nearest_shelters_ordered_by_distance(client, db_session):
    _seed_shelters(db_session)
    token = register_citizen(client, "8700000001")
    resp = client.get(
        "/api/v1/shelters/nearest",
        params={"lat": _ANCHOR_LAT, "lon": _ANCHOR_LON, "limit": 20},
        headers=auth_headers(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    mine = [s for s in body if s["name"] in _SHELTER_NAMES]
    assert [s["name"] for s in mine] == list(_SHELTER_NAMES)
    assert mine[0]["distance_km"] == 0.0
    assert mine[0]["distance_km"] <= mine[1]["distance_km"] <= mine[2]["distance_km"]


def test_patch_shelter_requires_responder_or_admin(client, db_session):
    _seed_shelters(db_session)
    shelter_id = db_session.query(Shelter).first().id
    citizen = register_citizen(client, "8700000002")
    resp = client.patch(
        f"/api/v1/shelters/{shelter_id}",
        headers=auth_headers(citizen),
        json={"status": "near_full"},
    )
    assert resp.status_code == 403


def test_admin_can_patch_shelter_status(client, db_session):
    _seed_shelters(db_session)
    shelter_id = db_session.query(Shelter).first().id
    make_admin(db_session, "8700000009")
    token = login(client, "8700000009")
    resp = client.patch(
        f"/api/v1/shelters/{shelter_id}",
        headers=auth_headers(token),
        json={"status": "full", "occupied": 100},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "full"
    assert resp.json()["occupied"] == 100
