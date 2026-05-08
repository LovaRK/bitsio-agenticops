from __future__ import annotations

import hashlib
from typing import Any, Protocol

from sqlalchemy import text
from sqlalchemy.orm import Session


class EmbeddingService(Protocol):
    def embed(self, text: str) -> list[float]: ...

    def search_similar(self, embedding: list[float], top_k: int = 5) -> list[dict[str, Any]]: ...


class StubEmbeddingService:
    def __init__(self, candidates: list[dict[str, Any]] | None = None) -> None:
        default_candidates = [
            {
                "incident_id": "inc_hist_001",
                "title": "Payments timeout burst",
                "summary": "Timeouts on payments-api with retry storm",
                "severity": "high",
                "timestamp": "2026-04-01T10:00:00Z",
                "raw_score": 0.91,
            },
            {
                "incident_id": "inc_hist_002",
                "title": "Checkout latency regression",
                "summary": "Latency increase due to DB saturation",
                "severity": "medium",
                "timestamp": "2026-03-28T09:00:00Z",
                "raw_score": 0.84,
            },
            {
                "incident_id": "inc_hist_003",
                "title": "Auth cache churn",
                "summary": "Intermittent auth token cache misses",
                "severity": "low",
                "timestamp": "2026-03-22T08:00:00Z",
                "raw_score": 0.68,
            },
            {
                "incident_id": "inc_hist_004",
                "title": "API gateway retry amplification",
                "summary": "Gateway retries amplified upstream failures",
                "severity": "high",
                "timestamp": "2026-03-15T07:00:00Z",
                "raw_score": 0.79,
            },
            {
                "incident_id": "inc_hist_005",
                "title": "Order queue pressure",
                "summary": "Delayed order processing during peak",
                "severity": "medium",
                "timestamp": "2026-03-10T06:00:00Z",
                "raw_score": 0.72,
            },
        ]
        self.candidates = default_candidates if candidates is None else candidates

    def embed(self, text: str) -> list[float]:
        digest = hashlib.sha256(text.encode("utf-8")).digest()
        return [round(b / 255.0, 6) for b in digest[:16]]

    def search_similar(self, embedding: list[float], top_k: int = 5) -> list[dict[str, Any]]:
        _ = embedding
        return self.candidates[:top_k]


class PgvectorEmbeddingService:
    """Scaffold for production vector search using incident_embeddings."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def embed(self, text: str) -> list[float]:
        digest = hashlib.sha256(text.encode("utf-8")).digest()
        return [round(b / 255.0, 6) for b in digest[:16]]

    def search_similar(self, embedding: list[float], top_k: int = 5) -> list[dict[str, Any]]:
        embedding_literal = "[" + ",".join(str(item) for item in embedding) + "]"
        query = text(
            """
            SELECT incident_id, summary, severity, service_name,
                   1 - (embedding <=> CAST(:embedding AS vector)) AS raw_score
            FROM incident_embeddings
            ORDER BY embedding <=> CAST(:embedding AS vector)
            LIMIT :top_k
            """
        )
        rows = self.session.execute(
            query,
            {"embedding": embedding_literal, "top_k": int(top_k)},
        ).mappings()
        return [dict(row) for row in rows]
