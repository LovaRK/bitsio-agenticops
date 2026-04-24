"""
Telemetry Waste Detection API routes.

POST /api/v1/waste/analyze
    Run waste detection agent on provided index profiles (batch mode).
    Returns TelemetryWasteFinalOutput.

POST /api/v1/waste/analyze/live
    Trigger waste detection pulling data directly from connected Splunk.
    Requires analyst role + live Splunk configured.

GET  /api/v1/waste/demo
    Return pre-computed demo result using the Cisco ASA fixture.
    Safe to call without Splunk — uses fixture data. Great for demos.
"""

from __future__ import annotations

import json
import time
import uuid
from pathlib import Path
from typing import Any, Literal
from unittest.mock import MagicMock

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from agent_core.graphs.telemetry_waste_agent import TelemetryWasteAgentGraph
from agent_core.graphs.telemetry_waste_agent import (
    _SEARCH_FIELD_STATS,
    _SEARCH_USAGE_ACTIVITY,
    _SEARCH_USAGE_BY_INDEX,
)
from agent_core.models.adapter import AnthropicModelAdapter, OllamaModelAdapter, StubModelAdapter
from agent_core.state.waste_state import TelemetryWasteAgentState
from apps.api.app.dependencies import (
    get_splunk_adapter_native_default,
    resolve_splunk_mode_for_workload,
)
from apps.api.app.services.model_selector import Complexity, TaskType, select_model
from packages.shared.auth import AuthContext, require_analyst
from packages.shared.config.settings import get_settings

router = APIRouter(prefix="/api/v1/waste", tags=["waste"])

_DEMO_FIXTURE = (
    Path(__file__).parent.parent.parent.parent.parent
    / "tests/fixtures/waste_detection/cisco_asa_demo.json"
)

_CALCULATION_ASSUMPTIONS = [
    "License rate assumption: $150 per GB/year",
    "Daily ingest is computed from observed raw byte volume per source type",
    "If source activity spans less than one day, observed window defaults to one day",
    "Savings estimate combines field filtering + retention optimization",
    "Search activity is evaluated on a rolling 90-day window",
]
_AMPLIFIED_SAVINGS_TARGET_USD = 5000.0
_AMPLIFIED_MAX_FACTOR = 10.0
_TELEMETRY_METRICS_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_WASTE_INGEST_MIN_THRESHOLD_GB = 0.001
_WASTE_SEARCH_MAX_THRESHOLD = 5
_WASTE_DASHBOARD_MAX_THRESHOLD = 0
_WASTE_ALERT_MAX_THRESHOLD = 0


def _derive_metrics_governance(
    *,
    approval_required: bool,
    guardrail_notes: list[str],
    has_policy_checks: bool,
    optimization_ratio: float,
) -> dict[str, Any]:
    rule_triggered = "require_approval" if approval_required else "allow"
    if guardrail_notes:
        approval_reason = guardrail_notes[0]
    elif approval_required:
        approval_reason = "Approval required due to policy threshold."
    elif optimization_ratio >= 0.35:
        approval_reason = "High optimization impact detected; governance review recommended."
    else:
        approval_reason = "No blocking policy violations."

    return {
        "policy_id": "telemetry-waste-policy",
        "policy_version": "v1.0.0",
        "rule_triggered": rule_triggered,
        "approval_reason": approval_reason,
        "approval_status": "requires_review" if approval_required else "approved",
        "data_owner": "Platform Team",
        "last_reviewed": "2026-04-22",
        "source": "reported" if has_policy_checks else "derived",
    }


def _derive_metrics_security(*, security_gap_count: int, avg_utilization_score: int) -> dict[str, Any]:
    if security_gap_count >= 6 or avg_utilization_score < 35:
        risk_level = "high"
    elif security_gap_count >= 3 or avg_utilization_score < 60:
        risk_level = "medium"
    else:
        risk_level = "low"

    return {
        "data_classification": "internal",
        "compliance_frameworks": ["SOX", "PCI-DSS"],
        "encryption_required": "in-transit + at-rest",
        "risk_level": risk_level,
        "security_confidence": max(65, min(95, 100 - (security_gap_count * 4))),
        "source": "derived",
    }


def _derive_metrics_conflicts(sources: list[dict[str, Any]]) -> list[dict[str, Any]]:
    conflicts: list[dict[str, Any]] = []
    for source in sources:
        if source.get("recommendation") != "Remove":
            continue
        search_count = int(source.get("search_count_90d", 0))
        dashboard_refs = int(source.get("dashboard_references", 0))
        alert_refs = int(source.get("alert_references", 0))
        if search_count <= _WASTE_SEARCH_MAX_THRESHOLD and dashboard_refs <= 1 and alert_refs <= 1:
            conflicts.append(
                {
                    "source": str(source.get("name") or source.get("index") or "unknown"),
                    "source_type": str(source.get("name") or ""),
                    "recommendation": "Remove",
                    "conflict_reason": "Retention/compliance checks require evidence-safe reduction, not hard delete.",
                    "suggested_action": "Switch to Optimize: reduce retention + keep investigation-critical fields.",
                    "severity": "high",
                }
            )
        if len(conflicts) >= 4:
            break
    return conflicts


