"""Central application configuration, loaded from environment variables / .env.

Never hard-code secrets here. Every value has a safe local-dev default so the
app boots without a .env file, but production deployments must override
JWT_SECRET and DATABASE_URL at minimum.
"""
import json
import os
from functools import lru_cache
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- App ---
    APP_NAME: str = "DRISHTI"
    ENVIRONMENT: str = "development"
    API_PREFIX: str = "/api/v1"
    # Accepts a JSON array OR a plain comma-separated list in the env var, e.g.
    #   CORS_ORIGINS=https://app.vercel.app,https://app-git-main.vercel.app
    CORS_ORIGINS: Annotated[list[str], NoDecode] = ["http://localhost:3000"]

    # --- Database (PostgreSQL + PostGIS, e.g. Supabase) ---
    # A bare `postgres://` / `postgresql://` URL (what Supabase/Heroku hand out)
    # is auto-rewritten to the `postgresql+psycopg2://` form SQLAlchemy needs.
    DATABASE_URL: str = "postgresql+psycopg2://drishti:drishti@localhost:5432/drishti"

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _parse_cors_origins(cls, v: object) -> object:
        if isinstance(v, str):
            s = v.strip()
            if s.startswith("["):
                return json.loads(s)
            return [o.strip() for o in s.split(",") if o.strip()]
        return v

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def _normalise_database_url(cls, v: object) -> object:
        if isinstance(v, str) and v.startswith(("postgres://", "postgresql://")):
            return v.replace("postgres://", "postgresql+psycopg2://", 1).replace(
                "postgresql://", "postgresql+psycopg2://", 1
            )
        return v

    # --- Auth ---
    JWT_SECRET: str = "dev-only-insecure-secret-change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24h, generous for hackathon demo

    # --- Redis (pub/sub for WebSocket fan-out, optional) ---
    REDIS_URL: str = "redis://localhost:6379/0"

    # --- Keep-alive (free-tier hosts sleep after ~15 min idle) ---
    # On Render, RENDER_EXTERNAL_URL is injected automatically; the app then
    # pings its own /health on an interval so the instance stays warm while
    # it's running. No-ops locally (no external URL). It CANNOT wake an
    # already-sleeping instance — for that use an external pinger
    # (.github/workflows/keepalive.yml or UptimeRobot). Set KEEP_ALIVE=false
    # to turn it off; KEEP_ALIVE_URL overrides the auto-detected target.
    KEEP_ALIVE: bool = True
    KEEP_ALIVE_URL: str | None = None
    KEEP_ALIVE_INTERVAL_SECONDS: int = 600

    @property
    def keep_alive_target(self) -> str | None:
        base = self.KEEP_ALIVE_URL or os.environ.get("RENDER_EXTERNAL_URL")
        if not base:
            return None
        return base.rstrip("/") + self.API_PREFIX + "/health"

    # --- External integrations (all optional; app must degrade gracefully) ---
    IMD_API_KEY: str | None = None
    # LLM for the Support chat companion. Without LLM_API_KEY the chat falls
    # back to a fixed supportive message + helplines.
    LLM_API_KEY: str | None = None
    LLM_PROVIDER: str = "gemini"  # gemini | openai | openrouter
    LLM_MODEL: str = "gemini-3.6-flash"
    OSRM_URL: str = "http://localhost:5000"
    SUPABASE_URL: str | None = None
    SUPABASE_ANON_KEY: str | None = None

    # --- File uploads (evidence images/audio) ---
    # Local disk storage for the hackathon MVP; swap for S3/Supabase Storage
    # later without changing the API shape (still returns a URL string).
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_BYTES: int = 15 * 1024 * 1024  # 15MB

    # --- Risk engine weights (must sum to 1.0) — see app/risk/engine.py ---
    RISK_WEIGHT_HAZARD: float = 0.35
    RISK_WEIGHT_POPULATION: float = 0.25
    RISK_WEIGHT_INFRASTRUCTURE: float = 0.20
    RISK_WEIGHT_ACCESSIBILITY: float = 0.10
    RISK_WEIGHT_HISTORICAL: float = 0.10


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
