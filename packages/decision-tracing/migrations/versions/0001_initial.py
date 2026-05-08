"""initial decision tracing schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-04-08
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "decision_traces",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("workflow_id", sa.Text(), nullable=False, unique=True),
        sa.Column("incident_id", sa.Text(), nullable=False),
        sa.Column("graph_name", sa.Text(), nullable=False),
        sa.Column("graph_version", sa.Text(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
    )

    op.create_table(
        "node_runs",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "decision_trace_id",
            sa.BigInteger(),
            sa.ForeignKey("decision_traces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("node_name", sa.Text(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("input_hash", sa.Text(), nullable=False),
        sa.Column("output_hash", sa.Text(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
    )

    op.create_table(
        "approval_events",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("workflow_id", sa.Text(), nullable=False),
        sa.Column("approver", sa.Text(), nullable=False),
        sa.Column("decision", sa.Text(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
    )

    op.create_index("idx_decision_traces_incident_id", "decision_traces", ["incident_id"])
    op.create_index("idx_decision_traces_graph_name", "decision_traces", ["graph_name"])
    op.create_index("idx_decision_traces_started_at", "decision_traces", ["started_at"])
    op.create_index("idx_node_runs_trace_id", "node_runs", ["decision_trace_id"])


def downgrade() -> None:
    op.drop_index("idx_node_runs_trace_id", table_name="node_runs")
    op.drop_index("idx_decision_traces_started_at", table_name="decision_traces")
    op.drop_index("idx_decision_traces_graph_name", table_name="decision_traces")
    op.drop_index("idx_decision_traces_incident_id", table_name="decision_traces")
    op.drop_table("approval_events")
    op.drop_table("node_runs")
    op.drop_table("decision_traces")
