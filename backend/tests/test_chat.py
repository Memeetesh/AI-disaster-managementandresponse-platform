"""Support-chat companion (POST /chat/support)."""
import pytest

from app.services import chat as chat_service


def register_citizen(client, phone: str) -> str:
    resp = client.post(
        "/api/v1/auth/register",
        json={"name": "Citizen", "phone": phone, "password": "supersecret123"},
    )
    assert resp.status_code == 201
    return resp.json()["access_token"]


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _say(text: str) -> dict:
    return {"messages": [{"role": "user", "content": text}]}


def test_chat_requires_auth(client):
    assert client.post("/api/v1/chat/support", json=_say("hi")).status_code == 401


def test_chat_falls_back_without_api_key(client, monkeypatch):
    monkeypatch.setattr(chat_service.settings, "LLM_API_KEY", None)
    token = register_citizen(client, "8a00000001")
    resp = client.post("/api/v1/chat/support", headers=auth_headers(token), json=_say("I feel scared"))
    assert resp.status_code == 200
    body = resp.json()
    assert body["source"] == "fallback"
    assert "112" in body["reply"] and "9152987821" in body["reply"]


def test_chat_uses_llm_when_key_present(client, monkeypatch):
    monkeypatch.setattr(chat_service.settings, "LLM_API_KEY", "test-key")
    monkeypatch.setattr(chat_service.settings, "LLM_PROVIDER", "gemini")

    async def _fake_gemini(messages):
        assert messages[-1]["content"] == "the water is rising near my house"
        return "I hear you. Move to higher ground if you safely can, and keep your phone charged."

    monkeypatch.setattr(chat_service, "_call_gemini", _fake_gemini)

    token = register_citizen(client, "8a00000002")
    resp = client.post(
        "/api/v1/chat/support",
        headers=auth_headers(token),
        json=_say("the water is rising near my house"),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["source"] == "llm"
    assert "higher ground" in body["reply"]


def test_chat_degrades_to_safe_reply_on_llm_error(client, monkeypatch):
    monkeypatch.setattr(chat_service.settings, "LLM_API_KEY", "test-key")
    monkeypatch.setattr(chat_service.settings, "LLM_PROVIDER", "gemini")

    async def _boom(messages):
        raise RuntimeError("gemini exploded")

    monkeypatch.setattr(chat_service, "_call_gemini", _boom)

    token = register_citizen(client, "8a00000003")
    resp = client.post("/api/v1/chat/support", headers=auth_headers(token), json=_say("hello"))
    assert resp.status_code == 200
    body = resp.json()
    assert body["source"] == "error"
    assert "112" in body["reply"]


@pytest.mark.parametrize(
    "idx,payload",
    list(
        enumerate(
            [
                {"messages": []},
                {"messages": [{"role": "user", "content": ""}]},
                {"messages": [{"role": "user", "content": "x" * 2001}]},
                {"messages": [{"role": "system", "content": "hi"}]},
            ]
        )
    ),
)
def test_chat_rejects_bad_payloads(client, idx, payload):
    token = register_citizen(client, f"8a1000000{idx}")
    resp = client.post("/api/v1/chat/support", headers=auth_headers(token), json=payload)
    assert resp.status_code == 422