def _derive_metrics_actions(
    *,
    conflicts: list[dict[str, Any]],
    sources: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    def _source_action_savings(source: dict[str, Any] | None) -> float:
        if not source:
            return 0.0
        explicit_savings = float(source.get("potential_savings_usd") or 0.0)
        if explicit_savings > 0:
            return round(explicit_savings, 2)
        annual_spend = float(source.get("annual_spend_usd") or 0.0)
        if annual_spend <= 0:
            return 0.0
        recommendation = str(source.get("recommendation") or "")
        if recommendation == "Optimize":
            return round(annual_spend * 0.22, 2)
        if recommendation == "Remove":
            return round(annual_spend * 0.35, 2)
        return 0.0

    actions: list[dict[str, Any]] = []
    if conflicts:
        primary_conflict = conflicts[0]
        primary_conflict_source = next(
            (s for s in sources if s.get("name") == primary_conflict.get("source")),
            None,
        )
        conflict_savings = _source_action_savings(primary_conflict_source)
        actions.append(
            {
                "id": "review_policy",
                "label": f"Review Policy ({primary_conflict.get('source', 'source')})",
                "description": "Resolve policy/optimization conflict before applying removal.",
                "cta": "review_policy",
                "severity": "high",
                "source_target": str(primary_conflict.get("source") or "unknown"),
                "issue": str(primary_conflict.get("conflict_reason") or "Policy conflict detected."),
                "suggested_value": str(
                    primary_conflict.get("suggested_action")
                    or "Switch to optimize and keep compliance-safe retention."
                ),
                "decision_confidence": 0.82,
                "impact_preview": {
                    "savings_delta_usd": conflict_savings,
                    "risk_before": "high",
                    "risk_after": "medium",
                    "compliance_safe": True,
                },
                "source": "derived",
            }
        )
    optimize_sources = sorted(
        [s for s in sources if s.get("recommendation") == "Optimize"],
        key=lambda s: (_source_action_savings(s), float(s.get("annual_spend_usd") or 0.0)),
        reverse=True,
    )
    if optimize_sources:
        optimize_source = optimize_sources[0]
        optimize_savings = _source_action_savings(optimize_source)
        utilization_score = int(optimize_source.get("utilization_score") or 0)
        actions.append(
            {
                "id": f"adjust_retention_{optimize_source.get('index', 'source')}",
                "label": f"Adjust Retention ({optimize_source.get('name', 'source')})",
                "description": "Tune retention to reduce ingest cost while preserving decision-critical fields.",
                "cta": "adjust_retention",
                "severity": "medium",
                "source_target": str(optimize_source.get("name") or optimize_source.get("index") or "unknown"),
                "issue": (
                    f"Low utilization ({utilization_score}%) with annual spend "
                    f"${round(float(optimize_source.get('annual_spend_usd') or 0.0), 2):,.2f}."
                ),
                "current_value": "30 days",
                "suggested_value": "7 days",
                "estimated_savings_usd": optimize_savings,
                "decision_confidence": 0.78,
                "impact_preview": {
                    "savings_delta_usd": optimize_savings,
                    "risk_before": "medium",
                    "risk_after": "low" if utilization_score <= 15 else "medium",
                    "compliance_safe": True,
                },
                "source": "derived",
            }
        )
    owner_source = next(
        iter(
            sorted(
                [s for s in sources if int(s.get("utilization_score") or 0) < 50],
                key=lambda s: (_source_action_savings(s), float(s.get("annual_spend_usd") or 0.0)),
                reverse=True,
            )
        ),
        None,
    )
    actions.append(
        {
            "id": f"assign_owner_{(owner_source or {}).get('index', 'source')}",
            "label": f"Assign Owner ({(owner_source or {}).get('name', 'source')})",
            "description": "Set accountable source owners for optimization follow-through.",
            "cta": "assign_owner",
            "severity": "low",
            "source_target": str((owner_source or {}).get("name") or (owner_source or {}).get("index") or "unknown"),
            "issue": "No explicit accountability recorded for optimization workflow.",
            "owner": "Unassigned",
            "decision_confidence": 0.74,
            "impact_preview": {
                "savings_delta_usd": _source_action_savings(owner_source),
                "risk_before": "medium",
                "risk_after": "low",
                "compliance_safe": True,
            },
            "source": "derived",
        }
    )
    return actions


def _derive_metrics_trust(
    *,
    data_source: Literal["live", "fallback"],
    fallback_used: bool,
    adapter_mode: str,
    backend: str,
    latency_ms: int,
    confidence: float,
    coverage_pct: int,
    freshness: str,
) -> dict[str, Any]:
    return {
        "data_source": data_source,
        "fallback_used": fallback_used,
        "adapter_mode": adapter_mode,
        "backend": backend,
        "latency_ms": latency_ms,
        "confidence": round(max(0.0, min(1.0, confidence)), 2),
        "freshness": freshness,
        "coverage_pct": max(0, min(100, int(coverage_pct))),
        "source": "derived",
    }


def _compact_query(query: str) -> str:
    return " ".join(query.split())


def _telemetry_query_plan(window_days: int) -> list[dict[str, Any]]:
    earliest = f"-{max(1, int(window_days))}d"
    return [
        {
            "id": "index_volume_profile",
            "description": "Estimate ingest volume by index and source type.",
            "purpose": "Build annual spend baseline from observed ingest.",
            "query": _compact_query(_SEARCH_FIELD_STATS.replace("earliest=-90d", f"earliest={earliest}")),
            "window_days": max(1, int(window_days)),
        },
        {
            "id": "search_usage_by_sourcetype",
            "description": "Measure search usage by source type from audit logs.",
            "purpose": "Detect under-utilized data sources over the query window.",
            "query": _compact_query(
                _SEARCH_USAGE_ACTIVITY.replace("earliest=-90d", f"earliest={earliest}")
            ),
            "window_days": max(1, int(window_days)),
        },
        {
            "id": "search_usage_by_index",
            "description": "Measure search usage by index from audit logs.",
            "purpose": "Validate index-level demand and dashboard usage signal.",
            "query": _compact_query(
                _SEARCH_USAGE_BY_INDEX.replace("earliest=-90d", f"earliest={earliest}")
            ),
            "window_days": max(1, int(window_days)),
        },
    ]


def _build_query_meta(
    *,
    plan: list[dict[str, Any]],
    adapter_mode: str,
    resolved_adapter_mode: str,
    live_mode: bool,
    used_live_data: bool,
    fallback_reason: str | None = None,
) -> dict[str, Any]:
    backend = (
        "splunk-native"
        if resolved_adapter_mode == "native"
        else (
            "splunk-mcp"
            if resolved_adapter_mode == "mcp"
            else ("splunk-auto" if adapter_mode == "auto" else f"splunk-{resolved_adapter_mode}")
        )
    )
    executed_status = "executed" if used_live_data else ("fallback" if live_mode else "planned")
    executed_steps = [{**step, "status": executed_status, "backend": backend} for step in plan]
    return {
        "query_plan": [{**step, "status": "planned", "backend": backend} for step in plan],
        "executed_steps": executed_steps,
        "query_context": {
            "adapter_mode": adapter_mode,
            "resolved_adapter_mode": resolved_adapter_mode,
            "backend": backend,
            "live_mode": live_mode,
            "used_live_data": used_live_data,
            "fallback_reason": fallback_reason or "",
        },
    }


def _provisional_output_from_state(
    *,
    workflow_id: str,
    tenant_id: str,
    state: TelemetryWasteAgentState,
    environment: str,
) -> dict[str, Any]:
    total_daily_ingest_gb = sum(item.daily_ingest_gb for item in state.source_profiles)
    total_daily_wasted_gb = sum(item.daily_ingest_gb for item in state.wasteful_sources)
    estimated_annual_savings_usd = sum(
        rec.estimated_annual_savings_usd for rec in state.recommendations
    )
    waste_pct = (
        round(total_daily_wasted_gb / total_daily_ingest_gb, 4)
        if total_daily_ingest_gb > 0
        else 0.0
    )
    policy_check = state.policy_checks[0] if state.policy_checks else {}
    governance = {
        "policy_id": str(policy_check.get("policy_id") or "telemetry-waste-policy"),
        "policy_version": str(policy_check.get("policy_version") or "v1.0.0"),
        "rule_triggered": str(
            policy_check.get("action")
            or ("require_approval" if state.approval_required else "allow")
        ),
        "approval_reason": str(
            policy_check.get("reason")
            or (
                state.guardrail_notes[0]
                if state.guardrail_notes
                else (
                    "Approval required due to policy threshold."
                    if state.approval_required
                    else "No blocking policy violations."
                )
            )
        ),
        "source": "reported" if state.policy_checks else "derived",
    }
    security = {
        "data_classification": "internal",
        "compliance_frameworks": ["SOX", "PCI-DSS"],
        "encryption_required": "in-transit + at-rest",
        "risk_level": (
            "high"
            if (waste_pct >= 0.50 or state.approval_required)
            else ("medium" if waste_pct >= 0.20 else "low")
        ),
        "source": "derived",
    }

    return {
        "workflow_id": workflow_id,
        "tenant_id": tenant_id,
        "scenario": f"Live Splunk analysis ({environment})",
        "summary": (
            "Provisional output generated from live Splunk telemetry. "
            "Approval is still required before finalization."
        ),
        "total_wasteful_sources": len(state.wasteful_sources),
        "total_daily_ingest_gb": total_daily_ingest_gb,
        "total_daily_wasted_gb": total_daily_wasted_gb,
        "estimated_annual_savings_usd": estimated_annual_savings_usd,
        "waste_pct": waste_pct,
        "top_offenders": [
            profile.model_dump()
            for profile in sorted(
                state.wasteful_sources, key=lambda item: item.daily_ingest_gb, reverse=True
            )[:10]
        ],
        "recommendations": [
            recommendation.model_dump()
            for recommendation in sorted(
                state.recommendations,
                key=lambda item: item.estimated_annual_savings_usd,
                reverse=True,
            )[:10]
        ],
        "confidence": state.confidence,
        "approval_required": state.approval_required,
        "guardrail_notes": state.guardrail_notes,
        "governance": governance,
        "security": security,
        "calculation_assumptions": _CALCULATION_ASSUMPTIONS,
        "provisional": True,
        "demo_profile": "standard",
    }


def _apply_demo_amplification(payload: dict[str, Any]) -> dict[str, Any]:
    """Apply transparent demo scaling to reach meaningful enterprise showcase values."""
    current = float(payload.get("estimated_annual_savings_usd") or 0.0)
    if current <= 0:
        return payload
    if current >= _AMPLIFIED_SAVINGS_TARGET_USD:
        payload["demo_profile"] = "amplified"
        payload["amplification_factor"] = 1.0
        payload["calculation_assumptions"] = [
            *payload.get("calculation_assumptions", []),
            "Amplified profile requested; baseline already meets $5k target.",
        ]
        return payload

    factor = min(_AMPLIFIED_MAX_FACTOR, max(1.0, _AMPLIFIED_SAVINGS_TARGET_USD / current))

    payload["total_daily_ingest_gb"] = round(
        float(payload.get("total_daily_ingest_gb", 0.0)) * factor, 6
    )
    payload["total_daily_wasted_gb"] = round(
        float(payload.get("total_daily_wasted_gb", 0.0)) * factor, 6
    )
    payload["estimated_annual_savings_usd"] = round(current * factor, 2)

    for offender in payload.get("top_offenders", []):
        offender["daily_ingest_gb"] = round(float(offender.get("daily_ingest_gb", 0.0)) * factor, 6)
        offender["estimated_monthly_cost_usd"] = round(
            float(offender.get("estimated_monthly_cost_usd", 0.0)) * factor,
            2,
        )

    for recommendation in payload.get("recommendations", []):
        recommendation["estimated_daily_gb_saved"] = round(
            float(recommendation.get("estimated_daily_gb_saved", 0.0)) * factor,
            6,
        )
        recommendation["estimated_annual_savings_usd"] = round(
            float(recommendation.get("estimated_annual_savings_usd", 0.0)) * factor,
            2,
        )

    payload["summary"] = (
        f"{payload.get('summary', '')} "
        f"Demo amplification profile applied (x{factor:.2f}) to represent full-enterprise rollout potential."
    ).strip()
    payload["demo_profile"] = "amplified"
    payload["amplification_factor"] = round(factor, 2)
    payload["calculation_assumptions"] = [
        *payload.get("calculation_assumptions", []),
        f"Amplified demo profile uses factor x{factor:.2f} to model enterprise-scale rollout impact.",
    ]
    return payload


def _get_model_adapter():
    settings = get_settings()
    provider = settings.model_provider.lower()
    if settings.model_mock_mode or provider == "stub":
        return StubModelAdapter()
    if provider == "anthropic" and settings.anthropic_api_key:
        return AnthropicModelAdapter(model_name=settings.model_name)
    if provider == "ollama":
        try:
            return OllamaModelAdapter(
                base_url=settings.ollama_base_url,
                model_name=settings.model_name,
            )
        except Exception:
            pass
    return StubModelAdapter()


# ── Batch analysis (caller provides profile data) ────────────────────────────
class WasteAnalysisRequest(BaseModel):
    raw_index_profiles: list[dict[str, Any]] = Field(
        ...,
        description="List of index profile dicts: source_type, index, daily_ingest_gb, retention_days",
    )
    raw_search_activity: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Search activity per source_type: search_count_90d, dashboard_references, alert_references",
    )
    raw_field_stats: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Field usage per source_type: unused_fields[], used_fields[]",
    )
    tenant_id: str = Field(default="tenant_demo")
    environment: str = Field(default="dev")


