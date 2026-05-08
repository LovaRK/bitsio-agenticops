"""Incident context enrichment API endpoints."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from agent_core.graphs.incident_context_agent import IncidentContextAgentGraph
from agent_core.models.adapter import resolve_model_adapter
from agent_core.state.context_state import IncidentContextAgentState
from apps.api.app.config import load_incidents
from apps.api.app.dependencies import (
    get_incident_context_graph,
    get_splunk_incident_service,
    get_trace_store,
)
from apps.api.app.schemas.context_response import EnrichedIncidentResponse
from apps.api.app.services.splunk_live import SplunkIncidentService
from decision_tracing.hashing import hash_content
from decision_tracing.models import DecisionTrace, NodeRun
from packages.shared.auth import AuthContext, require_analyst

router = APIRouter(prefix="/api/v1", tags=["incident-context"])

_ENRICH_CACHE_TTL = 300  # seconds
# Process-local fallback cache used when Redis is unavailable.
_LOCAL_CACHE: dict[str, dict[str, Any]] = {}


class EnrichRequest(BaseModel):
    force_refresh: bool = False


def _incident_from_live_or_seed(
    incident_id: str,
    splunk_service: SplunkIncidentService,
) -> dict[str, Any] | None:
    incidents = load_incidents(splunk_service)
    for incident in incidents:
        if str(incident.get("id")) == incident_id:
            return {
                "incident_id": incident_id,
                "title": incident.get("title", f"Incident {incident_id}"),
                "severity": incident.get("severity", "medium"),
                "timestamp": incident.get("timestamp", datetime.now(tz=UTC).isoformat()),
                "customer_id": incident.get("customer_id", "cust_001"),
                "service_name": incident.get("service_name", "payments-api"),
                "asset_id": incident.get("asset_id", "asset-payments-api-1"),
                "description": incident.get("title", "Operational incident"),
                "metrics": {
                    "latency_p95": float(incident.get("latency_p95", 355.0)),
                    "error_rate": float(incident.get("error_rate", 0.061)),
                },
            }
    return None


async def _cache_get(request: Request, key: str) -> dict[str, Any] | None:
    redis = getattr(request.app.state, "redis", None)
    if redis is not None:
        try:
            raw = await redis.get(f"enrich:{key}")
            if raw:
                return json.loads(raw)
        except Exception:  # noqa: BLE001
            pass
    return _LOCAL_CACHE.get(key)


async def _cache_set(request: Request, key: str, value: dict[str, Any]) -> None:
    redis = getattr(request.app.state, "redis", None)
    if redis is not None:
        try:
            await redis.set(f"enrich:{key}", json.dumps(value), ex=_ENRICH_CACHE_TTL)
            return
        except Exception:  # noqa: BLE001
            pass
    _LOCAL_CACHE[key] = value


@router.post("/incidents/{incident_id}/enrich", response_model=EnrichedIncidentResponse)
async def enrich_incident(
    incident_id: str,
    payload: EnrichRequest,
    request: Request,
    _ctx: AuthContext = Depends(require_analyst),
    graph: IncidentContextAgentGraph = Depends(get_incident_context_graph),
    store: object = Depends(get_trace_store),
    splunk_service: SplunkIncidentService = Depends(get_splunk_incident_service),
) -> EnrichedIncidentResponse:
    if not payload.force_refresh:
        cached = await _cache_get(request, incident_id)
        if cached:
            return EnrichedIncidentResponse(**cached, cached=True)

    raw_incident = _incident_from_live_or_seed(incident_id, splunk_service)
    if raw_incident is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="incident not found")

    state = IncidentContextAgentState.from_raw_incident(
        workflow_id=f"wf_{datetime.now(tz=UTC).strftime('%Y%m%d')}_{incident_id}",
        incident_dict={**raw_incident, "tenant_safe_id": "tenant_demo"},
    )

    result = graph.run(state)

    if result.errors and any(not err.startswith("warn:") for err in result.errors):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"errors": result.errors},
        )

    now = datetime.now(tz=UTC)
    node_runs = [
        NodeRun(
            node_name="incident_context_agent",
            started_at=now,
            status="success",
            input_hash=hash_content(raw_incident),
            output_hash=hash_content(result.enriched_incident or {}),
            tool_calls=[],
            policy_checks=[],
        )
    ]
    adapter = resolve_model_adapter()
    model_mode = "cloud" if splunk_service.model_provider != "ollama" else "local"
    trace = DecisionTrace(
        workflow_id=result.workflow_id,
        incident_id=result.incident_id,
        graph_name="incident_context_agent",
        graph_version="v1.0.0",
        started_at=now,
        completed_at=now,
        model_provider=splunk_service.model_provider,
        model_name=splunk_service.model_name,
        model_mode=model_mode,
        user_opt_in=False,
        node_runs=node_runs,
        final_assessment=(
            result.deviation_description
            or "Incident context enrichment completed with metadata, correlation, and anomaly scoring."
        ),
        confidence=result.confidence,
        approval_required=False,
    )
    await store.aupsert(trace, force_merge=True)  # type: ignore[union-attr]

    response_data = {
        "workflow_id": result.workflow_id,
        "incident_id": result.incident_id,
        "confidence": result.confidence,
        "errors": result.errors,
        "enriched_incident": result.enriched_incident or {},
    }
    await _cache_set(request, incident_id, response_data)
    return EnrichedIncidentResponse(**response_data)
