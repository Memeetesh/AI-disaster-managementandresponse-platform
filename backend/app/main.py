import asyncio
import logging
import threading
from contextlib import asynccontextmanager, suppress
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app import keepalive
from app.api.router import api_router
from app.config import settings
from app.services import weather as weather_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("aasha_setu")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    keepalive_task = keepalive.start()
    # Pre-fill the weather cache off the request path (best-effort; no-op
    # unless DEMO_LAT/DEMO_LON are set).
    threading.Thread(
        target=weather_service.warm_up, name="weather-warmup", daemon=True
    ).start()
    try:
        yield
    finally:
        if keepalive_task is not None:
            keepalive_task.cancel()
            with suppress(asyncio.CancelledError):
                await keepalive_task


app = FastAPI(
    title=settings.APP_NAME,
    description="AI-Powered Disaster Intelligence, Response & Situational Awareness System",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_PREFIX)

upload_root = Path(settings.UPLOAD_DIR)
upload_root.mkdir(parents=True, exist_ok=True)
app.mount(f"/{settings.UPLOAD_DIR}", StaticFiles(directory=upload_root), name="uploads")


@app.get("/", tags=["health"])
def root() -> dict:
    return {"service": settings.APP_NAME, "status": "running", "docs": "/docs"}
