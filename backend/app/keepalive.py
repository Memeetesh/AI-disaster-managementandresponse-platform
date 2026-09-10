"""Optional self-ping to keep a free-tier host awake.

Free hosts (Render free web services and similar) spin an instance down
after ~15 minutes with no inbound traffic. A request the running instance
makes to its OWN public URL travels out through the platform edge and
counts as inbound, so a periodic self-ping keeps an already-running
instance warm.

Limitation: this cannot WAKE a sleeping instance — the app isn't running
to send the ping. For wake-from-sleep, use an external pinger
(`.github/workflows/keepalive.yml`, or a service like UptimeRobot /
cron-job.org).
"""
from __future__ import annotations

import asyncio
import logging

import httpx

from app.config import settings

logger = logging.getLogger("aasha_setu.keepalive")


async def _loop(url: str, interval: int) -> None:
    logger.info("keep-alive: pinging %s every %ss", url, interval)
    async with httpx.AsyncClient(timeout=15.0) as client:
        while True:
            try:
                await asyncio.sleep(interval)
                resp = await client.get(url)
                logger.info("keep-alive ping -> %s", resp.status_code)
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # never let a failed ping crash the app
                logger.warning("keep-alive ping failed: %s", exc)


def start() -> asyncio.Task | None:
    """Start the background ping loop if configured. Returns the task, or
    None when keep-alive is disabled or no target URL is available."""
    if not settings.KEEP_ALIVE:
        logger.info("keep-alive: disabled (KEEP_ALIVE=false)")
        return None
    target = settings.keep_alive_target
    if not target:
        logger.info(
            "keep-alive: no target URL (not on Render and KEEP_ALIVE_URL unset) — inactive"
        )
        return None
    return asyncio.create_task(_loop(target, settings.KEEP_ALIVE_INTERVAL_SECONDS))
