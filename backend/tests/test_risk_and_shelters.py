from app.gis.points import make_point
from app.models.incident import Incident
from app.models.risk_zone import RiskZone
from app.models.shelter import Shelter


def register_citizen(client, phone: str) -> str:
    resp = client.post(
        "/api/v1/auth/register",
        json={"name": "Citizen", "phone": phone, "password": "supersecret123"},
    )
    assert resp.status_code == 201
    return resp.json()["access_token"]


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


ZONE_WKT = "POLYGON((80.20 13.00, 80.22 13.00, 80.22 13.02, 80.20 13.02, 80.20 13.00))"


def make_zone(db_session, **overrides) -> RiskZone:
    defaults = dict(
        geometry=ZONE_WKT,
        risk_score=0.0,
        hazard_score=40.0,
        population_exposure=50.0,
        infrastructure_vulnerability=30.0,
        accessibility_score=20.0,
        historical_risk_score=25.0,
    )
    defaults.update(overrides)
    zone = RiskZone(**defaults)
    db_session.add(zone)
    db_session.commit()
    db_session.refresh(zone)
    return zone


def test_risk_map_returns_geojson_feature_collection(client, db_session):
    make_zone(db_session)
    token = register_citizen(client, "8100000001")

    resp = client.get("/api/v1/risk-map", headers=auth_headers(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["type"] == "FeatureCollection"
    assert len(body["features"]) == 1
    props = body["features"][0]["properties"]
    assert props["risk_category"] in {"low", "moderate", "high", "very_high", "critical"}
    assert body["features"][0]["geometry"]["type"] == "Polygon"


def test_nearby_incident_raises_zone_hazard_and_risk(client, db_session):
    zone = make_zone(db_session)
    token = register_citizen(client, "8100000002")

    baseline = client.get(f"/api/v1/risk-zones/{zone.id}", headers=auth_headers(token)).json()

    # An active incident inside the zone should push hazard/risk up.
    incident = Incident(
        type="flood",
        latitude=13.01,
        longitude=80.21,
        location=make_point(13.01, 80.21),
        severity="high",
        status="reported",
        people_affected=2,
    )
    db_session.add(incident)
    db_session.commit()

    boosted = client.get(f"/api/v1/risk-zones/{zone.id}", headers=auth_headers(token)).json()

    assert boosted["nearby_incident_count"] >= 1
    assert boosted["hazard_score"] > baseline["hazard_score"]
    assert boosted["risk_score"] > baseline["risk_score"]


def test_rejected_incident_does_not_affect_risk(client, db_session):
    zone = make_zone(db_session)
    token = register_citizen(client, "8100000003")

    baseline = client.get(f"/api/v1/risk-zones/{zone.id}", headers=auth_headers(token)).json()

    incident = Incident(
        type="flood",
        latitude=13.01,
        longitude=80.21,
        location=make_point(13.01, 80.21),
        severity="high",
        status="rejected",
        people_affected=2,
    )
    db_session.add(incident)
    db_session.commit()

    after = client.get(f"/api/v1/risk-zones/{zone.id}", headers=auth_headers(token)).json()
    assert after["hazard_score"] == baseline["hazard_score"]


def test_get_missing_risk_zone_404s(client, db_session):
    token = register_citizen(client, "8100000004")
    resp = client.get("/api/v1/risk-zones/999999", headers=auth_headers(token))
    assert resp.status_code == 404


def test_shelters_list_requires_auth_and_returns_seeded_rows(client, db_session):
    shelter = Shelter(
        name="Test Shelter (Demo)",
        latitude=13.05,
        longitude=80.24,
        location=make_point(13.05, 80.24),
        capacity=100,
        occupied=10,
        facilities=["water"],
        accessibility="wheelchair_accessible",
        status="open",
    )
    db_session.add(shelter)
    db_session.commit()

    assert client.get("/api/v1/shelters").status_code == 401

    token = register_citizen(client, "8100000005")
    resp = client.get("/api/v1/shelters", headers=auth_headers(token))
    assert resp.status_code == 200
    names = [s["name"] for s in resp.json()]
    assert "Test Shelter (Demo)" in names