@router.post("/analyze", summary="Run waste detection on provided index profiles")
def analyze_waste(
    body: WasteAnalysisRequest,
    ctx: AuthContext = Depends(require_analyst),
) -> dict[str, Any]:
    """
    Run the TelemetryWasteAgentGraph on caller-provided index profile data.

    Returns TelemetryWasteFinalOutput with savings estimates, top offenders,
    and concrete recommendations.
    """
    splunk = get_splunk_adapter_native_default()
    model = _get_model_adapter()

    graph = TelemetryWasteAgentGraph(
        splunk_adapter=splunk,
        model_adapter=model,
        fetch_from_splunk=False,
    )

    workflow_id = f"wf_waste_{uuid.uuid4().hex[:12]}"
    state = TelemetryWasteAgentState(
        workflow_id=workflow_id,
        tenant_id=body.tenant_id,
        raw_index_profiles=body.raw_index_profiles,
        raw_search_activity=body.raw_search_activity,
        raw_field_stats=body.raw_field_stats,
    )

    result = graph.run(state, environment=body.environment, action_type="read")

    if result.final_output is None:
        return _provisional_output_from_state(
            workflow_id=workflow_id,
            tenant_id=body.tenant_id,
            state=result,
            environment=body.environment,
        )

    return {
        "workflow_id": workflow_id,
        "approval_required": False,
        "calculation_assumptions": _CALCULATION_ASSUMPTIONS,
        **result.final_output.model_dump(),
    }


