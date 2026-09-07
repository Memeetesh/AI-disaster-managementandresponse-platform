"""In-process realtime event plumbing (Server-Sent Events, single instance).

`broker` is the app-wide publish/subscribe hub. Sync service code calls
`broker.publish(...)`; the async SSE generator in `app/api/stream.py`
consumes it. No Redis — a horizontally scaled deployment would swap the
broker implementation for a Redis pub/sub client (noted, not built).
"""
from app.events.broker import broker

__all__ = ["broker"]
