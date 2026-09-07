from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.deps import require_role
from app.database import get_db
from app.models.user import User
from app.schemas.rescue_operation import (
    RescueOperationCreate,
    RescueOperationOut,
    RescueOperationUpdate,
)
from app.services import rescue_operations as rescue_service

router = APIRouter(tags=["rescue-operations"])


@router.get("/rescue-operations", response_model=list[RescueOperationOut])
def list_rescue_operations(
    _current_user: User = Depends(require_role("responder", "admin")),
    db: Session = Depends(get_db),
) -> list[RescueOperationOut]:
    return rescue_service.list_rescue_operations(db)


@router.post(
    "/rescue-operations",
    response_model=RescueOperationOut,
    status_code=status.HTTP_201_CREATED,
)
def create_rescue_operation(
    payload: RescueOperationCreate,
    _current_user: User = Depends(require_role("responder", "admin")),
    db: Session = Depends(get_db),
) -> RescueOperationOut:
    """Dispatch: assign the nearest available responder to a verified
    incident, with a safe route + ETA."""
    return rescue_service.create_rescue_operation(db, incident_id=payload.incident_id)


@router.patch("/rescue-operations/{op_id}", response_model=RescueOperationOut)
def update_rescue_operation(
    op_id: int,
    payload: RescueOperationUpdate,
    _current_user: User = Depends(require_role("responder", "admin")),
    db: Session = Depends(get_db),
) -> RescueOperationOut:
    return rescue_service.update_rescue_operation(db, op_id, new_status=payload.status.value)
