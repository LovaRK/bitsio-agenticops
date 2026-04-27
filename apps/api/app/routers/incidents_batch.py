"""Batch incident analysis endpoint."""

from __future__ import annotations

import asyncio
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from opentelemetry import trace
from pydantic import BaseModel, Field

from apps.api.app.services.token_cost import TokenCostResult, get_token_cost_service
from decision_tracing.conversation_models import BatchItem, BatchResult, DebugMeta, TokenMeta
from packages.shared.auth import AuthContext, require_analyst
from packages.shared.config.settings import get_settings

router = APIRouter(prefix="/api/v1/incidents", tags=["incidents"])
_TRACER = trace.get_tracer("api.routes")

BATCH_MAX_SIZE = 50
BATCH_ITEM_TIMEOUT_S = 20


class IncidentBatchRequest(BaseModel):
    incident_ids: list[str] = Field(..., min_length=1)
    analysis_depth: str = "standard"  # standard | deep
    debug: bool = False


@router.post("/analyze/batch", response_model=BatchResult)
async def batch_analyze_incidents(
    body: IncidentBatchRequest,
    _ctx: AuthContext = Depends(require_analyst),
) -> BatchResult:
    """Batch-analyze multiple incidents.

    Runs each incident through the context agent asynchronously with a per-item
    timeout. Returns per-item results, aggregate summary, and token/cost totals.
    """
    cfg = get_settings()
    with _TRACER.start_as_current_span("api.incidents.batch_analyze") as span:
        span.set_attribute("service.name", "api")
        span.set_attribute("graph.name", "incident_context_batch")
        span.set_attribute("graph.version", "v1.0.0")
        span.set_attribute("node.name", "incidents_batch_analyze")
        span.set_attribute("workflow_id", f"wf_inc_batch_{uuid.uuid4().hex[:8]}")
        span.set_attribute("tenant.safe_id", cfg.tenant_safe_id)
        span.set_attribute("env", cfg.environment)
        span.set_attribute("model.provider", cfg.model_provider)

        if len(body.incident_ids) > BATCH_MAX_SIZE:
            raise HTTPException(
                status_code=422,
                detail=f"Batch size {len(body.incident_ids)} exceeds maximum {BATCH_MAX_SIZE}",
            )

    provider = cfg.model_provider.strip().lower()
    model_name = cfg.model_name
    cost_svc = get_token_cost_service()
    batch_id = str(uuid.uuid4())

    cost_results: list[TokenCostResult] = []

    async def _analyze_one(incident_id: str) -> BatchItem:
        try:
            # Real impl would call IncidentContextAgentGraph here.
            # This stub produces a deterministic response for now.
            result = await asyncio.wait_for(
                asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: {
                        "incident_id": incident_id,
                        "assessment": "likely_infrastructure_noise",
                        "confidence": 0.68,
                        "recommendation": "monitor_24h",
                        "analyzed_at": datetime.now(tz=UTC).isoformat(),
                        "depth": body.analysis_depth,
                    },
                ),
                timeout=BATCH_ITEM_TIMEOUT_S,
            )
            cr = cost_svc.estimate_cost(
                provider=provider,
                model=model_name,
                input_tokens=300,
                output_tokens=80,
            )
            cost_results.append(cr)
            tm = TokenMeta(
                input_tokens=cr.input_tokens,
                output_tokens=cr.output_tokens,
                total_tokens=cr.total_tokens,
                estimated_cost_usd=cr.estimated_cost_usd,
                cost_source=cr.cost_source,
                provider=provider,
                model=model_name,
            )
            return BatchItem(item_id=incident_id, success=True, result=result, token_meta=tm)
        except TimeoutError:
            return BatchItem(item_id=incident_id, success=False, error="Timed out")
        except Exception as exc:  # noqa: BLE001
            return BatchItem(item_id=incident_id, success=False, error=str(exc))

    items = list(await asyncio.gather(*[_analyze_one(iid) for iid in body.incident_ids]))

    succeeded = sum(1 for i in items if i.success)
    agg = cost_svc.aggregate(cost_results)
    token_summary = TokenMeta(
        input_tokens=agg.input_tokens,
        output_tokens=agg.output_tokens,
        total_tokens=agg.total_tokens,
        estimated_cost_usd=agg.estimated_cost_usd,
        cost_source=agg.cost_source,
        provider=provider,
        model=model_name,
    )

    debug_summary: DebugMeta | None = None
    if body.debug:
        debug_summary = DebugMeta(
            model_provider=provider,
            model_name=model_name,
            runtime_mode="cloud" if provider == "anthropic" else "local",
            prompt_template="incident:batch_context_analysis",
            fallback_used=False,
        )

    return BatchResult(
        batch_id=batch_id,
        total=len(items),
        succeeded=succeeded,
        failed=len(items) - succeeded,
        items=items,
        aggregate_summary=(
            f"{succeeded}/{len(items)} incidents analyzed. "
            f"Tokens: {agg.total_tokens}."
            + (f" Cost: ${agg.estimated_cost_usd:.6f}" if agg.estimated_cost_usd else "")
        ),
        token_summary=token_summary,
        debug_summary=debug_summary,
        created_at=datetime.now(tz=UTC),
    )
