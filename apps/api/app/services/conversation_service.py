"""Conversation thread and message persistence service.

Provides an asyncpg-backed store with an in-memory fallback for tests/dev.
Compatible with later LangGraph checkpointer integration — the thread model
intentionally mirrors LangGraph's thread_id / checkpoint pattern.
"""

from __future__ import annotations

import json
import logging
import uuid
from abc import ABC, abstractmethod
from datetime import UTC, datetime
from typing import Any

from decision_tracing.conversation_models import (
    ConversationMessage,
    ConversationThread,
    ConversationThread_WithMessages,
    DebugMeta,
    TokenMeta,
)

log = logging.getLogger(__name__)

MAX_MESSAGES_PER_THREAD = 100  # guard against unbounded growth


def _now() -> datetime:
    return datetime.now(UTC)


def _uuid() -> str:
    return str(uuid.uuid4())


def _parse_token_meta(row_json: str | None) -> TokenMeta | None:
    if not row_json:
        return None
    try:
        data = json.loads(row_json) if isinstance(row_json, str) else row_json
        return TokenMeta(**data)
    except Exception:
        return None


def _parse_debug_meta(row_json: str | None) -> DebugMeta | None:
    if not row_json:
        return None
    try:
        data = json.loads(row_json) if isinstance(row_json, str) else row_json
        return DebugMeta(**data)
    except Exception:
        return None


# ── Abstract port ─────────────────────────────────────────────────────────────

class ConversationStore(ABC):

    @abstractmethod
    async def create_thread(
        self,
        *,
        thread_type: str,
        artifact_type: str | None,
        artifact_id: str | None,
        title: str | None,
        created_by: str,
    ) -> ConversationThread: ...

    @abstractmethod
    async def get_thread(self, thread_id: str) -> ConversationThread | None: ...

    @abstractmethod
    async def list_threads(
        self,
        *,
        artifact_type: str | None = None,
        artifact_id: str | None = None,
        limit: int = 50,
    ) -> list[ConversationThread]: ...

    @abstractmethod
    async def add_message(
        self,
        *,
        thread_id: str,
        role: str,
        content: str,
        token_meta: TokenMeta | None = None,
        debug_meta: DebugMeta | None = None,
    ) -> ConversationMessage: ...

    @abstractmethod
    async def list_messages(
        self,
        thread_id: str,
        *,
        limit: int = MAX_MESSAGES_PER_THREAD,
    ) -> list[ConversationMessage]: ...

    @abstractmethod
    async def get_thread_with_messages(
        self, thread_id: str
    ) -> ConversationThread_WithMessages | None: ...


# ── In-memory fallback ────────────────────────────────────────────────────────

