"""Alert business logic.

Alerts are area-wide notifications (weather warnings, advisories, simulator
signals). They surface on the citizen home banner, the Support → Authority
Messages tab, and the notification bell. Every create/update fans an
`alert.created` / `alert.updated` event out over SSE (see app/api/stream.py).

The demo does not model per-alert polygons — an alert is Chennai-demo-area
wide. `affected_area` on the model stays null for now.
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.events.broker import broker
from app.models.alert import Alert
from app.models.enums import AlertSource
from app.schemas.alert import AlertOut

_SIMULATOR_ALERT_TTL = timedelta(hours=6)


def _publish(event_type: str, alert: Alert) -> None:
    broker.publish(event_type, AlertOut.model_validate(alert).model_dump(mode="json"))


def create_alert(
    db: Session,
    *,
    source: str,
    type_: str,
    severity: str,
    message: str,
    expires_at: datetime | None = None,
) -> Alert:
    alert = Alert(
        source=source,
        type=type_,
        severity=severity,
        message=message,
        issued_at=datetime.now(timezone.utc),
        expires_at=expires_at,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    _publish("alert.created", alert)
    return alert


def list_active_alerts(db: Session, *, limit: int = 50) -> list[Alert]:
    now = datetime.now(timezone.utc)
    stmt = (
        select(Alert)
        .where((Alert.expires_at.is_(None)) | (Alert.expires_at > now))
        .order_by(Alert.issued_at.desc())
        .limit(min(limit, 200))
    )
    return list(db.execute(stmt).scalars().all())


def upsert_simulator_alert(db: Session, *, message: str, severity: str = "high") -> Alert:
    """The simulator's "START DISASTER" raises one standing alert rather than
    stacking a new row on every slider nudge — refresh the active one if it
    exists, otherwise create it."""
    now = datetime.now(timezone.utc)
    existing = (
        db.execute(
            select(Alert)
            .where(Alert.source == AlertSource.SIMULATOR.value)
            .order_by(Alert.issued_at.desc())
        )
        .scalars()
        .first()
    )
    if existing is not None and (existing.expires_at is None or existing.expires_at > now):
        existing.message = message
        existing.severity = severity
        existing.issued_at = now
        existing.expires_at = now + _SIMULATOR_ALERT_TTL
        db.commit()
        db.refresh(existing)
        _publish("alert.updated", existing)
        return existing
    return create_alert(
        db,
        source=AlertSource.SIMULATOR.value,
        type_="flood_warning",
        severity=severity,
        message=message,
        expires_at=now + _SIMULATOR_ALERT_TTL,
    )


def expire_simulator_alerts(db: Session) -> int:
    """Called when the simulator stops — retire any standing simulator alert
    so the citizen banner clears. Emits `alert.updated` so open clients
    refresh."""
    now = datetime.now(timezone.utc)
    rows = list(
        db.execute(
            select(Alert).where(
                Alert.source == AlertSource.SIMULATOR.value,
                (Alert.expires_at.is_(None)) | (Alert.expires_at > now),
            )
        )
        .scalars()
        .all()
    )
    for alert in rows:
        alert.expires_at = now
    if rows:
        db.commit()
        for alert in rows:
            db.refresh(alert)
            _publish("alert.updated", alert)
    return len(rows)
