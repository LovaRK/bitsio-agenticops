"""
PostgreSQL-backed DecisionTrace store using asyncpg.

Drop-in replacement for InMemoryDecisionTraceStore when a real database
is available. Activated by setting DATABASE_URL in the environment.

Usage (FastAPI lifespan):
    from decision_tracing.pg_store import PostgresDecisionTraceStore
    store = PostgresDecisionTraceStore(dsn=settings.database_url)
    await store.connect()
    ...
    await store.close()
"""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime

from decision_tracing.hashing import hash_content
from decision_tracing.models import ApprovalEvent, ApprovalRequest, DecisionTrace, NodeRun

log = logging.getLogger(__name__)


class PostgresDecisionTraceStore:
    """Async PostgreSQL store for DecisionTrace records and ApprovalEvents."""

    def __init__(self, dsn: str) -> None:
        self._dsn = dsn
        self._pool: "asyncpg.Pool | None" = None  # type: ignore[name-defined]

    async def connect(self) -> None:
        try:
            import asyncpg  # type: ignore[import]

            self._pool = await asyncpg.create_pool(self._dsn, min_size=2, max_size=10)
            log.info("PostgresDecisionTraceStore connected to %s", self._dsn.split("@")[-1])
        except Exception as exc:
            log.warning(
                "Could not connect to PostgreSQL (%s) — falling back to in-memory store.", exc
            )
            self._pool = None

    async def close(self) -> None:
        if self._pool:
            await self._pool.close()
            log.info("PostgresDecisionTraceStore pool closed.")

    @property
    def _is_connected(self) -> bool:
        return self._pool is not None

    # ── Public interface ──────────────────────────────────────────────────────

    async def get(self, workflow_id: str) -> DecisionTrace | None:
        if not self._is_connected:
            return None
        async with self._pool.acquire() as conn:  # type: ignore[union-attr]
            row = await conn.fetchrow(
                "SELECT payload FROM decision_traces WHERE workflow_id = $1",
                workflow_id,
            )
        if row is None:
            return None
        return DecisionTrace.model_validate(json.loads(row["payload"]))

    async def upsert(
        self, trace: DecisionTrace, *, force_merge: bool = False
    ) -> tuple[DecisionTrace, bool]:
        if not self._is_connected:
            raise RuntimeError("PostgresDecisionTraceStore is not connected.")

        payload_json = trace.model_dump_json()
        content_hash = hash_content(trace.model_dump())

        async with self._pool.acquire() as conn:  # type: ignore[union-attr]
            existing = await conn.fetchrow(
                "SELECT id, payload FROM decision_traces WHERE workflow_id = $1",
                trace.workflow_id,
            )

            if existing and not force_merge:
                existing_trace = DecisionTrace.model_validate(
                    json.loads(existing["payload"])
                )
                return existing_trace, False

            if existing and force_merge:
                existing_trace = DecisionTrace.model_validate(
                    json.loads(existing["payload"])
                )
                merged = existing_trace.model_copy(deep=True)
                merged.node_runs.extend(trace.node_runs)
                merged.completed_at = trace.completed_at
                merged.final_assessment = trace.final_assessment
                merged.confidence = trace.confidence
                merged.approval_required = trace.approval_required
                merged_json = merged.model_dump_json()
                await conn.execute(
                    """
                    UPDATE decision_traces
                       SET payload = $1, completed_at = $2
                     WHERE workflow_id = $3
                    """,
                    merged_json,
                    merged.completed_at,
                    trace.workflow_id,
                )
                # Persist new node_runs rows
                await self._insert_node_runs(conn, existing["id"], trace.node_runs)
                return merged, False

            # Insert new trace
            row_id = await conn.fetchval(
                """
                INSERT INTO decision_traces
                    (workflow_id, incident_id, graph_name, graph_version,
                     started_at, completed_at, payload)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id
                """,
                trace.workflow_id,
                trace.incident_id,
                trace.graph_name,
                trace.graph_version,
                trace.started_at,
                trace.completed_at,
                payload_json,
            )
            await self._insert_node_runs(conn, row_id, trace.node_runs)
            log.info(
                "Inserted decision_trace workflow_id=%s hash=%s",
                trace.workflow_id,
                content_hash[:12],
            )
            return trace, True

    async def add_approval(
        self, workflow_id: str, request: ApprovalRequest
    ) -> ApprovalEvent:
        event = ApprovalEvent(
            workflow_id=workflow_id,
            approver=request.approver,
            decision=request.decision,
            reason=request.reason,
            created_at=datetime.now(tz=UTC),
        )
        if self._is_connected:
            async with self._pool.acquire() as conn:  # type: ignore[union-attr]
                await conn.execute(
                    """
                    INSERT INTO approval_events
                        (workflow_id, approver, decision, reason, created_at)
                    VALUES ($1, $2, $3, $4, $5)
                    """,
                    workflow_id,
                    event.approver,
                    event.decision,
                    event.reason,
                    event.created_at,
                )
            log.info(
                "Recorded approval workflow_id=%s decision=%s approver=%s",
                workflow_id,
                event.decision,
                event.approver,
            )
        return event

    async def list_approvals(self, workflow_id: str) -> list[ApprovalEvent]:
        if not self._is_connected:
            return []
        async with self._pool.acquire() as conn:  # type: ignore[union-attr]
            rows = await conn.fetch(
                "SELECT * FROM approval_events WHERE workflow_id = $1 ORDER BY created_at",
                workflow_id,
            )
        return [
            ApprovalEvent(
                workflow_id=row["workflow_id"],
                approver=row["approver"],
                decision=row["decision"],
                reason=row["reason"],
                created_at=row["created_at"],
            )
            for row in rows
        ]

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    async def _insert_node_runs(
        conn: "asyncpg.Connection",  # type: ignore[name-defined]
        trace_db_id: int,
        node_runs: list[NodeRun],
    ) -> None:
        for run in node_runs:
            await conn.execute(
                """
                INSERT INTO node_runs
                    (decision_trace_id, node_name, started_at, status,
                     input_hash, output_hash, payload)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                """,
                trace_db_id,
                run.node_name,
                run.started_at,
                run.status,
                run.input_hash,
                run.output_hash,
                run.model_dump_json(),
            )
