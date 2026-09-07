"""check_ins table (citizen "I am Safe" self check-ins)

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-07
"""
from typing import Sequence, Union

import geoalchemy2
import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, Sequence[str], None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "check_ins",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="safe"),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column(
            "location",
            geoalchemy2.Geometry(geometry_type="POINT", srid=4326, spatial_index=False),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_check_ins_user_id", "check_ins", ["user_id"])
    op.execute("CREATE INDEX ix_check_ins_location ON check_ins USING GIST (location)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_check_ins_location")
    op.drop_index("ix_check_ins_user_id", table_name="check_ins")
    op.drop_table("check_ins")