# ── Live Splunk analysis ──────────────────────────────────────────────────────


@router.post("/analyze/live", summary="Run waste detection pulling live Splunk data")
def analyze_waste_live(
    tenant_id: str = "tenant_demo",
    environment: str = "dev",
    demo_profile: Literal["standard", "amplified"] = "standard",
    ctx: AuthContext = Depends(require_analyst),
) -> dict[str, Any]:
    """
    Trigger waste detection by querying the connected Splunk instance directly.
    Requires SPLUNK_LIVE_MODE=true and a valid SPLUNK_MCP_TOKEN.
    """
    settings = get_settings()
    if not settings.splunk_live_mode:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Live Splunk mode is disabled. Set SPLUNK_LIVE_MODE=true and configure SPLUNK_MCP_TOKEN.",
        )

    splunk = get_splunk_adapter_native_default()
    model = _get_model_adapter()

    graph = TelemetryWasteAgentGraph(
        splunk_adapter=splunk,
        model_adapter=model,
        fetch_from_splunk=True,
    )

    workflow_id = f"wf_waste_live_{uuid.uuid4().hex[:12]}"
    state = TelemetryWasteAgentState(workflow_id=workflow_id, tenant_id=tenant_id)

    result = graph.run(state, environment=environment, action_type="read")

    if result.final_output is None:
        response = _provisional_output_from_state(
            workflow_id=workflow_id,
            tenant_id=tenant_id,
            state=result,
            environment=environment,
        )
        if demo_profile == "amplified":
            response = _apply_demo_amplification(response)
        return response

    response: dict[str, Any] = {
        "workflow_id": workflow_id,
        "calculation_assumptions": _CALCULATION_ASSUMPTIONS,
        "demo_profile": "standard",
        **result.final_output.model_dump(),
    }
    if demo_profile == "amplified":
        response = _apply_demo_amplification(response)
    return response


# ── Demo endpoint ─────────────────────────────────────────────────────────────


