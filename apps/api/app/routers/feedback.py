"""AI Feedback endpoints — thumbs up/down + optional category and comment."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, Query, status
from opentelemetry import trace
from pydantic import BaseModel, Field

from apps.api.app.dependencies import get_feedback_store
from apps.api.app.services.feedback_service import FeedbackStore
from decision_tracing.conversation_models import AIFeedback
from packages.shared.auth import AuthContext, require_analyst
from packages.shared.config.settings import get_settings

router = APIRouter(prefix="/api/v1/feedback", tags=["feedback"])
_TRACER = trace.get_tracer("api.routes")


# ── Request/Response schemas ──────────────────────────────────────────────────

class SubmitFeedbackRequest(BaseModel):
    target_type: Literal[
        "message", "incident_analysis", "fraud_analysis", "telemetry_response", "batch_result"
    ]
    target_id: str = Field(..., min_length=1)
    rating: Literal["thumbs_up", "thumbs_down"]
    thread_id: str | None = None
    user_id: str = "anonymous"
    category: (
        Literal["wrong_reasoning", "missing_context", "poor_formatting", "low_trust", "other"] | None
    ) = None
    comment: str | None = Field(default=None, max_length=2000)
    # Model context — populated automatically by the client from response metadata
    model_provider: str | None = None
    model_name: str | None = None
    artifact_type: str | None = None
    artifact_id: str | None = None


class FeedbackResponse(BaseModel):
    feedback_id: str
    target_type: str
    target_id: str
    rating: str
    created_at: datetime
    message: str = "Feedback recorded. Thank you."


class FeedbackListResponse(BaseModel):
    items: list[AIFeedback]
    total: int


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("", response_model=FeedbackResponse, status_code=status.HTTP_201_CREATED)
async def submit_feedback(
    body: SubmitFeedbackRequest,
    store: FeedbackStore = Depends(get_feedback_store),
    _ctx: AuthContext = Depends(require_analyst),
) -> FeedbackResponse:
    """Submit a thumbs-up/down rating on an AI-generated output."""
    settings = get_settings()
    with _TRACER.start_as_current_span("api.feedback.submit") as span:
        span.set_attribute("service.name", "api")
        span.set_attribute("graph.name", "feedback")
        span.set_attribute("graph.version", "v1.0.0")
        span.set_attribute("node.name", "submit_feedback")
        span.set_attribute("workflow_id", f"wf_feedback_{body.target_id}")
        span.set_attribute("tenant.safe_id", settings.tenant_safe_id)
        span.set_attribute("env", settings.environment)
        span.set_attribute("model.provider", body.model_provider or "unknown")
        fb = await store.save_feedback(
            target_type=body.target_type,
            target_id=body.target_id,
            rating=body.rating,
            thread_id=body.thread_id,
            user_id=body.user_id,
            category=body.category,
            comment=body.comment,
            model_provider=body.model_provider,
            model_name=body.model_name,
            artifact_type=body.artifact_type,
            artifact_id=body.artifact_id,
        )
        return FeedbackResponse(
            feedback_id=fb.feedback_id,
            target_type=fb.target_type,
            target_id=fb.target_id,
            rating=fb.rating,
            created_at=fb.created_at,
        )


@router.get("", response_model=FeedbackListResponse)
async def list_feedback(
    target_type: str | None = Query(default=None),
    target_id: str | None = Query(default=None),
    limit: int = Query(default=100, le=500),
    store: FeedbackStore = Depends(get_feedback_store),
    _ctx: AuthContext = Depends(require_analyst),
) -> FeedbackListResponse:
    """List feedback items, optionally filtered by target."""
    settings = get_settings()
    with _TRACER.start_as_current_span("api.feedback.list") as span:
        span.set_attribute("service.name", "api")
        span.set_attribute("graph.name", "feedback")
        span.set_attribute("graph.version", "v1.0.0")
        span.set_attribute("node.name", "list_feedback")
        span.set_attribute("workflow_id", "wf_feedback_list")
        span.set_attribute("tenant.safe_id", settings.tenant_safe_id)
        span.set_attribute("env", settings.environment)
        span.set_attribute("model.provider", "n/a")
        items = await store.list_feedback(
            target_type=target_type,
            target_id=target_id,
            limit=limit,
        )
        return FeedbackListResponse(items=items, total=len(items))
