"""Tests for the citizen family safety circle (Phase 6):
consent (member accept/decline) + opt-in live location sharing."""
from app.core.security import hash_password
from app.models.user import User


def register_citizen(client, phone: str, name: str = "Citizen") -> str:
    resp = client.post(
        "/api/v1/auth/register",
        json={"name": name, "phone": phone, "password": "supersecret123"},
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


def h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def add_member(client, owner_token: str, name: str, phone: str, relation: str | None = None):
    body = {"name": name, "phone": phone}
    if relation:
        body["relation"] = relation
    return client.post("/api/v1/family", headers=h(owner_token), json=body)


def accept_latest_request(client, member_token: str, accept: bool = True) -> int:
    reqs = client.get("/api/v1/family/requests", headers=h(member_token)).json()
    assert reqs, "expected a pending request"
    link_id = reqs[-1]["id"]
    resp = client.post(
        f"/api/v1/family/requests/{link_id}/respond",
        headers=h(member_token),
        json={"accept": accept},
    )
    assert resp.status_code == 204
    return link_id


# --- basic add / remove --------------------------------------------------


def test_add_unregistered_contact_is_accepted_immediately(client):
    token = register_citizen(client, "9700000001")
    assert client.get("/api/v1/family", headers=h(token)).json() == []

    resp = add_member(client, token, "Dadi", "9000000099", "Grandmother")
    assert resp.status_code == 201
    body = resp.json()
    assert body["on_drishti"] is False
    assert body["link_status"] == "accepted"
    assert body["status"] == "not_registered"
    assert body["shares_location"] is False


def test_duplicate_phone_rejected(client):
    token = register_citizen(client, "9700000002")
    assert add_member(client, token, "Meera", "9000000088").status_code == 201
    assert add_member(client, token, "Meera", "9000000088").status_code == 409


def test_cannot_add_own_number(client):
    token = register_citizen(client, "9700000003")
    assert add_member(client, token, "Me", "+91 97000 00003").status_code == 400


def test_remove_family_member(client):
    token = register_citizen(client, "9700000004")
    created = add_member(client, token, "Temp", "9000000077").json()
    assert client.delete(f"/api/v1/family/{created['id']}", headers=h(token)).status_code == 204
    assert client.get("/api/v1/family", headers=h(token)).json() == []


def test_cannot_remove_another_users_member(client):
    a = register_citizen(client, "9700000005")
    b = register_citizen(client, "9700000006")
    created = add_member(client, a, "Private", "9000000066").json()
    assert client.delete(f"/api/v1/family/{created['id']}", headers=h(b)).status_code == 404
    assert len(client.get("/api/v1/family", headers=h(a)).json()) == 1


def test_circle_is_private_per_owner(client):
    a = register_citizen(client, "9700000007")
    b = register_citizen(client, "9700000008")
    add_member(client, a, "A-only", "9000000055")
    assert client.get("/api/v1/family", headers=h(b)).json() == []


# --- consent flow ------------------------------------------------------


def test_registered_member_starts_pending(client):
    owner = register_citizen(client, "9700000010")
    register_citizen(client, "9700000011", name="Rajesh")

    body = add_member(client, owner, "Rajesh", "9700000011", "Father").json()
    assert body["on_drishti"] is True
    assert body["link_status"] == "pending"
    assert body["status"] == "invite_pending"

    member = login(client, "9700000011")
    reqs = client.get("/api/v1/family/requests", headers=h(member)).json()
    assert len(reqs) == 1
    assert reqs[0]["owner_name"] == "Citizen"
    assert reqs[0]["relation"] == "Father"


def test_accept_request_reveals_live_status(client):
    owner = register_citizen(client, "9700000012")
    member = register_citizen(client, "9700000013", name="Asha")
    add_member(client, owner, "Asha", "9700000013")

    accept_latest_request(client, member, accept=True)

    listed = client.get("/api/v1/family", headers=h(owner)).json()
    assert listed[0]["link_status"] == "accepted"
    assert listed[0]["status"] == "no_checkin"

    client.post("/api/v1/check-in", headers=h(member), json={"status": "safe"})
    listed = client.get("/api/v1/family", headers=h(owner)).json()
    assert listed[0]["status"] == "safe"
    assert listed[0]["last_check_in_at"] is not None


def test_needs_help_status_after_accept(client):
    owner = register_citizen(client, "9700000014")
    member = register_citizen(client, "9700000015", name="Aarav")
    add_member(client, owner, "Aarav", "+91 97000 00015")
    accept_latest_request(client, member, accept=True)
    client.post("/api/v1/check-in", headers=h(member), json={"status": "need_help"})

    listed = client.get("/api/v1/family", headers=h(owner)).json()
    assert listed[0]["status"] == "needs_help"


def test_decline_request(client):
    owner = register_citizen(client, "9700000016")
    member = register_citizen(client, "9700000017", name="Meera")
    add_member(client, owner, "Meera", "9700000017")
    accept_latest_request(client, member, accept=False)

    listed = client.get("/api/v1/family", headers=h(owner)).json()
    assert listed[0]["link_status"] == "declined"
    assert listed[0]["status"] == "invite_declined"
    # request no longer pending
    assert client.get("/api/v1/family/requests", headers=h(member)).json() == []


def test_cannot_respond_to_another_users_request(client):
    owner = register_citizen(client, "9700000018")
    member = register_citizen(client, "9700000019", name="Real")
    stranger = register_citizen(client, "9700000020", name="Stranger")
    add_member(client, owner, "Real", "9700000019")
    link_id = client.get("/api/v1/family/requests", headers=h(member)).json()[0]["id"]

    resp = client.post(
        f"/api/v1/family/requests/{link_id}/respond",
        headers=h(stranger),
        json={"accept": True},
    )
    assert resp.status_code == 404


# --- location sharing --------------------------------------------------


def test_location_sharing_off_by_default(client):
    token = register_citizen(client, "9700000021")
    state = client.get("/api/v1/family/location-sharing", headers=h(token)).json()
    assert state["enabled"] is False
    assert state["latitude"] is None


def test_ping_rejected_when_sharing_off(client):
    token = register_citizen(client, "9700000022")
    resp = client.post(
        "/api/v1/family/location-sharing/ping",
        headers=h(token),
        json={"latitude": 13.05, "longitude": 80.25},
    )
    assert resp.status_code == 409


def test_enabled_sharing_ping_visible_to_accepted_owner_with_distance(client):
    owner = register_citizen(client, "9700000023")
    member = register_citizen(client, "9700000024", name="Kiran")
    add_member(client, owner, "Kiran", "9700000024")
    accept_latest_request(client, member, accept=True)

    assert (
        client.put(
            "/api/v1/family/location-sharing",
            headers=h(member),
            json={"enabled": True},
        ).status_code
        == 200
    )
    client.post(
        "/api/v1/family/location-sharing/ping",
        headers=h(member),
        json={"latitude": 13.08, "longitude": 80.27},
    )

    listed = client.get(
        "/api/v1/family?lat=13.05&lon=80.25", headers=h(owner)
    ).json()
    m = listed[0]
    assert m["shares_location"] is True
    assert abs(m["latitude"] - 13.08) < 1e-6
    assert m["location_updated_at"] is not None
    assert m["distance_km"] is not None and 0 < m["distance_km"] < 10


def test_disable_sharing_clears_location_for_owner(client):
    owner = register_citizen(client, "9700000025")
    member = register_citizen(client, "9700000026", name="Nina")
    add_member(client, owner, "Nina", "9700000026")
    accept_latest_request(client, member, accept=True)
    client.put("/api/v1/family/location-sharing", headers=h(member), json={"enabled": True})
    client.post(
        "/api/v1/family/location-sharing/ping",
        headers=h(member),
        json={"latitude": 13.08, "longitude": 80.27},
    )
    client.put("/api/v1/family/location-sharing", headers=h(member), json={"enabled": False})

    m = client.get("/api/v1/family", headers=h(owner)).json()[0]
    assert m["shares_location"] is False
    assert m["latitude"] is None


def test_pending_member_location_never_shown(client):
    owner = register_citizen(client, "9700000027")
    member = register_citizen(client, "9700000028", name="Om")
    add_member(client, owner, "Om", "9700000028")  # left pending
    client.put("/api/v1/family/location-sharing", headers=h(member), json={"enabled": True})
    client.post(
        "/api/v1/family/location-sharing/ping",
        headers=h(member),
        json={"latitude": 13.08, "longitude": 80.27},
    )

    m = client.get("/api/v1/family", headers=h(owner)).json()[0]
    assert m["status"] == "invite_pending"
    assert m["shares_location"] is False
    assert m["latitude"] is None


# --- role gate -------------------------------------------------------


def test_non_citizen_cannot_use_family(client, db_session):
    make_responder(db_session, "9700000029")
    token = login(client, "9700000029")
    assert client.get("/api/v1/family", headers=h(token)).status_code == 403
    assert client.get("/api/v1/family/requests", headers=h(token)).status_code == 403
    assert (
        client.get("/api/v1/family/location-sharing", headers=h(token)).status_code == 403
    )