class InMemoryConversationStore(ConversationStore):
    def __init__(self) -> None:
        self._threads: dict[str, ConversationThread] = {}
        self._messages: dict[str, list[ConversationMessage]] = {}

    async def create_thread(
        self,
        *,
        thread_type: str,
        artifact_type: str | None,
        artifact_id: str | None,
        title: str | None,
        created_by: str,
    ) -> ConversationThread:
        thread_id = _uuid()
        now = _now()
        thread = ConversationThread(
            thread_id=thread_id,
            thread_type=thread_type,  # type: ignore[arg-type]
            artifact_type=artifact_type,
            artifact_id=artifact_id,
            title=title,
            created_by=created_by,
            created_at=now,
            updated_at=now,
            message_count=0,
        )
        self._threads[thread_id] = thread
        self._messages[thread_id] = []
        return thread

    async def get_thread(self, thread_id: str) -> ConversationThread | None:
        return self._threads.get(thread_id)

    async def list_threads(
        self,
        *,
        artifact_type: str | None = None,
        artifact_id: str | None = None,
        limit: int = 50,
    ) -> list[ConversationThread]:
        results = list(self._threads.values())
        if artifact_type:
            results = [t for t in results if t.artifact_type == artifact_type]
        if artifact_id:
            results = [t for t in results if t.artifact_id == artifact_id]
        results.sort(key=lambda t: t.updated_at, reverse=True)
        return results[:limit]

    async def add_message(
        self,
        *,
        thread_id: str,
        role: str,
        content: str,
        token_meta: TokenMeta | None = None,
        debug_meta: DebugMeta | None = None,
    ) -> ConversationMessage:
        if thread_id not in self._threads:
            raise ValueError(f"Thread {thread_id} not found")
        msg = ConversationMessage(
            message_id=_uuid(),
            thread_id=thread_id,
            role=role,  # type: ignore[arg-type]
            content=content,
            token_meta=token_meta,
            debug_meta=debug_meta,
            created_at=_now(),
        )
        messages = self._messages.setdefault(thread_id, [])
        messages.append(msg)
        # Update thread metadata
        thread = self._threads[thread_id]
        self._threads[thread_id] = thread.model_copy(
            update={"updated_at": msg.created_at, "message_count": len(messages)}
        )
        return msg

    async def list_messages(
        self,
        thread_id: str,
        *,
        limit: int = MAX_MESSAGES_PER_THREAD,
    ) -> list[ConversationMessage]:
        messages = self._messages.get(thread_id, [])
        return messages[-limit:]

    async def get_thread_with_messages(
        self, thread_id: str
    ) -> ConversationThread_WithMessages | None:
        thread = self._threads.get(thread_id)
        if not thread:
            return None
        messages = self._messages.get(thread_id, [])
        # Compute token totals across assistant messages
        input_total = sum(m.token_meta.input_tokens for m in messages if m.token_meta)
        output_total = sum(m.token_meta.output_tokens for m in messages if m.token_meta)
        total_tokens = input_total + output_total
        costs = [
            m.token_meta.estimated_cost_usd
            for m in messages
            if m.token_meta and m.token_meta.estimated_cost_usd is not None
        ]
        totals = TokenMeta(
            input_tokens=input_total,
            output_tokens=output_total,
            total_tokens=total_tokens,
            estimated_cost_usd=round(sum(costs), 8) if costs else None,
            cost_source="derived" if costs else "not_applicable",
        )
        return ConversationThread_WithMessages(
            **thread.model_dump(),
            messages=messages,
            token_totals=totals,
        )


# ── Postgres-backed store ─────────────────────────────────────────────────────

