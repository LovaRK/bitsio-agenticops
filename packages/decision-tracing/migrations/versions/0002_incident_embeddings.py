"""incident embeddings table for ICA vector search

Revision ID: 0002_incident_embeddings
Revises: 0001_initial
Create Date: 2026-04-16
"""

from __future__ import annotations

from alembic import op

revision = "0002_incident_embeddings"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.execute(
        """
        CREATE TABLE incident_embeddings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            incident_id VARCHAR(64) NOT NULL UNIQUE,
            tenant_safe_id VARCHAR(64) NOT NULL,
            embedding vector(1536) NOT NULL,
            summary TEXT NOT NULL,
            severity VARCHAR(16),
            service_name VARCHAR(128),
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
        """
    )
    op.execute(
        "CREATE INDEX incident_embeddings_vector_idx ON incident_embeddings "
        "USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)"
    )
    op.execute("CREATE INDEX incident_embeddings_tenant_idx ON incident_embeddings (tenant_safe_id)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS incident_embeddings_tenant_idx")
    op.execute("DROP INDEX IF EXISTS incident_embeddings_vector_idx")
    op.drop_table("incident_embeddings")
