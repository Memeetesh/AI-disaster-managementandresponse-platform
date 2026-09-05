"""SQLAlchemy engine/session setup.

Synchronous SQLAlchemy (psycopg2) is used deliberately over async — this is a
hackathon MVP and sync sessions keep the ORM, Alembic migrations, and request
handlers simple. FastAPI runs sync `def` endpoints in a threadpool, so this
does not block the event loop that WebSockets rely on.
"""
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency: yields a request-scoped DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
