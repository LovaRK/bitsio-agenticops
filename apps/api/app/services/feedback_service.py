"""AI Feedback persistence service.

Captures user quality signals (thumbs up/down + optional category/comment)
linked to model metadata for future evaluation dashboards.
"""

from __future__ import annotations

import logging
import uuid
from abc import ABC, abstractmethod
from datetime import UTC, datetime
from typing import Any

from decision_tracing.conversation_models import AIFeedback

log = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(UTC)


def _uuid() -> str:
    return str(uuid.uuid4())


# ── Abstract port ─────────────────────────────────────────────────────────────

class FeedbackStore(ABC):

    @abstractmethod
    async def save_feedback(
        self,
        *,
        target_type: str,
        target_id: str,
        rating: str,
        thread_id: str | None = None,
        user_id: str = "anonymous",
        category: str | None = None,
        comment: str | None = None,
        model_provider: str | None = None,
        model_name: str | None = None,
        artifact_type: str | None = None,
        artifact_id: str | None = None,
    ) -> AIFeedback: ...

    @abstractmethod
    async def list_feedback(
        self,
        *,
        target_type: str | None = None,
        target_id: str | None = None,
        limit: int = 100,
    ) -> list[AIFeedback]: ...


# ── In-memory fallback ────────────────────────────────────────────────────────

class InMemoryFeedbackStore(FeedbackStore):
    def __init__(self) -> None:
        self._items: list[AIFeedback] = []

    async def save_feedback(self, **kwargs: Any) -> AIFeedback:
        fb = AIFeedback(
            feedback_id=_uuid(),
            target_type=kwargs["target_type"],
            target_id=kwargs["target_id"],
            thread_id=kwargs.get("thread_id"),
            user_id=kwargs.get("user_id", "anonymous"),
            rating=kwargs["rating"],
            category=kwargs.get("category"),
            comment=kwargs.get("comment"),
            model_provider=kwargs.get("model_provider"),
            model_name=kwargs.get("model_name"),
            artifact_type=kwargs.get("artifact_type"),
            artifact_id=kwargs.get("artifact_id"),
            created_at=_now(),
        )
        self._items.append(fb)
        log.debug("feedback saved id=%s rating=%s", fb.feedback_id, fb.rating)
        return fb

    async def list_feedback(
        self,
        *,
        target_type: str | None = None,
        target_id: str | None = None,
        limit: int = 100,
    ) -> list[AIFeedback]:
        results = list(self._items)
        if target_type:
            results = [f for f in results if f.target_type == target_type]
        if target_id:
            results = [f for f in results if f.target_id == target_id]
        results.sort(key=lambda f: f.created_at, reverse=True)
        return results[:limit]


# ── Postgres-backed store ─────────────────────────────────────────────────────

class PostgresFeedbackStore(FeedbackStore):
    def __init__(self, pool: Any) -> None:
        self._pool = pool

    async def save_feedback(self, **kwargs: Any) -> AIFeedback:
        fb_id = _uuid()
        now = _now()
        async with self._pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO ai_feedback
                  (id, target_type, target_id, thread_id, user_id,
                   rating, category, comment,
                   model_provider, model_name,
                   artifact_type, artifact_id, created_at)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
                """,
                fb_id,
                kwargs["target_type"],
                kwargs["target_id"],
                kwargs.get("thread_id"),
                kwargs.get("user_id", "anonymous"),
                kwargs["rating"],
                kwargs.get("category"),
                kwargs.get("comment"),
                kwargs.get("model_provider"),
                kwargs.get("model_name"),
                kwargs.get("artifact_type"),
                kwargs.get("artifact_id"),
                now,
            )
        return AIFeedback(
            feedback_id=fb_id,
            target_type=kwargs["target_type"],
            target_id=kwargs["target_id"],
            thread_id=kwargs.get("thread_id"),
            user_id=kwargs.get("user_id", "anonymous"),
            rating=kwargs["rating"],
            category=kwargs.get("category"),
            comment=kwargs.get("comment"),
            model_provider=kwargs.get("model_provider"),
            model_name=kwargs.get("model_name"),
            artifact_type=kwargs.get("artifact_type"),
            artifact_id=kwargs.get("artifact_id"),
            created_at=now,
        )

    async def list_feedback(
        self,
        *,
        target_type: str | None = None,
        target_id: str | None = None,
        limit: int = 100,
    ) -> list[AIFeedback]:
        clauses = []
        params: list[Any] = []
        if target_type:
            params.append(target_type)
            clauses.append(f"target_type=${len(params)}")
        if target_id:
            params.append(target_id)
            clauses.append(f"target_id=${len(params)}")
        where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
        params.append(limit)
        q = f"""
            SELECT * FROM ai_feedback
            {where}
            ORDER BY created_at DESC
            LIMIT ${len(params)}
        """
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(q, *params)
        return [
            AIFeedback(
                feedback_id=str(row["id"]),
                target_type=row["target_type"],
                target_id=row["target_id"],
                thread_id=row.get("thread_id"),
                user_id=row.get("user_id", "anonymous"),
                rating=row["rating"],
                category=row.get("category"),
                comment=row.get("comment"),
                model_provider=row.get("model_provider"),
                model_name=row.get("model_name"),
                artifact_type=row.get("artifact_type"),
                artifact_id=row.get("artifact_id"),
                created_at=row["created_at"],
            )
            for row in rows
        ]
