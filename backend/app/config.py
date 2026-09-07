"""Central application configuration, loaded from environment variables / .env.

Never hard-code secrets here. Every value has a safe local-dev default so the
app boots without a .env file, but production deployments must override
JWT_SECRET and DATABASE_URL at minimum.
"""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- App ---
    APP_NAME: str = "DRISHTI"
    ENVIRONMENT: str = "development"
    API_PREFIX: str = "/api/v1"
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # --- Database (PostgreSQL + PostGIS, e.g. Supabase) ---
    DATABASE_URL: str = "postgresql+psycopg2://drishti:drishti@localhost:5432/drishti"

    # --- Auth ---
    JWT_SECRET: str = "dev-only-insecure-secret-change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24h, generous for hackathon demo

    # --- Redis (pub/sub for WebSocket fan-out, optional) ---
    REDIS_URL: str = "redis://localhost:6379/0"

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
