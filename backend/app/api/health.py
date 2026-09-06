from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db

router = APIRouter(tags=["health"])


@router.get("/health")
def health_check(db: Session = Depends(get_db)) -> dict:
    """Liveness + DB connectivity check. Never fails the whole app if the
    DB is briefly unreachable — it reports the fact instead of 500ing, so
    uptime monitors/load balancers can distinguish "app is up" from
    "app is up but DB is down"."""
    db_status = "ok"
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001 - deliberately broad for a health probe
        db_status = f"error: {exc.__class__.__name__}"

    return {"status": "ok", "database": db_status}
