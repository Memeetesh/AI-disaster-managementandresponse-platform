import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("drishti")

app = FastAPI(
    title=settings.APP_NAME,
    description="AI-Powered Disaster Intelligence, Response & Situational Awareness System",
    version="0.1.0",
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
