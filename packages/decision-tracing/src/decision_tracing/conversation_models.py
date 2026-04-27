"""Domain models for multi-turn conversations and AI feedback."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


# ── Token / Cost ─────────────────────────────────────────────────────────────

class TokenMeta(BaseModel):
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    estimated_cost_usd: float | None = None
    cost_source: Literal["reported", "derived", "not_applicable"] = "not_applicable"
    latency_ms: int | None = None
    provider: str | None = None
    model: str | None = None


# ── Debug ─────────────────────────────────────────────────────────────────────

class DebugMeta(BaseModel):
    model_provider: str | None = None
    model_name: str | None = None
    runtime_mode: str | None = None
    adapter_mode: str | None = None
    prompt_template: str | None = None
    context_source: str | None = None
    input_token_estimate: int | None = None
    output_token_estimate: int | None = None
    latency_ms: int | None = None
    fallback_used: bool = False
    retrieval_mode: str | None = None
    tools_selected: list[str] = Field(default_factory=list)
    redacted: bool = False  # True if sensitive details were omitted


# ── Conversation Thread ───────────────────────────────────────────────────────

class ConversationThread(BaseModel):
    thread_id: str
    thread_type: Literal["telemetry", "fraud", "incident", "approval", "general"]
    artifact_type: str | None = None
    artifact_id: str | None = None
    title: str | None = None
    created_by: str = "system"
    created_at: datetime
    updated_at: datetime
    message_count: int = 0


class ConversationMessage(BaseModel):
    message_id: str
    thread_id: str
    role: Literal["user", "assistant", "system"]
    content: str
    token_meta: TokenMeta | None = None
    debug_meta: DebugMeta | None = None
    created_at: datetime


class ConversationThread_WithMessages(ConversationThread):
    messages: list[ConversationMessage] = Field(default_factory=list)
    token_totals: TokenMeta | None = None


# ── AI Feedback ───────────────────────────────────────────────────────────────

class AIFeedback(BaseModel):
    feedback_id: str
    target_type: Literal[
        "message", "incident_analysis", "fraud_analysis", "telemetry_response", "batch_result"
    ]
    target_id: str
    thread_id: str | None = None
    user_id: str = "anonymous"
    rating: Literal["thumbs_up", "thumbs_down"]
    category: (
        Literal["wrong_reasoning", "missing_context", "poor_formatting", "low_trust", "other"] | None
    ) = None
    comment: str | None = None
    model_provider: str | None = None
    model_name: str | None = None
    artifact_type: str | None = None
    artifact_id: str | None = None
    created_at: datetime


# ── Batch ─────────────────────────────────────────────────────────────────────

class BatchItem(BaseModel):
    item_id: str
    success: bool
    result: Any | None = None
    error: str | None = None
    token_meta: TokenMeta | None = None


class BatchResult(BaseModel):
    batch_id: str
    total: int
    succeeded: int
    failed: int
    items: list[BatchItem]
    aggregate_summary: str | None = None
    token_summary: TokenMeta | None = None
    debug_summary: DebugMeta | None = None
    created_at: datetime
