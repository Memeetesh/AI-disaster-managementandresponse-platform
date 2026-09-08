"""Aggregates all versioned API routers.

Phase 1 wired up health + auth. Phase 2 added incidents, sos, reports.
Phase 3 added risk-map/risk-zones and shelters. Phase 4 added the disaster
simulator, the SSE stream, alerts, check-ins, and the priority/dispatch/
routing surface (responders, rescue-operations, routes/safe, dashboard
stats, admin user provisioning). Each router stays thin: validation +
calling app/services.
"""
from fastapi import APIRouter

from app.api import (
    alerts,
    auth,
    chat,
    check_in,
    dashboard,
    family,
    health,
    incidents,
    places,
    reports,
    rescue_operations,
    responders,
    risk,
    routes,
    shelters,
    simulator,
    sos,
    stream,
    users,
    weather,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(incidents.router)
api_router.include_router(sos.router)
api_router.include_router(reports.router)
api_router.include_router(risk.router)
api_router.include_router(shelters.router)
api_router.include_router(simulator.router)
api_router.include_router(alerts.router)
api_router.include_router(check_in.router)
api_router.include_router(family.router)
api_router.include_router(weather.router)
api_router.include_router(places.router)
api_router.include_router(chat.router)
api_router.include_router(responders.router)
api_router.include_router(rescue_operations.router)
api_router.include_router(routes.router)
api_router.include_router(dashboard.router)
api_router.include_router(stream.router)
