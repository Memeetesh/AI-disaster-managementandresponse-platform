"""Tests for the SSE realtime channel (app/api/stream.py + app/events/broker.py).

The end-to-end "publish over HTTP → browser receives" path is exercised
manually in the browser (see the Phase 0 checkpoint). Here we cover the
pieces that are deterministic in isolation: broker queue mechanics, the
role-based visibility filter, and that the endpoint authorizes + opens a
well-formed `text/event-stream`.
"""
import asyncio

from app.api.stream import _visible_to
from app.events.broker import broker


# --- Pure unit tests (no database) ---


def test_broker_delivers_published_event_to_subscriber():
    async def scenario():
        sub = broker.subscribe()
        try:
            broker.publish("incident.created", {"id": 1, "reported_by": 7})
            event = await asyncio.wait_for(sub.queue.get(), timeout=1)
            assert event == {
                "type": "incident.created",
                "data": {"id": 1, "reported_by": 7},
            }
        finally:
            broker.unsubscribe(sub)

    asyncio.run(scenario())


def test_broker_publish_is_noop_without_subscribers():
    # Must not raise even though nobody is listening.
    broker.publish("risk.updated", {"reason": "incident"})
    assert broker.subscriber_count == 0


def test_visible_to_operator_sees_everything():
    for etype in ("incident.created", "rescue.updated", "responder.updated", "simulator.updated"):
        assert _visible_to({"type": etype, "data": {"reported_by": 999}}, user_id=1, role="responder")


def test_visible_to_citizen_sees_area_signals():
    assert _visible_to({"type": "alert.created", "data": {}}, user_id=1, role="citizen")
    assert _visible_to({"type": "risk.updated", "data": {"reason": "simulator"}}, user_id=1, role="citizen")


def test_visible_to_citizen_only_sees_own_incidents():
    own = {"type": "incident.updated", "data": {"id": 5, "reported_by": 1}}
    other = {"type": "incident.updated", "data": {"id": 6, "reported_by": 2}}
    assert _visible_to(own, user_id=1, role="citizen")
    assert not _visible_to(other, user_id=1, role="citizen")


def test_visible_to_citizen_does_not_see_operator_signals():
    assert not _visible_to({"type": "responder.updated", "data": {}}, user_id=1, role="citizen")
    assert not _visible_to({"type": "simulator.updated", "data": {}}, user_id=1, role="citizen")


class _FakeRequest:
    """Minimal stand-in for starlette.Request in the generator test."""

    def __init__(self) -> None:
        self.disconnected = False

    async def is_disconnected(self) -> bool:
        return self.disconnected


def test_event_stream_emits_preamble_then_visible_events():
    from app.api.stream import _event_stream

    async def scenario():
        req = _FakeRequest()
        gen = _event_stream(req, user_id=1, role="responder")
        try:
            preamble = await asyncio.wait_for(gen.__anext__(), timeout=1)
            assert preamble.startswith(b":")  # ": connected"

            broker.publish("incident.created", {"id": 9, "reported_by": 1})
            frame = await asyncio.wait_for(gen.__anext__(), timeout=2)
            assert b"event: incident.created" in frame
            assert b'"id": 9' in frame
        finally:
            req.disconnected = True
            await gen.aclose()

    asyncio.run(scenario())


def test_event_stream_filters_events_for_citizen():
    from app.api.stream import _event_stream

    async def scenario():
        req = _FakeRequest()
        gen = _event_stream(req, user_id=1, role="citizen")
        try:
            await asyncio.wait_for(gen.__anext__(), timeout=1)  # preamble
            broker.publish("incident.created", {"id": 1, "reported_by": 2})  # someone else's
            broker.publish("alert.created", {"id": 5, "message": "flood warning"})
            frame = await asyncio.wait_for(gen.__anext__(), timeout=2)
            # The other citizen's incident is filtered out; the alert gets through.
            assert b"event: alert.created" in frame
        finally:
            req.disconnected = True
            await gen.aclose()

    asyncio.run(scenario())


# --- Integration test (needs a real Postgres+PostGIS DB) ---


def test_stream_requires_auth(client):
    resp = client.get("/api/v1/stream")
    assert resp.status_code == 401
