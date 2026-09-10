"""Server-Sent Events — the app's single realtime channel.

One endpoint, `GET /api/v1/stream`. The browser client (src/lib/realtime.tsx)
uses fetch-based SSE, so it sends a normal `Authorization: Bearer` header —
no query-string token, no ticket exchange. Events originate in
`app.events.broker`; this module only authorizes the connection, filters
events by role, and formats SSE frames.
"""
from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse

from app.core.deps import oauth2_scheme
from app.core.security import decode_access_token
from app.database import SessionLocal
from app.events.broker import broker
from app.models.user import User

logger = logging.getLogger("aasha_setu.events")

router = APIRouter(tags=["stream"])

# Send a comment line at least this often so proxies and the browser keep
# the connection open during quiet periods.
_HEARTBEAT_SECONDS = 20

_OPERATOR_ROLES = ("responder", "admin")


def _credentials_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


def stream_identity(token: str = Depends(oauth2_scheme)) -> tuple[int, str]:
    """Resolve the caller to `(user_id, role)` using a short-lived session so
    we don't hold a DB connection open for the whole stream lifetime."""
    payload = decode_access_token(token)
    if payload is None or "sub" not in payload:
        raise _credentials_error()
    with SessionLocal() as db:
        user = db.get(User, int(payload["sub"]))
        if user is None:
            raise _credentials_error()
        return user.id, user.role


def _visible_to(event: dict, user_id: int, role: str) -> bool:
    """Operators see everything. Citizens see area-wide signals plus only
    their own incident/rescue activity."""
    if role in _OPERATOR_ROLES:
        return True
    etype: str = event.get("type", "")
    data = event.get("data") or {}
    if etype in ("risk.updated", "shelter.updated", "family.updated") or etype.startswith("alert."):
        return True
    if etype.startswith("incident.") or etype.startswith("rescue."):
        return isinstance(data, dict) and data.get("reported_by") == user_id
    return False


def _format(event: dict) -> bytes:
    payload = json.dumps(event.get("data"), default=str)
    return f"event: {event['type']}\ndata: {payload}\n\n".encode("utf-8")


async def _event_stream(
    request: Request, user_id: int, role: str
) -> AsyncIterator[bytes]:
    sub = broker.subscribe()
    logger.info("SSE client connected (role=%s, total=%d)", role, broker.subscriber_count)
    try:
        yield b": connected\n\n"
        while True:
            if await request.is_disconnected():
                break
            try:
                event = await asyncio.wait_for(sub.queue.get(), timeout=_HEARTBEAT_SECONDS)
            except asyncio.TimeoutError:
                yield b": keep-alive\n\n"
                continue
            if _visible_to(event, user_id, role):
                yield _format(event)
    except asyncio.CancelledError:  # pragma: no cover - client disconnect
        raise
    finally:
        broker.unsubscribe(sub)
        logger.info("SSE client disconnected (total=%d)", broker.subscriber_count)


@router.get("/stream")
async def stream(
    request: Request,
    identity: tuple[int, str] = Depends(stream_identity),
) -> StreamingResponse:
    user_id, role = identity
    return StreamingResponse(
        _event_stream(request, user_id, role),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            # Disable proxy buffering (nginx) so events flush immediately.
            "X-Accel-Buffering": "no",
        },
    )
