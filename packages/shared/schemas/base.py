"""
Shared Pydantic base classes and common DTOs used across packages.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _new_id() -> str:
    return str(uuid4())


class TimestampedModel(BaseModel):
    """Base model that auto-populates created_at."""

    created_at: datetime = Field(default_factory=_utcnow)

    model_config = {"populate_by_name": True}


class APIResponse(BaseModel):
    """Standard envelope for all API responses."""

    ok: bool = True
    data: Any = None
    error: str | None = None

    @classmethod
    def success(cls, data: Any = None) -> "APIResponse":
        return cls(ok=True, data=data)

    @classmethod
    def failure(cls, error: str) -> "APIResponse":
        return cls(ok=False, error=error)


class PaginatedResponse(BaseModel):
    """Standard paginated list wrapper."""

    items: list[Any]
    total: int
    page: int = 1
    page_size: int = 20

    @property
    def total_pages(self) -> int:
        if self.page_size == 0:
            return 0
        return (self.total + self.page_size - 1) // self.page_size


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "1.0.0"
    timestamp: datetime = Field(default_factory=_utcnow)


class ErrorDetail(BaseModel):
    """Structured error payload."""

    code: str
    message: str
    details: dict[str, Any] = Field(default_factory=dict)
