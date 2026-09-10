"""Thread-safe in-process pub/sub for Server-Sent Events.

Publishers are sync service functions that may run in FastAPI's threadpool
(no event loop of their own). Subscribers are the async SSE generators in
`app/api/stream.py`. The bridge between the two is
`loop.call_soon_threadsafe`, so `publish()` is safe to call from any thread
and never blocks the caller.

Single-instance only: events are fanned out to subscribers of *this*
process. Scaling out horizontally means replacing this module with a Redis
(or similar) pub/sub client — the `broker.publish` / stream-consumer
contract is designed to make that swap local.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

logger = logging.getLogger("aasha_setu.events")

# Per-subscriber backpressure bound. A consumer that falls this far behind
# is treated as broken: we drop its oldest events rather than let the queue
# grow without limit.
_MAX_QUEUE = 1000


class Subscriber:
    """One connected SSE client. Owns an asyncio.Queue plus the loop it
    lives on, so `publish()` (possibly on another thread) can hand events
    over safely."""

    __slots__ = ("queue", "loop")

    def __init__(self, loop: asyncio.AbstractEventLoop) -> None:
        self.queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=_MAX_QUEUE)
        self.loop = loop


def _offer(sub: Subscriber, event: dict[str, Any]) -> None:
    """Runs on the subscriber's own loop (via call_soon_threadsafe)."""
    try:
        sub.queue.put_nowait(event)
    except asyncio.QueueFull:
        # Slow/broken consumer: drop the oldest event to make room.
        try:
            sub.queue.get_nowait()
        except asyncio.QueueEmpty:
            pass
        try:
            sub.queue.put_nowait(event)
        except asyncio.QueueFull:  # pragma: no cover - racing put
            pass


class EventBroker:
    def __init__(self) -> None:
        self._subscribers: set[Subscriber] = set()

    def subscribe(self) -> Subscriber:
        """Call from inside the async request handler — binds to its loop."""
        sub = Subscriber(asyncio.get_running_loop())
        self._subscribers.add(sub)
        return sub

    def unsubscribe(self, sub: Subscriber) -> None:
        self._subscribers.discard(sub)

    def publish(self, event_type: str, data: Any) -> None:
        """Fan `{"type": event_type, "data": data}` out to every subscriber.
        Non-blocking; safe from a worker thread or the event loop."""
        if not self._subscribers:
            return
        event = {"type": event_type, "data": data}
        for sub in list(self._subscribers):
            try:
                sub.loop.call_soon_threadsafe(_offer, sub, event)
            except RuntimeError:
                # Loop already closed — subscriber is gone.
                self._subscribers.discard(sub)

    @property
    def subscriber_count(self) -> int:
        return len(self._subscribers)


broker = EventBroker()
