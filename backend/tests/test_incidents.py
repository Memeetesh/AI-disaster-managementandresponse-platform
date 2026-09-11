import io

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
        name="Responder One",
        phone=phone,
        hashed_password=hash_password("supersecret123"),
        role="responder",
    )
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


def test_sos_creates_critical_incident(client):
    token = register_citizen(client, "8000000001")
    resp = client.post(
        "/api/v1/sos",
        headers=auth_headers(token),
        data={"latitude": "13.08", "longitude": "80.27", "people_affected": "3", "description": "trapped"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["severity"] == "critical"
    assert body["status"] == "reported"
    assert body["people_affected"] == 3
    assert body["confidence"] == 0.0


def test_report_defaults_to_moderate_severity(client):
    token = register_citizen(client, "8000000002")
    resp = client.post(
        "/api/v1/reports",
        headers=auth_headers(token),
        data={"latitude": "13.08", "longitude": "80.27", "type": "flood"},
    )
    assert resp.status_code == 201
    assert resp.json()["severity"] == "moderate"


def test_citizen_only_sees_own_incidents(client):
    token_a = register_citizen(client, "8000000003")
    token_b = register_citizen(client, "8000000004")

    client.post(
        "/api/v1/sos",
        headers=auth_headers(token_a),
        data={"latitude": "1", "longitude": "1", "people_affected": "1"},
    )
    resp = client.get("/api/v1/incidents", headers=auth_headers(token_b))
    assert resp.status_code == 200
    assert resp.json() == []

    resp = client.get("/api/v1/incidents", headers=auth_headers(token_a))
    assert len(resp.json()) == 1


def test_citizen_cannot_view_others_incident_gets_404(client):
    token_a = register_citizen(client, "8000000005")
    token_b = register_citizen(client, "8000000006")

    created = client.post(
        "/api/v1/sos",
        headers=auth_headers(token_a),
        data={"latitude": "1", "longitude": "1", "people_affected": "1"},
    ).json()

    resp = client.get(f"/api/v1/incidents/{created['id']}", headers=auth_headers(token_b))
    assert resp.status_code == 404


def test_citizen_cannot_patch_incident(client):
    token = register_citizen(client, "8000000007")
    created = client.post(
        "/api/v1/sos",
        headers=auth_headers(token),
        data={"latitude": "1", "longitude": "1", "people_affected": "1"},
    ).json()

    resp = client.patch(
        f"/api/v1/incidents/{created['id']}", headers=auth_headers(token), json={"status": "verified"}
    )
    assert resp.status_code == 403


def test_responder_can_list_all_and_verify_incident(client, db_session):
    citizen_token = register_citizen(client, "8000000008")
    make_responder(db_session, "8000000009")
    responder_token = login(client, "8000000009")

    created = client.post(
        "/api/v1/sos",
        headers=auth_headers(citizen_token),
        data={"latitude": "1", "longitude": "1", "people_affected": "1"},
    ).json()

    resp = client.get("/api/v1/incidents", headers=auth_headers(responder_token))
    assert resp.status_code == 200
    assert any(i["id"] == created["id"] for i in resp.json())

    resp = client.patch(
        f"/api/v1/incidents/{created['id']}",
        headers=auth_headers(responder_token),
        json={"status": "verified", "severity": "critical"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "verified"
    assert body["verified_at"] is not None


def test_responder_sees_reporter_contact_on_list_and_get(client, db_session):
    citizen_token = register_citizen(client, "8000000011")
    make_responder(db_session, "8000000012")
    responder_token = login(client, "8000000012")

    created = client.post(
        "/api/v1/sos",
        headers=auth_headers(citizen_token),
        data={"latitude": "1", "longitude": "1", "people_affected": "1"},
    ).json()

    listed = client.get("/api/v1/incidents", headers=auth_headers(responder_token)).json()
    row = next(i for i in listed if i["id"] == created["id"])
    assert row["reporter_name"] == "Citizen"
    assert row["reporter_phone"] == "8000000011"

    got = client.get(
        f"/api/v1/incidents/{created['id']}", headers=auth_headers(responder_token)
    ).json()
    assert got["reporter_name"] == "Citizen"
    assert got["reporter_phone"] == "8000000011"


def test_manually_logged_incident_reporter_is_the_logging_responder(client, db_session):
    make_responder(db_session, "8000000013")
    responder_token = login(client, "8000000013")

    created = client.post(
        "/api/v1/incidents",
        headers=auth_headers(responder_token),
        json={"latitude": 1, "longitude": 1, "type": "flood"},
    ).json()
    assert created["reporter_name"] == "Responder One"
    assert created["reporter_phone"] == "8000000013"


def test_evidence_rejects_unsupported_file_type(client):
    token = register_citizen(client, "8000000010")
    created = client.post(
        "/api/v1/sos",
        headers=auth_headers(token),
        data={"latitude": "1", "longitude": "1", "people_affected": "1"},
    ).json()

    resp = client.post(
        f"/api/v1/incidents/{created['id']}/evidence",
        headers=auth_headers(token),
        files={"image": ("evil.exe", io.BytesIO(b"not an image"), "application/octet-stream")},
    )
    assert resp.status_code == 415
