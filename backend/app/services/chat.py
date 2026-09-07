"""Support-chat companion for the citizen app.

The LLM key lives only here (server-side). Without LLM_API_KEY the chat
degrades to a fixed supportive reply + helplines, so the feature always
works. Provider is pluggable via settings.LLM_PROVIDER.
"""
from __future__ import annotations

import logging

import httpx

from app.config import settings

logger = logging.getLogger("drishti.chat")

_TIMEOUT_S = 30.0
_MAX_HISTORY = 16
# Gemini 3.x flash is a "thinking" model — it spends output tokens on internal
# reasoning before the visible reply, so the cap needs real headroom even
# though the system prompt keeps the answer to a few sentences.
_MAX_OUTPUT_TOKENS = 1500

SUPPORT_SYSTEM_PROMPT = """\
You are "Saathi", a calm, caring support companion inside the DRISHTI disaster \
app. You are talking with someone who may be affected by or recovering from a \
disaster (often flooding) in India.

How to respond:
- Be warm, brief (2-4 short sentences), and human. Listen and validate feelings \
before offering any advice.
- Offer simple, concrete coping ideas when it helps: slow breathing, grounding \
(name 5 things you can see), reaching out to a trusted person, resting, water.
- You are an AI companion - NOT a human volunteer, therapist, doctor, or \
emergency service. Say this plainly if you are asked what you are.
- Do not give medical, legal, or financial advice, and do not diagnose.
- If the person mentions self-harm, suicide, wanting to die, abuse, or being in \
immediate physical danger: gently and clearly encourage them to reach a person \
right now - emergency services on 112, the iCall helpline on 9152987821, or the \
Vandrevala Foundation on 1860-2662-345 - and keep being supportive.
- If they ask for operational disaster help (rescue, shelter, reporting an \
incident), point them to the red SOS button and the app's home screen.
- Use simple language. If the person writes in another Indian language, reply in \
that language.
"""

_FALLBACK_REPLY = (
    "I'm here with you. I'm a simple support companion in this app, not a "
    "trained volunteer - but you don't have to sit with this alone.\n\n"
    "If things feel heavy or urgent, please reach a person now:\n"
    "- Emergency: 112\n"
    "- iCall (emotional support): 9152987821\n"
    "- Vandrevala Foundation: 1860-2662-345\n\n"
    "If it helps in this moment, try slowing your breath - in for 4, hold for 4, "
    "out for 6 - or look around and name five things you can see. The Emotional "
    "Support tab has a few short guided exercises too."
)


def _trim(messages: list[dict]) -> list[dict]:
    return messages[-_MAX_HISTORY:]


async def _call_gemini(messages: list[dict]) -> str:
    model = settings.LLM_MODEL or "gemini-3.6-flash"
    url = f"https://generativelanguage.googleapis.com/v1/models/{model}:generateContent"
    contents = [
        {"role": "model" if m["role"] == "assistant" else "user", "parts": [{"text": m["content"]}]}
        for m in messages
    ]
    payload = {
        "systemInstruction": {"parts": [{"text": SUPPORT_SYSTEM_PROMPT}]},
        "contents": contents,
        "generationConfig": {"temperature": 0.7, "maxOutputTokens": _MAX_OUTPUT_TOKENS},
    }
    async with httpx.AsyncClient(timeout=_TIMEOUT_S) as client:
        resp = await client.post(
            url, json=payload, headers={"x-goog-api-key": settings.LLM_API_KEY or ""}
        )
        resp.raise_for_status()
        data = resp.json()
    candidates = data.get("candidates") or []
    if not candidates:
        raise RuntimeError(f"gemini returned no candidates (blockReason={data.get('promptFeedback')})")
    parts = candidates[0].get("content", {}).get("parts", [])
    text = "".join(p.get("text", "") for p in parts).strip()
    if not text:
        raise RuntimeError(f"gemini candidate had no text (finishReason={candidates[0].get('finishReason')})")
    return text


async def _call_openai_compatible(messages: list[dict]) -> str:
    """Works for provider = openai or openrouter (same /chat/completions shape)."""
    base = (
        "https://openrouter.ai/api/v1"
        if settings.LLM_PROVIDER == "openrouter"
        else "https://api.openai.com/v1"
    )
    model = settings.LLM_MODEL or ("gpt-4o-mini" if settings.LLM_PROVIDER == "openai" else "openai/gpt-4o-mini")
    payload = {
        "model": model,
        "messages": [{"role": "system", "content": SUPPORT_SYSTEM_PROMPT}, *messages],
        "temperature": 0.7,
        "max_tokens": _MAX_OUTPUT_TOKENS,
    }
    async with httpx.AsyncClient(timeout=_TIMEOUT_S) as client:
        resp = await client.post(
            f"{base}/chat/completions",
            json=payload,
            headers={"Authorization": f"Bearer {settings.LLM_API_KEY or ''}"},
        )
        resp.raise_for_status()
        data = resp.json()
    return (data["choices"][0]["message"]["content"] or "").strip()


async def support_reply(messages: list[dict]) -> tuple[str, str]:
    """Returns (reply_text, source)."""
    if not settings.LLM_API_KEY:
        return _FALLBACK_REPLY, "fallback"
    try:
        history = _trim(messages)
        if settings.LLM_PROVIDER == "gemini":
            text = await _call_gemini(history)
        else:
            text = await _call_openai_compatible(history)
        return (text or _FALLBACK_REPLY), ("llm" if text else "error")
    except Exception:  # noqa: BLE001 - chat must never hard-fail the UI
        logger.exception("support chat LLM call failed")
        return _FALLBACK_REPLY, "error"
