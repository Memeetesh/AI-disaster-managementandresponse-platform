def test_register_and_login(client):
    register_resp = client.post(
        "/api/v1/auth/register",
        json={"name": "Test Citizen", "phone": "9990001111", "password": "supersecret123"},
    )
    assert register_resp.status_code == 201
    body = register_resp.json()
    assert body["user"]["role"] == "citizen"
    assert "access_token" in body

    login_resp = client.post(
        "/api/v1/auth/login", json={"phone": "9990001111", "password": "supersecret123"}
    )
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]

    me_resp = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200
    assert me_resp.json()["phone"] == "9990001111"


def test_register_ignores_client_supplied_admin_role(client):
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Attempted Admin",
            "phone": "9990002222",
            "password": "supersecret123",
            "role": "admin",
        },
    )
    assert resp.status_code == 201
    assert resp.json()["user"]["role"] == "citizen"


def test_login_wrong_password_rejected(client):
    client.post(
        "/api/v1/auth/register",
        json={"name": "Someone", "phone": "9990003333", "password": "supersecret123"},
    )
    resp = client.post("/api/v1/auth/login", json={"phone": "9990003333", "password": "wrong"})
    assert resp.status_code == 401
