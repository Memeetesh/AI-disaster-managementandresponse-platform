"""Safe-route computation. OSRM when reachable, straight-line fallback
otherwise — a dead routing service degrades one feature, never the demo.
"""
from app.routing.safe_route import SafeRoute, safe_route

__all__ = ["SafeRoute", "safe_route"]
