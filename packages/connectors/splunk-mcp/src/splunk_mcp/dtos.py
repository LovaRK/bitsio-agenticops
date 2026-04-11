from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class IndexDTO(BaseModel):
    name: str
    size_mb: float
    event_count: int


class SearchResultDTO(BaseModel):
    results: list[dict[str, Any]] = Field(default_factory=list)
    messages: list[str] = Field(default_factory=list)
    done: bool


class ServerInfoDTO(BaseModel):
    version: str
    build: str
    mode: str


class StandardizedErrorDTO(BaseModel):
    code: str
    message: str
    retryable: bool
