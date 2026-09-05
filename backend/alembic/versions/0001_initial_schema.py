"""initial schema: users, incidents, incident_evidence, alerts, shelters,
responders, resources, rescue_operations, risk_zones

Revision ID: 0001
Revises:
Create Date: 2026-09-05
"""
from typing import Sequence, Union

import geoalchemy2
import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("phone", sa.String(20), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="citizen"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_users_phone", "users", ["phone"], unique=True)
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_role", "users", ["role"])

    op.create_table(
        "incidents",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("type", sa.String(30), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("location", geoalchemy2.Geometry(geometry_type="POINT", srid=4326), nullable=True),
        sa.Column("severity", sa.String(20), nullable=False, server_default="moderate"),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(20), nullable=False, server_default="reported"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("reported_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("people_affected", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_incidents_type", "incidents", ["type"])
    op.create_index("ix_incidents_severity", "incidents", ["severity"])
    op.create_index("ix_incidents_status", "incidents", ["status"])
    op.execute("CREATE INDEX ix_incidents_location ON incidents USING GIST (location)")

    op.create_table(
        "incident_evidence",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "incident_id",
            sa.Integer(),
            sa.ForeignKey("incidents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("image_url", sa.String(500), nullable=True),
        sa.Column("video_url", sa.String(500), nullable=True),
        sa.Column("audio_url", sa.String(500), nullable=True),
        sa.Column("extracted_text", sa.Text(), nullable=True),
        sa.Column("ai_detection", sa.JSON(), nullable=True),
        sa.Column("ai_confidence", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_incident_evidence_incident_id", "incident_evidence", ["incident_id"])

    op.create_table(
        "alerts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source", sa.String(20), nullable=False),
        sa.Column("type", sa.String(30), nullable=False),
        sa.Column("severity", sa.String(20), nullable=False),
        sa.Column("affected_area", geoalchemy2.Geometry(geometry_type="POLYGON", srid=4326), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_alerts_source", "alerts", ["source"])
    op.create_index("ix_alerts_type", "alerts", ["type"])
    op.execute("CREATE INDEX ix_alerts_affected_area ON alerts USING GIST (affected_area)")

    op.create_table(
        "shelters",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("location", geoalchemy2.Geometry(geometry_type="POINT", srid=4326), nullable=True),
        sa.Column("capacity", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("occupied", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("facilities", sa.JSON(), nullable=True),
        sa.Column("accessibility", sa.String(50), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="open"),
    )
    op.create_index("ix_shelters_status", "shelters", ["status"])
    op.execute("CREATE INDEX ix_shelters_location ON shelters USING GIST (location)")

    op.create_table(
        "responders",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("team", sa.String(100), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("location", geoalchemy2.Geometry(geometry_type="POINT", srid=4326), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="available"),
        sa.Column("vehicle", sa.String(50), nullable=True),
        sa.Column("capacity", sa.Integer(), nullable=False, server_default="1"),
    )
    op.create_index("ix_responders_status", "responders", ["status"])
    op.execute("CREATE INDEX ix_responders_location ON responders USING GIST (location)")

    op.create_table(
        "resources",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("location", geoalchemy2.Geometry(geometry_type="POINT", srid=4326), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="available"),
    )
    op.create_index("ix_resources_type", "resources", ["type"])
    op.create_index("ix_resources_status", "resources", ["status"])
    op.execute("CREATE INDEX ix_resources_location ON resources USING GIST (location)")

    op.create_table(
        "rescue_operations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "incident_id", sa.Integer(), sa.ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("responder_id", sa.Integer(), sa.ForeignKey("responders.id"), nullable=True),
        sa.Column("priority", sa.String(20), nullable=False, server_default="medium"),
        sa.Column("route", geoalchemy2.Geometry(geometry_type="LINESTRING", srid=4326), nullable=True),
        sa.Column("eta_minutes", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_rescue_operations_incident_id", "rescue_operations", ["incident_id"])
    op.create_index("ix_rescue_operations_responder_id", "rescue_operations", ["responder_id"])
    op.create_index("ix_rescue_operations_priority", "rescue_operations", ["priority"])
    op.create_index("ix_rescue_operations_status", "rescue_operations", ["status"])

    op.create_table(
        "risk_zones",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("geometry", geoalchemy2.Geometry(geometry_type="POLYGON", srid=4326), nullable=False),
        sa.Column("risk_score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("hazard_score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("population_exposure", sa.Float(), nullable=False, server_default="0"),
        sa.Column("infrastructure_vulnerability", sa.Float(), nullable=False, server_default="0"),
        sa.Column("accessibility_score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("historical_risk_score", sa.Float(), nullable=False, server_default="0"),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )
    op.create_index("ix_risk_zones_risk_score", "risk_zones", ["risk_score"])
    op.execute("CREATE INDEX ix_risk_zones_geometry ON risk_zones USING GIST (geometry)")


def downgrade() -> None:
    op.drop_table("risk_zones")
    op.drop_table("rescue_operations")
    op.drop_table("resources")
    op.drop_table("responders")
    op.drop_table("shelters")
    op.drop_table("alerts")
    op.drop_table("incident_evidence")
    op.drop_table("incidents")
    op.drop_table("users")