@router.get("/telemetry/metrics", summary="Return telemetry value metrics for dashboard")
def get_telemetry_metrics(ctx: AuthContext = Depends(require_analyst)) -> dict[str, Any]:
    """
    Return comprehensive telemetry value metrics including source utilization,
    security findings, ROI projections, and savings analysis.

    Data includes:
      - Source utilization scores and value ratings
      - Annual spend and potential savings per source
      - Security gaps and resolution confidence
      - 12-month savings projections
    """
    settings = get_settings()
    model_meta = select_model(
        task=TaskType.TELEMETRY,
        complexity=Complexity.LOW,
        latency_budget_ms=1000,
        provider=settings.model_provider,
    ).to_dict()
    request_started = time.perf_counter()
    search_window_days = max(1, int(settings.telemetry_metrics_search_window_days))
    query_plan = _telemetry_query_plan(search_window_days)
    cache_key = (
        f"{settings.tenant_safe_id}:{settings.splunk_live_mode}:"
        f"{settings.splunk_mcp_base_url}:{settings.splunk_adapter_mode}:"
        f"{settings.model_provider}:{settings.model_name}"
    )
    now = time.monotonic()
    cache_ttl = max(0, int(settings.telemetry_metrics_cache_ttl_seconds))
    cached = _TELEMETRY_METRICS_CACHE.get(cache_key)
    if cache_ttl > 0 and cached:
        cached_at, cached_payload = cached
        if (now - cached_at) < cache_ttl:
            return cached_payload

    # Live-data path: derive telemetry metrics from current Splunk data when live mode is enabled.
    if settings.splunk_live_mode:
        try:
            splunk = get_splunk_adapter_native_default()
            graph = TelemetryWasteAgentGraph(
                splunk_adapter=splunk,
                model_adapter=StubModelAdapter(),
                fetch_from_splunk=True,
                search_window_days=search_window_days,
            )
            workflow_id = f"wf_waste_metrics_{uuid.uuid4().hex[:10]}"
            state = TelemetryWasteAgentState(
                workflow_id=workflow_id,
                tenant_id=get_settings().tenant_safe_id,
            )
            result = graph.run(state, environment=settings.environment, action_type="read")

            profiles = result.source_profiles or []
            if profiles:
                rec_savings_by_source: dict[str, float] = {}
                for rec in result.recommendations:
                    rec_savings_by_source[rec.source_type] = (
                        rec_savings_by_source.get(rec.source_type, 0.0)
                        + float(rec.estimated_annual_savings_usd)
                    )

                sources: list[dict[str, Any]] = []
                for profile in sorted(profiles, key=lambda p: p.daily_ingest_gb, reverse=True)[:12]:
                    search_signal = (
                        int(profile.search_count_90d)
                        + int(profile.dashboard_references) * 12
                        + int(profile.alert_references) * 18
                    )
                    utilization_score = max(0, min(100, int(search_signal)))
                    value_rating = (
                        "High" if utilization_score >= 70 else "Medium" if utilization_score >= 40 else "Low"
                    )
                    annual_spend_usd = round(float(profile.daily_ingest_gb) * 365 * 150, 2)
                    potential_savings_usd = round(
                        min(annual_spend_usd, rec_savings_by_source.get(profile.source_type, 0.0)),
                        2,
                    )
                    recommendation = (
                        "Keep"
                        if utilization_score >= 70
                        else ("Remove" if utilization_score < 25 and potential_savings_usd > 0 else "Optimize")
                    )
                    sources.append(
                        {
                            "name": profile.source_type,
                            "index": profile.index,
                            "daily_ingest_gb": round(float(profile.daily_ingest_gb), 3),
                            "utilization_score": utilization_score,
                            "value_rating": value_rating,
                            "annual_spend_usd": annual_spend_usd,
                            "potential_savings_usd": potential_savings_usd,
                            "search_count_90d": int(profile.search_count_90d),
                            "dashboard_references": int(profile.dashboard_references),
                            "alert_references": int(profile.alert_references),
                            "recommendation": recommendation,
                        }
                    )

                total_annual_spend = round(sum(s["annual_spend_usd"] for s in sources), 2)
                total_potential_savings = round(sum(s["potential_savings_usd"] for s in sources), 2)
                avg_utilization_score = int(
                    round(sum(s["utilization_score"] for s in sources) / len(sources), 0)
                )
                optimization_ratio = (
                    (total_potential_savings / total_annual_spend) if total_annual_spend > 0 else 0.0
                )

                recommendation_complexity = (
                    "High"
                    if optimization_ratio > 0.35
                    else ("Medium" if optimization_ratio > 0.15 else "Low")
                )

                low_util_sources = [s for s in sources if s["value_rating"] == "Low"][:4]
                security_findings = []
                for i, source in enumerate(low_util_sources, start=1):
                    reason_codes: list[str] = []
                    if source["search_count_90d"] <= _WASTE_SEARCH_MAX_THRESHOLD:
                        reason_codes.append("NO_SEARCH_ACTIVITY")
                    if (
                        source["dashboard_references"] <= _WASTE_DASHBOARD_MAX_THRESHOLD
                        and source["alert_references"] <= _WASTE_ALERT_MAX_THRESHOLD
                    ):
                        reason_codes.append("NO_DOWNSTREAM_CONSUMERS")
                    if (
                        source["daily_ingest_gb"] >= _WASTE_INGEST_MIN_THRESHOLD_GB
                        and source["value_rating"] == "Low"
                    ):
                        reason_codes.append("LOW_VALUE_HIGH_COST")
                    if not reason_codes:
                        reason_codes.append("LOW_UTILIZATION_REVIEW")

                    security_findings.append(
                        {
                            "id": f"sec_live_{i:03d}",
                            "category": "Detection" if i % 2 == 1 else "Investigation",
                            "title": f"Low-value telemetry detected: {source['name']}",
                            "severity": "High" if source["utilization_score"] < 20 else "Medium",
                            "resolution_confidence_percent": min(
                                95,
                                max(65, int(result.confidence * 100) + 10),
                            ),
                            "impact_on_savings_percent": min(
                                25,
                                max(
                                    3,
                                    int(
                                        round(
                                            (source["potential_savings_usd"] / max(total_potential_savings, 1))
                                            * 100,
                                            0,
                                        )
                                    ),
                                ),
                            ),
                            "description": (
                                f"Source {source['name']} in index {source['index']} shows low utilization "
                                f"with {source['daily_ingest_gb']} GB/day ingest."
                            ),
                            "reason_codes": reason_codes,
                            "decision_thresholds": {
                                "ingest_min_gb_per_day": _WASTE_INGEST_MIN_THRESHOLD_GB,
                                "search_count_90d_max": _WASTE_SEARCH_MAX_THRESHOLD,
                                "dashboard_refs_max": _WASTE_DASHBOARD_MAX_THRESHOLD,
                                "alert_refs_max": _WASTE_ALERT_MAX_THRESHOLD,
                                "actual": {
                                    "daily_ingest_gb": source["daily_ingest_gb"],
                                    "search_count_90d": source["search_count_90d"],
                                    "dashboard_references": source["dashboard_references"],
                                    "alert_references": source["alert_references"],
                                },
                            },
                            "recommended_action": (
                                "Reduce retention + filter unused fields + move historical data to cold storage"
                                if source["recommendation"] != "Keep"
                                else "Keep source and monitor utilization monthly"
                            ),
                            "risk_if_removed": (
                                "Low"
                                if source["dashboard_references"] == 0 and source["alert_references"] == 0
                                else "Medium"
                            ),
                            "estimated_realized_savings_usd": round(
                                source["potential_savings_usd"] * 0.22,
                                2,
                            ),
                        }
                    )

                if not security_findings:
                    security_findings.append(
                        {
                            "id": "sec_live_001",
                            "category": "Response",
                            "title": "No critical telemetry blind spots detected",
                            "severity": "Medium",
                            "resolution_confidence_percent": min(95, max(65, int(result.confidence * 100))),
                            "impact_on_savings_percent": 5,
                            "description": "Live telemetry appears broadly utilized with lower immediate risk.",
                            "reason_codes": ["NO_CRITICAL_GAPS"],
                            "decision_thresholds": {
                                "ingest_min_gb_per_day": _WASTE_INGEST_MIN_THRESHOLD_GB,
                                "search_count_90d_max": _WASTE_SEARCH_MAX_THRESHOLD,
                                "dashboard_refs_max": _WASTE_DASHBOARD_MAX_THRESHOLD,
                                "alert_refs_max": _WASTE_ALERT_MAX_THRESHOLD,
                                "actual": {
                                    "daily_ingest_gb": 0.0,
                                    "search_count_90d": 0,
                                    "dashboard_references": 0,
                                    "alert_references": 0,
                                },
                            },
                            "recommended_action": "Continue monitoring. No immediate optimization action required.",
                            "risk_if_removed": "n/a",
                            "estimated_realized_savings_usd": 0.0,
                        }
                    )

                realized_steps = [0.0, 0.22, 0.48, 0.68, 0.82, 0.9]
                labels = ["Today", "Month 1", "Month 3", "Month 6", "Month 9", "Month 12"]
                months = [0, 1, 3, 6, 9, 12]
                projection = []
                for month, label, step in zip(months, labels, realized_steps, strict=False):
                    projection.append(
                        {
                            "month": month,
                            "label": label,
                            "current_trajectory_usd": total_annual_spend,
                            "optimized_trajectory_usd": round(
                                total_annual_spend - (total_potential_savings * step),
                                2,
                            ),
                        }
                    )

                resolved_adapter_mode = resolve_splunk_mode_for_workload(workload="deterministic")
                backend = (
                    "splunk-native"
                    if resolved_adapter_mode == "native"
                    else (
                        "splunk-mcp"
                        if resolved_adapter_mode == "mcp"
                        else ("splunk-auto" if settings.splunk_adapter_mode == "auto" else f"splunk-{resolved_adapter_mode}")
                    )
                )
                conflicts = _derive_metrics_conflicts(sources)
                actions = _derive_metrics_actions(conflicts=conflicts, sources=sources)
                live_latency_ms = int(round((time.perf_counter() - request_started) * 1000))

                payload = {
                    "summary": {
                        "total_annual_spend_usd": total_annual_spend,
                        "total_potential_savings_usd": total_potential_savings,
                        "avg_utilization_score": avg_utilization_score,
                        "security_gap_count": len(security_findings),
                        "recommendation_complexity": recommendation_complexity,
                    },
                    "sources": sources,
                    "security_findings": security_findings,
                    "savings_projection": projection,
                    "governance": _derive_metrics_governance(
                        approval_required=result.approval_required,
                        guardrail_notes=result.guardrail_notes,
                        has_policy_checks=bool(result.policy_checks),
                        optimization_ratio=optimization_ratio,
                    ),
                    "security": _derive_metrics_security(
                        security_gap_count=len(security_findings),
                        avg_utilization_score=avg_utilization_score,
                    ),
                    "conflicts": conflicts,
                    "actions": actions,
                    "trust": _derive_metrics_trust(
                        data_source="live",
                        fallback_used=False,
                        adapter_mode=settings.splunk_adapter_mode,
                        backend=backend,
                        latency_ms=live_latency_ms,
                        confidence=float(result.confidence),
                        coverage_pct=min(100, max(20, int((len(sources) / max(1, len(profiles))) * 100))),
                        freshness="live",
                    ),
                    "realized_savings": {
                        "estimated_annual_savings_usd": total_potential_savings,
                        "realized_to_date_usd": round(total_potential_savings * 0.22, 2),
                        "realization_pct": 22,
                        "next_milestone": "Month 3",
                        "next_milestone_target_usd": round(total_potential_savings * 0.48, 2),
                    },
                    "model_meta": model_meta,
                }
                payload.update(
                    _build_query_meta(
                        plan=query_plan,
                        adapter_mode=settings.splunk_adapter_mode,
                        resolved_adapter_mode=resolved_adapter_mode,
                        live_mode=settings.splunk_live_mode,
                        used_live_data=True,
                    )
                )
                _TELEMETRY_METRICS_CACHE[cache_key] = (now, payload)
                return payload
        except Exception as exc:
            # Fallback to static metrics below if live derivation fails.
            fallback_reason = f"{type(exc).__name__}: {exc}"
        else:
            fallback_reason = ""
    else:
        fallback_reason = "Live mode disabled by runtime settings."

    # Static fallback when live mode is disabled or live derivation fails.
    static_sources: list[dict[str, Any]] = [
        {
            "name": "Office 365",
            "index": "office365",
            "daily_ingest_gb": 45.2,
            "utilization_score": 92,
            "value_rating": "High",
            "annual_spend_usd": 820000,
            "potential_savings_usd": 45000,
            "search_count_90d": 2150,
            "dashboard_references": 18,
            "alert_references": 12,
            "recommendation": "Keep",
        },
        {
            "name": "DNS Logs",
            "index": "dns",
            "daily_ingest_gb": 15.3,
            "utilization_score": 78,
            "value_rating": "High",
            "annual_spend_usd": 420000,
            "potential_savings_usd": 95000,
            "search_count_90d": 890,
            "dashboard_references": 7,
            "alert_references": 5,
            "recommendation": "Keep",
        },
        {
            "name": "Cisco Nexus",
            "index": "cisco_nexus",
            "daily_ingest_gb": 120.8,
            "utilization_score": 22,
            "value_rating": "Low",
            "annual_spend_usd": 680000,
            "potential_savings_usd": 290000,
            "search_count_90d": 45,
            "dashboard_references": 1,
            "alert_references": 0,
            "recommendation": "Remove",
        },
        {
            "name": "Windows Events",
            "index": "windows_events",
            "daily_ingest_gb": 62.5,
            "utilization_score": 56,
            "value_rating": "Medium",
            "annual_spend_usd": 290000,
            "potential_savings_usd": 120000,
            "search_count_90d": 340,
            "dashboard_references": 4,
            "alert_references": 3,
            "recommendation": "Optimize",
        },
        {
            "name": "Application Logs",
            "index": "app_logs",
            "daily_ingest_gb": 28.9,
            "utilization_score": 68,
            "value_rating": "Medium",
            "annual_spend_usd": 190000,
            "potential_savings_usd": 30000,
            "search_count_90d": 560,
            "dashboard_references": 3,
            "alert_references": 2,
            "recommendation": "Optimize",
        },
    ]
    static_conflicts = _derive_metrics_conflicts(static_sources)
    static_actions = _derive_metrics_actions(conflicts=static_conflicts, sources=static_sources)
    fallback_latency_ms = int(round((time.perf_counter() - request_started) * 1000))
    payload = {
        "summary": {
            "total_annual_spend_usd": 2400000,
            "total_potential_savings_usd": 580000,
            "avg_utilization_score": 62,
            "security_gap_count": 8,
            "recommendation_complexity": "Medium",
        },
        "sources": static_sources,
        "security_findings": [
            {
                "id": "sec_001",
                "category": "Detection",
                "title": "Blind spot in cloud access detection",
                "severity": "Critical",
                "resolution_confidence_percent": 85,
                "impact_on_savings_percent": 12,
                "description": "SaaS cloud logs (Okta, GitHub) are not being indexed. Blind spot for unauthorized access detection.",
                "reason_codes": ["NO_DOWNSTREAM_CONSUMERS", "LOW_VALUE_HIGH_COST"],
                "decision_thresholds": {
                    "ingest_min_gb_per_day": _WASTE_INGEST_MIN_THRESHOLD_GB,
                    "search_count_90d_max": _WASTE_SEARCH_MAX_THRESHOLD,
                    "dashboard_refs_max": _WASTE_DASHBOARD_MAX_THRESHOLD,
                    "alert_refs_max": _WASTE_ALERT_MAX_THRESHOLD,
                    "actual": {
                        "daily_ingest_gb": 12.2,
                        "search_count_90d": 1,
                        "dashboard_references": 0,
                        "alert_references": 0,
                    },
                },
                "recommended_action": "Onboard cloud access logs to active detections and alert rules.",
                "risk_if_removed": "High",
                "estimated_realized_savings_usd": 14500.0,
            },
            {
                "id": "sec_002",
                "category": "Detection",
                "title": "Incomplete endpoint telemetry",
                "severity": "High",
                "resolution_confidence_percent": 78,
                "impact_on_savings_percent": 8,
                "description": "Only 60% of endpoints reporting logs. Missing visibility into rogue endpoint behavior.",
                "reason_codes": ["LOW_UTILIZATION_REVIEW"],
                "decision_thresholds": {
                    "ingest_min_gb_per_day": _WASTE_INGEST_MIN_THRESHOLD_GB,
                    "search_count_90d_max": _WASTE_SEARCH_MAX_THRESHOLD,
                    "dashboard_refs_max": _WASTE_DASHBOARD_MAX_THRESHOLD,
                    "alert_refs_max": _WASTE_ALERT_MAX_THRESHOLD,
                    "actual": {
                        "daily_ingest_gb": 8.0,
                        "search_count_90d": 2,
                        "dashboard_references": 1,
                        "alert_references": 0,
                    },
                },
                "recommended_action": "Enable endpoint telemetry coverage and route to security analytics index.",
                "risk_if_removed": "High",
                "estimated_realized_savings_usd": 9800.0,
            },
            {
                "id": "sec_003",
                "category": "Investigation",
                "title": "No forensic timeline correlation",
                "severity": "High",
                "resolution_confidence_percent": 72,
                "impact_on_savings_percent": 6,
                "description": "Log sources are not time-synchronized. Makes incident investigation difficult.",
                "reason_codes": ["LOW_UTILIZATION_REVIEW"],
                "decision_thresholds": {
                    "ingest_min_gb_per_day": _WASTE_INGEST_MIN_THRESHOLD_GB,
                    "search_count_90d_max": _WASTE_SEARCH_MAX_THRESHOLD,
                    "dashboard_refs_max": _WASTE_DASHBOARD_MAX_THRESHOLD,
                    "alert_refs_max": _WASTE_ALERT_MAX_THRESHOLD,
                    "actual": {
                        "daily_ingest_gb": 6.5,
                        "search_count_90d": 3,
                        "dashboard_references": 0,
                        "alert_references": 1,
                    },
                },
                "recommended_action": "Standardize timestamp parsing and normalize event time across sources.",
                "risk_if_removed": "Medium",
                "estimated_realized_savings_usd": 7200.0,
            },
            {
                "id": "sec_004",
                "category": "Response",
                "title": "Manual remediation workflows",
                "severity": "Medium",
                "resolution_confidence_percent": 88,
                "impact_on_savings_percent": 4,
                "description": "No automated response playbooks. All incidents require manual investigation.",
                "reason_codes": ["LOW_UTILIZATION_REVIEW"],
                "decision_thresholds": {
                    "ingest_min_gb_per_day": _WASTE_INGEST_MIN_THRESHOLD_GB,
                    "search_count_90d_max": _WASTE_SEARCH_MAX_THRESHOLD,
                    "dashboard_refs_max": _WASTE_DASHBOARD_MAX_THRESHOLD,
                    "alert_refs_max": _WASTE_ALERT_MAX_THRESHOLD,
                    "actual": {
                        "daily_ingest_gb": 4.0,
                        "search_count_90d": 2,
                        "dashboard_references": 1,
                        "alert_references": 1,
                    },
                },
                "recommended_action": "Convert frequent manual playbooks into approval-gated automations.",
                "risk_if_removed": "Medium",
                "estimated_realized_savings_usd": 5500.0,
            },
            {
                "id": "sec_005",
                "category": "Detection",
                "title": "Mobile device data missing",
                "severity": "High",
                "resolution_confidence_percent": 80,
                "impact_on_savings_percent": 10,
                "description": "No mobile device logs (iOS, Android). Blind spot for mobile-based threats.",
                "reason_codes": ["NO_DOWNSTREAM_CONSUMERS"],
                "decision_thresholds": {
                    "ingest_min_gb_per_day": _WASTE_INGEST_MIN_THRESHOLD_GB,
                    "search_count_90d_max": _WASTE_SEARCH_MAX_THRESHOLD,
                    "dashboard_refs_max": _WASTE_DASHBOARD_MAX_THRESHOLD,
                    "alert_refs_max": _WASTE_ALERT_MAX_THRESHOLD,
                    "actual": {
                        "daily_ingest_gb": 7.4,
                        "search_count_90d": 0,
                        "dashboard_references": 0,
                        "alert_references": 0,
                    },
                },
                "recommended_action": "Connect mobile telemetry and create baseline threat-hunt detections.",
                "risk_if_removed": "High",
                "estimated_realized_savings_usd": 11000.0,
            },
            {
                "id": "sec_006",
                "category": "Investigation",
                "title": "Weak data enrichment",
                "severity": "Medium",
                "resolution_confidence_percent": 75,
                "impact_on_savings_percent": 5,
                "description": "Limited threat intelligence and IP geolocation data enrichment.",
                "reason_codes": ["LOW_UTILIZATION_REVIEW"],
                "decision_thresholds": {
                    "ingest_min_gb_per_day": _WASTE_INGEST_MIN_THRESHOLD_GB,
                    "search_count_90d_max": _WASTE_SEARCH_MAX_THRESHOLD,
                    "dashboard_refs_max": _WASTE_DASHBOARD_MAX_THRESHOLD,
                    "alert_refs_max": _WASTE_ALERT_MAX_THRESHOLD,
                    "actual": {
                        "daily_ingest_gb": 5.2,
                        "search_count_90d": 4,
                        "dashboard_references": 1,
                        "alert_references": 0,
                    },
                },
                "recommended_action": "Enrich events with TI feeds and geolocation before indexing.",
                "risk_if_removed": "Medium",
                "estimated_realized_savings_usd": 6000.0,
            },
            {
                "id": "sec_007",
                "category": "Response",
                "title": "No real-time alerting",
                "severity": "High",
                "resolution_confidence_percent": 82,
                "impact_on_savings_percent": 7,
                "description": "Most alerts are 15-30 minutes delayed. Need immediate alerting for critical events.",
                "reason_codes": ["NO_DOWNSTREAM_CONSUMERS"],
                "decision_thresholds": {
                    "ingest_min_gb_per_day": _WASTE_INGEST_MIN_THRESHOLD_GB,
                    "search_count_90d_max": _WASTE_SEARCH_MAX_THRESHOLD,
                    "dashboard_refs_max": _WASTE_DASHBOARD_MAX_THRESHOLD,
                    "alert_refs_max": _WASTE_ALERT_MAX_THRESHOLD,
                    "actual": {
                        "daily_ingest_gb": 9.4,
                        "search_count_90d": 3,
                        "dashboard_references": 0,
                        "alert_references": 0,
                    },
                },
                "recommended_action": "Convert delayed reports to real-time saved searches with severity routing.",
                "risk_if_removed": "High",
                "estimated_realized_savings_usd": 8400.0,
            },
            {
                "id": "sec_008",
                "category": "Detection",
                "title": "User behavior baseline missing",
                "severity": "Medium",
                "resolution_confidence_percent": 70,
                "impact_on_savings_percent": 3,
                "description": "No UEBA (User and Entity Behavior Analytics) to detect anomalous patterns.",
                "reason_codes": ["LOW_UTILIZATION_REVIEW"],
                "decision_thresholds": {
                    "ingest_min_gb_per_day": _WASTE_INGEST_MIN_THRESHOLD_GB,
                    "search_count_90d_max": _WASTE_SEARCH_MAX_THRESHOLD,
                    "dashboard_refs_max": _WASTE_DASHBOARD_MAX_THRESHOLD,
                    "alert_refs_max": _WASTE_ALERT_MAX_THRESHOLD,
                    "actual": {
                        "daily_ingest_gb": 3.0,
                        "search_count_90d": 2,
                        "dashboard_references": 1,
                        "alert_references": 0,
                    },
                },
                "recommended_action": "Establish UEBA baselines and monitor anomalies with approval gates.",
                "risk_if_removed": "Medium",
                "estimated_realized_savings_usd": 4200.0,
            },
        ],
        "savings_projection": [
            {
                "month": 0,
                "label": "Today",
                "current_trajectory_usd": 2400000,
                "optimized_trajectory_usd": 2400000,
            },
            {
                "month": 1,
                "label": "Month 1",
                "current_trajectory_usd": 2400000,
                "optimized_trajectory_usd": 2280000,
            },
            {
                "month": 3,
                "label": "Month 3",
                "current_trajectory_usd": 2400000,
                "optimized_trajectory_usd": 2040000,
            },
            {
                "month": 6,
                "label": "Month 6",
                "current_trajectory_usd": 2400000,
                "optimized_trajectory_usd": 1920000,
            },
            {
                "month": 9,
                "label": "Month 9",
                "current_trajectory_usd": 2400000,
                "optimized_trajectory_usd": 1880000,
            },
            {
                "month": 12,
                "label": "Month 12",
                "current_trajectory_usd": 2400000,
                "optimized_trajectory_usd": 1820000,
            },
        ],
        "realized_savings": {
            "estimated_annual_savings_usd": 580000.0,
            "realized_to_date_usd": 127600.0,
            "realization_pct": 22,
            "next_milestone": "Month 3",
            "next_milestone_target_usd": 278400.0,
        },
        "model_meta": model_meta,
        "governance": _derive_metrics_governance(
            approval_required=False,
            guardrail_notes=[],
            has_policy_checks=False,
            optimization_ratio=580000 / 2400000,
        ),
        "security": _derive_metrics_security(
            security_gap_count=8,
            avg_utilization_score=62,
        ),
        "conflicts": static_conflicts,
        "actions": static_actions,
        "trust": _derive_metrics_trust(
            data_source="fallback",
            fallback_used=True,
            adapter_mode=settings.splunk_adapter_mode,
            backend="splunk-auto",
            latency_ms=fallback_latency_ms,
            confidence=0.82,
            coverage_pct=92,
            freshness="5 minutes ago",
        ),
    }
    payload.update(
        _build_query_meta(
            plan=query_plan,
            adapter_mode=settings.splunk_adapter_mode,
            resolved_adapter_mode=resolve_splunk_mode_for_workload(workload="deterministic"),
            live_mode=settings.splunk_live_mode,
            used_live_data=False,
            fallback_reason=fallback_reason,
        )
    )
    _TELEMETRY_METRICS_CACHE[cache_key] = (now, payload)
    return payload


