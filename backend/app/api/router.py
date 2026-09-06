"""Aggregates all versioned API routers.

Phase 1 wired up health + auth. Phase 2 added incidents, sos, reports.
Phase 3 added risk-map/risk-zones and shelters. Phase 4 adds the disaster
simulator. Later phases add alerts, responders, resources,
rescue-operations, analytics, ai/*, and routes/safe here — each as its own
module under app/api, kept thin (validation + calling app/services).
"""
from fastapi import APIRouter

from app.api import auth, health, incidents, reports, risk, shelters, simulator, sos

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(incidents.router)
api_router.include_router(sos.router)
api_router.include_router(reports.router)
api_router.include_router(risk.router)
api_router.include_router(shelters.router)
api_router.include_router(simulator.router)
