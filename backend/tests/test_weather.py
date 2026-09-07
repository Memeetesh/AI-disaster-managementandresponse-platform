"""Rainfall forecast endpoint (Open-Meteo, Phase 5+)."""
import httpx
import pytest

from app.services import weather as weather_service


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
def _clear_weather_cache():
    for c in (
        weather_service._cache,
        weather_service._flood_cache,
        weather_service._cyclone_cache,
        weather_service._landslide_cache,
    ):
        c.clear()
    yield
    for c in (
        weather_service._cache,
        weather_service._flood_cache,
        weather_service._cyclone_cache,
        weather_service._landslide_cache,
    ):
        c.clear()


def test_classify_rainfall_bands():
    assert weather_service._classify(0) == "low"
    assert weather_service._classify(7.4) == "low"
    assert weather_service._classify(7.5) == "moderate"
    assert weather_service._classify(35.4) == "moderate"
    assert weather_service._classify(35.5) == "high"
    assert weather_service._classify(115.4) == "high"
    assert weather_service._classify(115.5) == "critical"


class _FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload


_SAMPLE = {
    "current": {"precipitation": 1.2},
    "daily": {
        "precipitation_sum": [40.0, 12.0, 3.0, 0.0, 1.5, 20.0, 5.0],
        "precipitation_probability_max": [88, 60, 30, 10, 20, 55, 40],
    },
}


