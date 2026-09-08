"""family_links table (citizen family safety circle)

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-08
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, Sequence[str], None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "family_links",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("phone", sa.String(20), nullable=False),
        sa.Column("relation", sa.String(40), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("owner_id", "phone", name="uq_family_owner_phone"),
    )
    op.create_index("ix_family_links_owner_id", "family_links", ["owner_id"])
    op.create_index("ix_family_links_phone", "family_links", ["phone"])


def downgrade() -> None:
    op.drop_index("ix_family_links_phone", table_name="family_links")
    op.drop_index("ix_family_links_owner_id", table_name="family_links")
    op.drop_table("family_links")
