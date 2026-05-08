"""Batch fraud analysis — appended to fraud router via include_router."""

from __future__ import annotations

import asyncio
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from opentelemetry import trace
from pydantic import BaseModel, Field

from apps.api.app.services.token_cost import TokenCostResult, get_token_cost_service
from decision_tracing.conversation_models import BatchItem, BatchResult, DebugMeta, TokenMeta
from packages.shared.auth import AuthContext, require_analyst
from packages.shared.config.settings import get_settings

router = APIRouter(prefix="/api/v1/fraud", tags=["fraud-risk"])
_TRACER = trace.get_tracer("api.routes")

BATCH_MAX_SIZE = 50
BATCH_ITEM_TIMEOUT_S = 15


class BatchAnalyzeRequest(BaseModel):
    case_ids: list[str] = Field(..., min_length=1)
    debug: bool = False


def _analyze_case_id(case_id: str, settings: Any) -> dict[str, Any]:
    """Stub analysis per case_id — in real impl this calls the agent graph."""
    return {
        "case_id": case_id,
        "risk_assessment": "moderate",
        "recommended_action": "monitor",
        "confidence": 0.72,
        "analyzed_at": datetime.now(tz=UTC).isoformat(),
    }


@router.post("/analyze/batch", response_model=BatchResult, status_code=status.HTTP_200_OK)
async def batch_analyze_fraud(
    body: BatchAnalyzeRequest,
    _ctx: AuthContext = Depends(require_analyst),
) -> BatchResult:
    """Batch-analyze multiple fraud case IDs.

    Returns per-item results, aggregate summary, and token/cost totals.
    Max batch size: 50 items.
    """
    cfg = get_settings()
    with _TRACER.start_as_current_span("api.fraud.batch_analyze") as span:
        span.set_attribute("service.name", "api")
        span.set_attribute("graph.name", "fraud_risk_batch")
        span.set_attribute("graph.version", "v1.0.0")
        span.set_attribute("node.name", "fraud_batch_analyze")
        span.set_attribute("workflow_id", f"wf_fraud_batch_{uuid.uuid4().hex[:8]}")
        span.set_attribute("tenant.safe_id", cfg.tenant_safe_id)
        span.set_attribute("env", cfg.environment)
        span.set_attribute("model.provider", cfg.model_provider)

        if len(body.case_ids) > BATCH_MAX_SIZE:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Batch size {len(body.case_ids)} exceeds maximum {BATCH_MAX_SIZE}",
            )

    provider = cfg.model_provider.strip().lower()
    model_name = cfg.model_name
    cost_svc = get_token_cost_service()
    batch_id = str(uuid.uuid4())

    items: list[BatchItem] = []
    cost_results: list[TokenCostResult] = []

    async def _run_one(case_id: str) -> BatchItem:
        try:
            result = await asyncio.wait_for(
                asyncio.get_event_loop().run_in_executor(
                    None, _analyze_case_id, case_id, cfg
                ),
                timeout=BATCH_ITEM_TIMEOUT_S,
            )
            # Estimate tokens per item
            content_len = len(str(result))
            cr = cost_svc.estimate_cost(
                provider=provider,
                model=model_name,
                input_tokens=max(1, 200),  # context window estimate
                output_tokens=max(1, content_len // 4),
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
            return BatchItem(item_id=case_id, success=True, result=result, token_meta=tm)
        except TimeoutError:
            return BatchItem(item_id=case_id, success=False, error="Analysis timed out")
        except Exception as exc:  # noqa: BLE001
            return BatchItem(item_id=case_id, success=False, error=str(exc))

    tasks = [_run_one(cid) for cid in body.case_ids]
    items = list(await asyncio.gather(*tasks))

    succeeded = sum(1 for i in items if i.success)
    failed = len(items) - succeeded

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
            prompt_template="fraud:batch_analysis",
            fallback_used=False,
            tools_selected=["fraud_case_analyzer"],
        )

    aggregate_summary = (
        f"Batch {batch_id[:8]}: {succeeded}/{len(items)} cases analyzed. "
        f"Total tokens: {agg.total_tokens}. "
        + (f"Est. cost: ${agg.estimated_cost_usd:.6f}" if agg.estimated_cost_usd is not None else "")
    )

    return BatchResult(
        batch_id=batch_id,
        total=len(items),
        succeeded=succeeded,
        failed=failed,
        items=items,
        aggregate_summary=aggregate_summary,
        token_summary=token_summary,
        debug_summary=debug_summary,
        created_at=datetime.now(tz=UTC),
    )
