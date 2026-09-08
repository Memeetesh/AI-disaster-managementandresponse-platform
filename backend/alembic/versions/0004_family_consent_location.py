"""family link consent (member accept/decline) + opt-in location sharing

Revision ID: 0004
Revises: 0003
Create Date: 2026-09-08
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: Union[str, Sequence[str], None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "family_links",
        sa.Column("member_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
    )
    op.add_column(
        "family_links",
        sa.Column("status", sa.String(12), nullable=False, server_default="accepted"),
    )
    op.create_index(
        "ix_family_links_member_user_id", "family_links", ["member_user_id"]
    )

    op.create_table(
        "location_shares",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", name="uq_location_shares_user"),
    )
    op.create_index("ix_location_shares_user_id", "location_shares", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_location_shares_user_id", table_name="location_shares")
    op.drop_table("location_shares")
    op.drop_index("ix_family_links_member_user_id", table_name="family_links")
    op.drop_column("family_links", "status")
    op.drop_column("family_links", "member_user_id")
