"""add model mode and user opt-in fields to decision traces

Revision ID: 0003_model_metadata
Revises: 0002_incident_embeddings
Create Date: 2026-04-24
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0003_model_metadata"
down_revision = "0002_incident_embeddings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "decision_traces",
        sa.Column("model_mode", sa.String(16), nullable=False, server_default="local"),
    )
    op.add_column(
        "decision_traces",
        sa.Column("user_opt_in", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("decision_traces", "user_opt_in")
    op.drop_column("decision_traces", "model_mode")