class PostgresConversationStore(ConversationStore):
    """asyncpg-backed conversation store — same schema as migration 0004."""

    def __init__(self, pool: Any) -> None:
        self._pool = pool

    async def create_thread(
        self,
        *,
        thread_type: str,
        artifact_type: str | None,
        artifact_id: str | None,
        title: str | None,
        created_by: str,
    ) -> ConversationThread:
        thread_id = _uuid()
        now = _now()
        async with self._pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO conversation_threads
                  (id, thread_type, artifact_type, artifact_id, title,
                   created_by, created_at, updated_at, message_count)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0)
                """,
                thread_id, thread_type, artifact_type, artifact_id,
                title, created_by, now, now,
            )
        return ConversationThread(
            thread_id=thread_id,
            thread_type=thread_type,  # type: ignore[arg-type]
            artifact_type=artifact_type,
            artifact_id=artifact_id,
            title=title,
            created_by=created_by,
            created_at=now,
            updated_at=now,
            message_count=0,
        )

    async def get_thread(self, thread_id: str) -> ConversationThread | None:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM conversation_threads WHERE id=$1", thread_id
            )
        if not row:
            return None
        return _row_to_thread(dict(row))

    async def list_threads(
        self,
        *,
        artifact_type: str | None = None,
        artifact_id: str | None = None,
        limit: int = 50,
    ) -> list[ConversationThread]:
        clauses = []
        params: list[Any] = []
        if artifact_type:
            params.append(artifact_type)
            clauses.append(f"artifact_type=${len(params)}")
        if artifact_id:
            params.append(artifact_id)
            clauses.append(f"artifact_id=${len(params)}")
        where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
        params.append(limit)
        q = f"""
            SELECT * FROM conversation_threads
            {where}
            ORDER BY updated_at DESC
            LIMIT ${len(params)}
        """
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(q, *params)
        return [_row_to_thread(dict(r)) for r in rows]

    async def add_message(
        self,
        *,
        thread_id: str,
        role: str,
        content: str,
        token_meta: TokenMeta | None = None,
        debug_meta: DebugMeta | None = None,
    ) -> ConversationMessage:
        msg_id = _uuid()
        now = _now()
        tm = token_meta
        dm = debug_meta
        async with self._pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO conversation_messages
                  (id, thread_id, role, content,
                   model_provider, model_name, model_mode,
                   input_tokens, output_tokens, total_tokens,
                   estimated_cost_usd, latency_ms, debug_meta, created_at)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
                """,
                msg_id, thread_id, role, content,
                tm.provider if tm else None,
                tm.model if tm else None,
                None,
                tm.input_tokens if tm else None,
                tm.output_tokens if tm else None,
                tm.total_tokens if tm else None,
                tm.estimated_cost_usd if tm else None,
                tm.latency_ms if tm else None,
                json.dumps(dm.model_dump()) if dm else None,
                now,
            )
            # Bump thread updated_at + message_count atomically
            await conn.execute(
                """
                UPDATE conversation_threads
                SET updated_at=$1, message_count=message_count+1
                WHERE id=$2
                """,
                now, thread_id,
            )
        return ConversationMessage(
            message_id=msg_id,
            thread_id=thread_id,
            role=role,  # type: ignore[arg-type]
            content=content,
            token_meta=token_meta,
            debug_meta=debug_meta,
            created_at=now,
        )

    async def list_messages(
        self,
        thread_id: str,
        *,
        limit: int = MAX_MESSAGES_PER_THREAD,
    ) -> list[ConversationMessage]:
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT * FROM conversation_messages
                WHERE thread_id=$1
                ORDER BY created_at ASC
                LIMIT $2
                """,
                thread_id, limit,
            )
        return [_row_to_message(dict(r)) for r in rows]

    async def get_thread_with_messages(
        self, thread_id: str
    ) -> ConversationThread_WithMessages | None:
        thread = await self.get_thread(thread_id)
        if not thread:
            return None
        messages = await self.list_messages(thread_id)
        input_total = sum(m.token_meta.input_tokens for m in messages if m.token_meta)
        output_total = sum(m.token_meta.output_tokens for m in messages if m.token_meta)
        total_tokens = input_total + output_total
        costs = [
            m.token_meta.estimated_cost_usd
            for m in messages
            if m.token_meta and m.token_meta.estimated_cost_usd is not None
        ]
        totals = TokenMeta(
            input_tokens=input_total,
            output_tokens=output_total,
            total_tokens=total_tokens,
            estimated_cost_usd=round(sum(costs), 8) if costs else None,
            cost_source="derived" if costs else "not_applicable",
        )
        return ConversationThread_WithMessages(
            **thread.model_dump(),
            messages=messages,
            token_totals=totals,
        )


# ── Row helpers ───────────────────────────────────────────────────────────────

def _row_to_thread(row: dict) -> ConversationThread:
    return ConversationThread(
        thread_id=row["id"],
        thread_type=row["thread_type"],
        artifact_type=row.get("artifact_type"),
        artifact_id=row.get("artifact_id"),
        title=row.get("title"),
        created_by=row.get("created_by", "system"),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        message_count=row.get("message_count", 0),
    )


def _row_to_message(row: dict) -> ConversationMessage:
    tm: TokenMeta | None = None
    if row.get("input_tokens") is not None:
        tm = TokenMeta(
            input_tokens=row.get("input_tokens") or 0,
            output_tokens=row.get("output_tokens") or 0,
            total_tokens=row.get("total_tokens") or 0,
            estimated_cost_usd=row.get("estimated_cost_usd"),
            cost_source="derived",
            latency_ms=row.get("latency_ms"),
            provider=row.get("model_provider"),
            model=row.get("model_name"),
        )
    dm = _parse_debug_meta(row.get("debug_meta"))
    return ConversationMessage(
        message_id=row["id"],
        thread_id=row["thread_id"],
        role=row["role"],
        content=row["content"],
        token_meta=tm,
        debug_meta=dm,
        created_at=row["created_at"],
    )
