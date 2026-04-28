"""model metadata for decision traces

Revision ID: 0003_model_metadata
Revises: 0002_incident_embeddings
Create Date: 2026-04-20
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0003_model_metadata"
down_revision = "0002_incident_embeddings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("decision_traces", sa.Column("model_provider", sa.Text(), nullable=True))
    op.add_column("decision_traces", sa.Column("model_name", sa.Text(), nullable=True))
    op.add_column("decision_traces", sa.Column("latency_ms", sa.Integer(), nullable=True))

    # Update existing rows with defaults if needed
    op.execute("UPDATE decision_traces SET model_provider = 'unknown' WHERE model_provider IS NULL")
    op.execute("UPDATE decision_traces SET model_name = 'unknown' WHERE model_name IS NULL")


def downgrade() -> None:
    op.drop_column("decision_traces", "latency_ms")
    op.drop_column("decision_traces", "model_name")
    op.drop_column("decision_traces", "model_provider")