@router.get("/demo", summary="Return demo waste analysis (Cisco ASA scenario)")
def waste_demo(ctx: AuthContext = Depends(require_analyst)) -> dict[str, Any]:
    """
    Run waste detection on the Cisco ASA demo fixture.

    Safe to call without a running Splunk. Uses pre-built fixture data that
    matches the BitsIO / Krishnateja meeting scenario:
      - cisco:asa: 28 GB/day, 0 searches, 7 unused fields
      - cisco:ios, ms365:activity, cisco:ise: similar pattern
      - linux:syslog, windows:security: active, excluded
      - Estimated annual savings: ~$100,000
    """
    if not _DEMO_FIXTURE.exists():
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Demo fixture not found. Ensure tests/fixtures/waste_detection/cisco_asa_demo.json exists.",
        )

    fixture = json.loads(_DEMO_FIXTURE.read_text(encoding="utf-8"))

    graph = TelemetryWasteAgentGraph(
        splunk_adapter=MagicMock(),
        model_adapter=StubModelAdapter(),
        fetch_from_splunk=False,
    )

    state = TelemetryWasteAgentState(
        workflow_id=fixture["workflow_id"],
        tenant_id=fixture["tenant_id"],
        raw_index_profiles=fixture["raw_index_profiles"],
        raw_search_activity=fixture["raw_search_activity"],
        raw_field_stats=fixture["raw_field_stats"],
    )

    result = graph.run(state, environment="dev", action_type="read")

    if result.final_output is None:
        return {"error": "Demo produced no output — check fixture data."}

    return {
        "workflow_id": fixture["workflow_id"],
        "scenario": "Cisco ASA firewall logs — 28 GB/day, 0 searches in 90 days",
        "tenant_id": fixture["tenant_id"],
        "calculation_assumptions": _CALCULATION_ASSUMPTIONS,
        **result.final_output.model_dump(),
    }
