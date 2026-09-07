"""Dispatch / rescue-operation lifecycle (Phase 4)."""
from app.core.security import hash_password
from app.gis.points import make_point
from app.models.responder import Responder
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


def _add_responder(db_session, name: str, lat: float, lon: float, status: str = "available") -> int:
    r = Responder(
        name=name,
        team="Test",
        latitude=lat,
        longitude=lon,
        location=make_point(lat, lon),
        status=status,
        vehicle="boat",
        capacity=4,
    )
    db_session.add(r)
    db_session.commit()
    return r.id


def _verified_incident(client, admin_token, lat=13.05, lon=80.25) -> int:
    created = client.post(
        "/api/v1/incidents",
        headers=auth_headers(admin_token),
        json={"type": "flood", "latitude": lat, "longitude": lon, "severity": "high", "people_affected": 4},
    ).json()
    client.patch(
        f"/api/v1/incidents/{created['id']}",
        headers=auth_headers(admin_token),
        json={"status": "verified"},
    )
    return created["id"]


def test_dispatch_assigns_nearest_available_responder(client, db_session):
    make_admin(db_session, "8800000001")
    token = login(client, "8800000001")
    # Isolate from responders other tests may have committed to the shared DB.
    db_session.query(Responder).delete()
    db_session.commit()
    near = _add_responder(db_session, "Near", 13.051, 80.251)
    _add_responder(db_session, "Far", 13.20, 80.40)

    incident_id = _verified_incident(client, token)
    resp = client.post(
        "/api/v1/rescue-operations",
        headers=auth_headers(token),
        json={"incident_id": incident_id},
    )
    assert resp.status_code == 201
    op = resp.json()
    assert op["responder_id"] == near
    assert op["status"] == "en_route"
    assert op["eta_minutes"] is not None
    assert op["route"]["type"] == "LineString"
    assert op["priority"] in ("low", "medium", "high", "critical")

    # incident + responder cascaded
    inc = client.get(f"/api/v1/incidents/{incident_id}", headers=auth_headers(token)).json()
    assert inc["status"] == "in_progress"
    responders = client.get("/api/v1/responders", headers=auth_headers(token)).json()
    assert next(r for r in responders if r["id"] == near)["status"] == "en_route"


def test_dispatch_rejects_unverified_and_double_dispatch(client, db_session):
    make_admin(db_session, "8800000002")
    token = login(client, "8800000002")
    _add_responder(db_session, "R", 13.05, 80.25)

    unverified = client.post(
        "/api/v1/incidents",
        headers=auth_headers(token),
        json={"type": "flood", "latitude": 13.05, "longitude": 80.25},
    ).json()["id"]
    assert client.post(
        "/api/v1/rescue-operations", headers=auth_headers(token), json={"incident_id": unverified}
    ).status_code == 409

    incident_id = _verified_incident(client, token)
    assert client.post(
        "/api/v1/rescue-operations", headers=auth_headers(token), json={"incident_id": incident_id}
    ).status_code == 201
    assert client.post(
        "/api/v1/rescue-operations", headers=auth_headers(token), json={"incident_id": incident_id}
    ).status_code == 409


def test_no_responders_available_returns_409(client, db_session):
    make_admin(db_session, "8800000003")
    token = login(client, "8800000003")
    # The test DB is shared and fixtures commit, so other tests may have left
    # available responders around — take them all out of service first.
    db_session.query(Responder).update({Responder.status: "busy"})
    db_session.commit()
    incident_id = _verified_incident(client, token)
    resp = client.post(
        "/api/v1/rescue-operations", headers=auth_headers(token), json={"incident_id": incident_id}
    )
    assert resp.status_code == 409


def test_completing_rescue_resolves_incident_and_frees_responder(client, db_session):
    make_admin(db_session, "8800000004")
    token = login(client, "8800000004")
    rid = _add_responder(db_session, "R", 13.05, 80.25)
    incident_id = _verified_incident(client, token)

    op = client.post(
        "/api/v1/rescue-operations", headers=auth_headers(token), json={"incident_id": incident_id}
    ).json()

    done = client.patch(
        f"/api/v1/rescue-operations/{op['id']}",
        headers=auth_headers(token),
        json={"status": "completed"},
    )
    assert done.status_code == 200
    assert done.json()["status"] == "completed"
    assert done.json()["completed_at"] is not None

    inc = client.get(f"/api/v1/incidents/{incident_id}", headers=auth_headers(token)).json()
    assert inc["status"] == "resolved"
    responders = client.get("/api/v1/responders", headers=auth_headers(token)).json()
    assert next(r for r in responders if r["id"] == rid)["status"] == "available"

    stats = client.get("/api/v1/dashboard/stats", headers=auth_headers(token)).json()
    assert stats["rescues_completed"] >= 1


def test_citizen_cannot_dispatch(client, db_session):
    make_admin(db_session, "8800000005")
    admin_token = login(client, "8800000005")
    _add_responder(db_session, "R", 13.05, 80.25)
    incident_id = _verified_incident(client, admin_token)

    citizen = register_citizen(client, "8800000010")
    resp = client.post(
        "/api/v1/rescue-operations", headers=auth_headers(citizen), json={"incident_id": incident_id}
    )
    assert resp.status_code == 403