def test_rainfall_endpoint_returns_forecast(client, monkeypatch):
    monkeypatch.setattr(weather_service.httpx, "get", lambda *a, **k: _FakeResponse(_SAMPLE))
    token = register_citizen(client, "8900000001")

    resp = client.get(
        "/api/v1/weather/rainfall",
        params={"lat": 19.07, "lon": 72.87},
        headers=auth_headers(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["level"] == "high"  # peak of today/tomorrow = 40 mm → high
    assert body["probability"] == 88  # max of first two days
    assert body["rain_24h_mm"] == 40.0
    assert body["rain_48h_mm"] == 52.0
    assert len(body["trend"]) == 7
    assert body["source"] == "open-meteo"


def test_rainfall_endpoint_502_when_provider_down(client, monkeypatch):
    def _boom(*a, **k):
        raise httpx.ConnectError("open-meteo unreachable")

    monkeypatch.setattr(weather_service.httpx, "get", _boom)
    token = register_citizen(client, "8900000002")
    resp = client.get(
        "/api/v1/weather/rainfall",
        params={"lat": 19.07, "lon": 72.87},
        headers=auth_headers(token),
    )
    assert resp.status_code == 502


def test_rainfall_requires_auth(client):
    assert client.get("/api/v1/weather/rainfall", params={"lat": 19, "lon": 72}).status_code == 401


# --- flood forecast ---


def test_classify_flood_bands():
    assert weather_service._classify_flood(None) == "low"
    assert weather_service._classify_flood(1.0) == "low"
    assert weather_service._classify_flood(1.3) == "moderate"
    assert weather_service._classify_flood(2.0) == "high"
    assert weather_service._classify_flood(3.5) == "critical"


def _flood_payload(past_val: float, forecast_peak: float) -> dict:
    past = [past_val] * 92
    forecast = [forecast_peak * 0.5] * 29 + [forecast_peak]
    return {"daily": {"river_discharge": past + forecast}}


def test_flood_endpoint_flags_discharge_anomaly(client, monkeypatch):
    monkeypatch.setattr(
        weather_service.httpx, "get", lambda *a, **k: _FakeResponse(_flood_payload(100.0, 250.0))
    )
    token = register_citizen(client, "8900000003")
    resp = client.get(
        "/api/v1/weather/flood", params={"lat": 25.6, "lon": 85.1}, headers=auth_headers(token)
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["anomaly_ratio"] == 2.5  # 250 peak / 100 baseline
    assert body["level"] == "high"
    assert 0 <= body["flood_risk_score"] <= 100
    assert body["baseline_discharge_m3s"] == 100.0
    assert body["forecast_peak_m3s"] == 250.0


def test_flood_endpoint_no_river_reach(client, monkeypatch):
    monkeypatch.setattr(
        weather_service.httpx, "get", lambda *a, **k: _FakeResponse(_flood_payload(0.0, 0.0))
    )
    token = register_citizen(client, "8900000004")
    body = client.get(
        "/api/v1/weather/flood", params={"lat": 25, "lon": 85}, headers=auth_headers(token)
    ).json()
    assert body["anomaly_ratio"] is None
    assert body["level"] == "low"
    assert "no major river" in body["source"]


def test_flood_endpoint_502_when_provider_down(client, monkeypatch):
    def _boom(*a, **k):
        raise httpx.ConnectError("flood api unreachable")

    monkeypatch.setattr(weather_service.httpx, "get", _boom)
    token = register_citizen(client, "8900000005")
    resp = client.get(
        "/api/v1/weather/flood", params={"lat": 25, "lon": 85}, headers=auth_headers(token)
    )
    assert resp.status_code == 502


# --- cyclone indicator ---


def test_classify_cyclone_from_wind():
    assert weather_service._classify_cyclone(20, 1012) == "low"
    assert weather_service._classify_cyclone(50, 1010) == "moderate"
    assert weather_service._classify_cyclone(75, 1008) == "high"
    assert weather_service._classify_cyclone(120, 1005) == "critical"


def test_classify_cyclone_pressure_escalates_and_deep_low_is_critical():
    # windy + a deep-ish low → bumped up one level
    assert weather_service._classify_cyclone(70, 992) == "critical"
    # a very deep low is critical regardless
    assert weather_service._classify_cyclone(30, 975) == "critical"


def test_cyclone_endpoint_returns_indicator(client, monkeypatch):
    payload = {
        "daily": {
            "wind_speed_10m_max": [30, 45, 70, 95, 60, 40, 35],
            "wind_gusts_10m_max": [50, 75, 110, 140, 90, 60, 45],
        },
        "hourly": {"pressure_msl": [1010, 1005, 998, 985, 990, 1002]},
    }
    monkeypatch.setattr(weather_service.httpx, "get", lambda *a, **k: _FakeResponse(payload))
    token = register_citizen(client, "8900000006")
    body = client.get(
        "/api/v1/weather/cyclone", params={"lat": 13.1, "lon": 80.3}, headers=auth_headers(token)
    ).json()
    assert body["peak_gust_kmh"] == 140.0
    assert body["min_pressure_hpa"] == 985.0
    assert body["level"] == "critical"
    assert 0 <= body["cyclone_risk_score"] <= 100
    assert "not a storm track" in body["source"]


def test_cyclone_endpoint_502_when_provider_down(client, monkeypatch):
    def _boom(*a, **k):
        raise httpx.ConnectError("open-meteo unreachable")

    monkeypatch.setattr(weather_service.httpx, "get", _boom)
    token = register_citizen(client, "8900000007")
    resp = client.get(
        "/api/v1/weather/cyclone", params={"lat": 13, "lon": 80}, headers=auth_headers(token)
    )
    assert resp.status_code == 502


# --- landslide indicator ---


def test_landslide_score_needs_both_slope_and_rain():
    assert weather_service._landslide_score(3, 200) == 0  # flat, no matter the rain
    assert weather_service._landslide_score(40, 0) == 0  # steep, but bone dry
    assert weather_service._landslide_score(40, 200) > 60  # steep + soaked


def test_classify_landslide_treats_flat_as_low():
    assert weather_service._classify_landslide(90, slope_deg=3) == "low"
    assert weather_service._classify_landslide(10, slope_deg=25) == "low"
    assert weather_service._classify_landslide(35, slope_deg=25) == "moderate"
    assert weather_service._classify_landslide(80, slope_deg=25) == "critical"


def _landslide_get_steep(url, *a, **k):
    if "elevation" in url:
        # centre + 8-point ring: ~900 m of relief across the ~1 km ring
        return _FakeResponse({"elevation": [500, 980, 800, 500, 120, 80, 150, 500, 900]})
    return _FakeResponse(
        {"daily": {"precipitation_sum": [12, 12, 12, 14, 20, 30, 40, 10, 5]}}
    )


def test_landslide_endpoint_flags_steep_wet_slope(client, monkeypatch):
    monkeypatch.setattr(weather_service.httpx, "get", _landslide_get_steep)
    token = register_citizen(client, "8900000008")
    body = client.get(
        "/api/v1/weather/landslide", params={"lat": 11.4, "lon": 76.7}, headers=auth_headers(token)
    ).json()
    assert body["slope_degrees"] > 10
    assert body["level"] in ("moderate", "high", "critical")
    assert body["rain_trigger_mm"] > 0
    assert "heuristic" in body["source"]


def _landslide_get_flat(url, *a, **k):
    if "elevation" in url:
        return _FakeResponse({"elevation": [50] * 9})
    return _FakeResponse({"daily": {"precipitation_sum": [40] * 9}})


def test_landslide_endpoint_flat_terrain_is_low(client, monkeypatch):
    monkeypatch.setattr(weather_service.httpx, "get", _landslide_get_flat)
    token = register_citizen(client, "8900000009")
    body = client.get(
        "/api/v1/weather/landslide", params={"lat": 13.08, "lon": 80.27}, headers=auth_headers(token)
    ).json()
    assert body["slope_degrees"] == 0.0
    assert body["level"] == "low"
    assert body["landslide_risk_score"] == 0
    assert "flat" in body["recommendation"]


def test_landslide_endpoint_502_when_provider_down(client, monkeypatch):
    def _boom(*a, **k):
        raise httpx.ConnectError("elevation api unreachable")

    monkeypatch.setattr(weather_service.httpx, "get", _boom)
    token = register_citizen(client, "8900000010")
    resp = client.get(
        "/api/v1/weather/landslide", params={"lat": 11, "lon": 76}, headers=auth_headers(token)
    )
    assert resp.status_code == 502
