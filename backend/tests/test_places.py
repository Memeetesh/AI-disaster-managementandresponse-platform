"""Nearby POIs from OpenStreetMap Overpass (GET /places/nearby)."""
import httpx
import pytest

from app.services import places as places_service


def register_citizen(client, phone: str) -> str:
    resp = client.post(
        "/api/v1/auth/register",
        json={"name": "Citizen", "phone": phone, "password": "supersecret123"},
    )
    assert resp.status_code == 201
    return resp.json()["access_token"]


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(autouse=True)
def _clear_places_cache():
    places_service._cache.clear()
    yield
    places_service._cache.clear()


class _FakeResp:
    def __init__(self, payload):
        self._p = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self._p


_OVERPASS = {
    "elements": [
        {"type": "node", "lat": 13.055, "lon": 80.255, "tags": {"amenity": "hospital", "name": "Near Care Hospital", "phone": "044-1234"}},
        {"type": "way", "center": {"lat": 13.09, "lon": 80.29}, "tags": {"amenity": "hospital", "name": "Far General Hospital"}},
        {"type": "node", "lat": 13.052, "lon": 80.252, "tags": {"amenity": "clinic"}},  # no name -> dropped
    ]
}


def test_places_nearby_parses_sorts_and_drops_unnamed(client, monkeypatch):
    monkeypatch.setattr(places_service.httpx, "post", lambda *a, **k: _FakeResp(_OVERPASS))
    token = register_citizen(client, "8b00000001")
    resp = client.get(
        "/api/v1/places/nearby",
        params={"lat": 13.05, "lon": 80.25, "kind": "hospital"},
        headers=auth_headers(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert [p["name"] for p in body] == ["Near Care Hospital", "Far General Hospital"]
    assert body[0]["distance_km"] < body[1]["distance_km"]
    assert body[0]["phone"] == "044-1234"
    assert body[0]["kind"] == "hospital"


def test_places_nearby_returns_empty_when_overpass_down(client, monkeypatch):
    def _boom(*a, **k):
        raise httpx.ConnectError("overpass unreachable")

    monkeypatch.setattr(places_service.httpx, "post", _boom)
    token = register_citizen(client, "8b00000002")
    resp = client.get(
        "/api/v1/places/nearby",
        params={"lat": 13.05, "lon": 80.25, "kind": "shelter"},
        headers=auth_headers(token),
    )
    assert resp.status_code == 200
    assert resp.json() == []


def test_places_nearby_rejects_unknown_kind(client):
    token = register_citizen(client, "8b00000003")
    resp = client.get(
        "/api/v1/places/nearby",
        params={"lat": 13.05, "lon": 80.25, "kind": "airport"},
        headers=auth_headers(token),
    )
    assert resp.status_code == 422


def test_places_nearby_requires_auth(client):
    assert client.get(
        "/api/v1/places/nearby", params={"lat": 13, "lon": 80}
    ).status_code == 401
