"""Multi-turn conversation API endpoints.

Supports per-artifact conversation threads for telemetry, fraud,
incident, approval, and general contextual follow-up questions.
"""

from __future__ import annotations

import time
from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from agent_core.models.adapter import resolve_model_adapter
from apps.api.app.dependencies import get_conversation_store
from apps.api.app.services.conversation_service import ConversationStore
from apps.api.app.services.token_cost import get_token_cost_service
from decision_tracing.conversation_models import (
    ConversationThread,
    ConversationThread_WithMessages,
    DebugMeta,
    TokenMeta,
)
from packages.shared.auth import AuthContext, require_analyst
from packages.shared.config.settings import get_settings

router = APIRouter(prefix="/api/v1/conversations", tags=["conversations"])

MAX_CONTEXT_MESSAGES = 20  # messages fed to model as context


# ── Request/Response schemas ──────────────────────────────────────────────────

class CreateThreadRequest(BaseModel):
    thread_type: Literal["telemetry", "fraud", "incident", "approval", "general"]
    artifact_type: str | None = None
    artifact_id: str | None = None
    title: str | None = None
    created_by: str = "user"


class AddMessageRequest(BaseModel):
    role: Literal["user", "assistant"] = "user"
    content: str = Field(..., min_length=1, max_length=8000)
    debug: bool = False


class MessageResponse(BaseModel):
    message_id: str
    thread_id: str
    role: str
    content: str
    token_meta: TokenMeta | None = None
    debug_meta: DebugMeta | None = None
    created_at: datetime


class ThreadListResponse(BaseModel):
    threads: list[ConversationThread]
    total: int


# ── Helper: build context prompt from history ─────────────────────────────────

def _build_context_prompt(
    messages: list,
    artifact_type: str | None,
    artifact_id: str | None,
    new_user_message: str,
) -> str:
    lines: list[str] = []
    if artifact_type and artifact_id:
        lines.append(
            f"[Context: {artifact_type} artifact_id={artifact_id}]\n"
        )
    for msg in messages[-MAX_CONTEXT_MESSAGES:]:
        prefix = "User" if msg.role == "user" else "Assistant"
        lines.append(f"{prefix}: {msg.content}")
    lines.append(f"User: {new_user_message}")
    lines.append("Assistant:")
    return "\n".join(lines)


def _build_debug_meta(
    *,
    provider: str,
    model: str,
    runtime_mode: str,
    adapter_mode: str,
    prompt_template: str,
    context_message_count: int,
    artifact_type: str | None,
    fallback_used: bool,
) -> DebugMeta:
    return DebugMeta(
        model_provider=provider,
        model_name=model,
        runtime_mode=runtime_mode,
        adapter_mode=adapter_mode,
        prompt_template=prompt_template,
        context_source=f"thread:{context_message_count}_messages"
        + (f",artifact:{artifact_type}" if artifact_type else ""),
        fallback_used=fallback_used,
        redacted=False,
    )


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("", response_model=ConversationThread, status_code=status.HTTP_201_CREATED)
async def create_thread(
    body: CreateThreadRequest,
    store: ConversationStore = Depends(get_conversation_store),
    _ctx: AuthContext = Depends(require_analyst),
) -> ConversationThread:
    """Create a new conversation thread scoped to an artifact."""
    return await store.create_thread(
        thread_type=body.thread_type,
        artifact_type=body.artifact_type,
        artifact_id=body.artifact_id,
        title=body.title,
        created_by=body.created_by,
    )


@router.get("", response_model=ThreadListResponse)
async def list_threads(
    artifact_type: str | None = Query(default=None),
    artifact_id: str | None = Query(default=None),
    limit: int = Query(default=50, le=200),
    store: ConversationStore = Depends(get_conversation_store),
    _ctx: AuthContext = Depends(require_analyst),
) -> ThreadListResponse:
    """List conversation threads, optionally filtered by artifact."""
    threads = await store.list_threads(
        artifact_type=artifact_type,
        artifact_id=artifact_id,
        limit=limit,
    )
    return ThreadListResponse(threads=threads, total=len(threads))


