"""conversation threads, messages, and ai feedback tables

Revision ID: 0004_conversations_feedback
Revises: 0003_model_metadata
Create Date: 2026-04-26
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0004_conversations_feedback"
down_revision = "0003_model_metadata"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── conversation_threads ──────────────────────────────────────────────────
    op.create_table(
        "conversation_threads",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("thread_type", sa.String(32), nullable=False),
        sa.Column("artifact_type", sa.String(64), nullable=True),
        sa.Column("artifact_id", sa.String(255), nullable=True),
        sa.Column("title", sa.Text(), nullable=True),
        sa.Column("created_by", sa.String(255), nullable=False, server_default="system"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("message_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index(
        "ix_conv_threads_artifact",
        "conversation_threads",
        ["artifact_type", "artifact_id"],
    )

    # ── conversation_messages ─────────────────────────────────────────────────
    op.create_table(
        "conversation_messages",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("thread_id", sa.String(36), nullable=False),
        sa.Column("role", sa.String(16), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("model_provider", sa.String(64), nullable=True),
        sa.Column("model_name", sa.String(128), nullable=True),
        sa.Column("model_mode", sa.String(16), nullable=True),
        sa.Column("input_tokens", sa.Integer(), nullable=True),
        sa.Column("output_tokens", sa.Integer(), nullable=True),
        sa.Column("total_tokens", sa.Integer(), nullable=True),
        sa.Column("estimated_cost_usd", sa.Float(), nullable=True),
        sa.Column("latency_ms", sa.Integer(), nullable=True),
        sa.Column("debug_meta", sa.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["thread_id"],
            ["conversation_threads.id"],
            ondelete="CASCADE",
        ),
    )
    op.create_index("ix_conv_messages_thread_id", "conversation_messages", ["thread_id"])

    # ── ai_feedback ───────────────────────────────────────────────────────────
    op.create_table(
        "ai_feedback",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("target_type", sa.String(64), nullable=False),
        sa.Column("target_id", sa.String(255), nullable=False),
        sa.Column("thread_id", sa.String(36), nullable=True),
        sa.Column("user_id", sa.String(255), nullable=False, server_default="anonymous"),
        sa.Column("rating", sa.String(16), nullable=False),
        sa.Column("category", sa.String(64), nullable=True),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("model_provider", sa.String(64), nullable=True),
        sa.Column("model_name", sa.String(128), nullable=True),
        sa.Column("artifact_type", sa.String(64), nullable=True),
        sa.Column("artifact_id", sa.String(255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_ai_feedback_target",
        "ai_feedback",
        ["target_type", "target_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_ai_feedback_target", "ai_feedback")
    op.drop_table("ai_feedback")
    op.drop_index("ix_conv_messages_thread_id", "conversation_messages")
    op.drop_table("conversation_messages")
    op.drop_index("ix_conv_threads_artifact", "conversation_threads")
    op.drop_table("conversation_threads")