@router.get("/{thread_id}", response_model=ConversationThread_WithMessages)
async def get_thread(
    thread_id: str,
    store: ConversationStore = Depends(get_conversation_store),
    _ctx: AuthContext = Depends(require_analyst),
) -> ConversationThread_WithMessages:
    """Retrieve a thread with all messages and aggregate token totals."""
    thread = await store.get_thread_with_messages(thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail=f"Thread {thread_id} not found")
    return thread


@router.post("/{thread_id}/messages", response_model=MessageResponse)
async def add_message(
    thread_id: str,
    body: AddMessageRequest,
    store: ConversationStore = Depends(get_conversation_store),
    _ctx: AuthContext = Depends(require_analyst),
) -> MessageResponse:
    """Add a user message and get an AI-generated assistant response.

    When role=user the API automatically generates an assistant reply
    using the configured model adapter and thread history as context.
    When role=assistant the message is stored as-is (relay mode).
    """
    cfg = get_settings()
    provider = cfg.model_provider.strip().lower()
    model_name = cfg.model_name
    runtime_mode = "cloud" if provider == "anthropic" else "local"
    adapter_mode = cfg.splunk_adapter_mode

    thread = await store.get_thread(thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail=f"Thread {thread_id} not found")

    # ── Persist the user message ──────────────────────────────────────────────
    user_msg = await store.add_message(
        thread_id=thread_id,
        role=body.role,
        content=body.content,
    )

    # Only generate assistant response when role is "user"
    if body.role != "user":
        return MessageResponse(
            message_id=user_msg.message_id,
            thread_id=thread_id,
            role=body.role,
            content=body.content,
            created_at=user_msg.created_at,
        )

    # ── Fetch history for context ─────────────────────────────────────────────
    history = await store.list_messages(thread_id, limit=MAX_CONTEXT_MESSAGES + 1)
    # Exclude the just-added user message from context (it's already at the end)
    context_messages = [m for m in history if m.message_id != user_msg.message_id]

    prompt = _build_context_prompt(
        context_messages,
        thread.artifact_type,
        thread.artifact_id,
        body.content,
    )

    # ── Call model ────────────────────────────────────────────────────────────
    adapter = resolve_model_adapter()
    t0 = time.perf_counter()
    fallback_used = False
    try:
        assistant_text = adapter.generate(prompt)
    except Exception:  # noqa: BLE001
        assistant_text = (
            "I was unable to generate a response at this time. "
            "Please check the model configuration and try again."
        )
        fallback_used = True

    latency_ms = int((time.perf_counter() - t0) * 1000)

    # ── Estimate tokens (character-based heuristic for local models) ──────────
    input_est = max(1, len(prompt) // 4)
    output_est = max(1, len(assistant_text) // 4)
    cost_svc = get_token_cost_service()
    cost_result = cost_svc.estimate_cost(
        provider=provider,
        model=model_name,
        input_tokens=input_est,
        output_tokens=output_est,
    )
    cost_result.latency_ms = latency_ms

    token_meta = TokenMeta(
        input_tokens=cost_result.input_tokens,
        output_tokens=cost_result.output_tokens,
        total_tokens=cost_result.total_tokens,
        estimated_cost_usd=cost_result.estimated_cost_usd,
        cost_source=cost_result.cost_source,
        latency_ms=latency_ms,
        provider=provider,
        model=model_name,
    )

    # ── Build debug_meta if requested ─────────────────────────────────────────
    debug_meta: DebugMeta | None = None
    if body.debug:
        debug_meta = _build_debug_meta(
            provider=provider,
            model=model_name,
            runtime_mode=runtime_mode,
            adapter_mode=adapter_mode,
            prompt_template="conversation:context_window",
            context_message_count=len(context_messages),
            artifact_type=thread.artifact_type,
            fallback_used=fallback_used,
        )
        debug_meta.input_token_estimate = input_est
        debug_meta.output_token_estimate = output_est
        debug_meta.latency_ms = latency_ms

    # ── Persist assistant message ─────────────────────────────────────────────
    asst_msg = await store.add_message(
        thread_id=thread_id,
        role="assistant",
        content=assistant_text,
        token_meta=token_meta,
        debug_meta=debug_meta,
    )

    return MessageResponse(
        message_id=asst_msg.message_id,
        thread_id=thread_id,
        role="assistant",
        content=assistant_text,
        token_meta=token_meta,
        debug_meta=debug_meta,
        created_at=asst_msg.created_at,
    )
