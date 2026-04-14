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
import uuid
from pathlib import Path
from typing import Any, Literal
from unittest.mock import MagicMock

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from agent_core.graphs.telemetry_waste_agent import TelemetryWasteAgentGraph
from agent_core.models.adapter import AnthropicModelAdapter, OllamaModelAdapter, StubModelAdapter
from agent_core.state.waste_state import TelemetryWasteAgentState
from apps.api.app.dependencies import get_splunk_adapter
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
    splunk = get_splunk_adapter()
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

    splunk = get_splunk_adapter()
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
    # Mock data for telemetry metrics - in production would derive from waste analysis
    return {
        "summary": {
            "total_annual_spend_usd": 2400000,
            "total_potential_savings_usd": 580000,
            "avg_utilization_score": 62,
            "security_gap_count": 8,
            "recommendation_complexity": "Medium",
        },
        "sources": [
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
        ],
        "security_findings": [
            {
                "id": "sec_001",
                "category": "Detection",
                "title": "Blind spot in cloud access detection",
                "severity": "Critical",
                "resolution_confidence_percent": 85,
                "impact_on_savings_percent": 12,
                "description": "SaaS cloud logs (Okta, GitHub) are not being indexed. Blind spot for unauthorized access detection.",
            },
            {
                "id": "sec_002",
                "category": "Detection",
                "title": "Incomplete endpoint telemetry",
                "severity": "High",
                "resolution_confidence_percent": 78,
                "impact_on_savings_percent": 8,
                "description": "Only 60% of endpoints reporting logs. Missing visibility into rogue endpoint behavior.",
            },
            {
                "id": "sec_003",
                "category": "Investigation",
                "title": "No forensic timeline correlation",
                "severity": "High",
                "resolution_confidence_percent": 72,
                "impact_on_savings_percent": 6,
                "description": "Log sources are not time-synchronized. Makes incident investigation difficult.",
            },
            {
                "id": "sec_004",
                "category": "Response",
                "title": "Manual remediation workflows",
                "severity": "Medium",
                "resolution_confidence_percent": 88,
                "impact_on_savings_percent": 4,
                "description": "No automated response playbooks. All incidents require manual investigation.",
            },
            {
                "id": "sec_005",
                "category": "Detection",
                "title": "Mobile device data missing",
                "severity": "High",
                "resolution_confidence_percent": 80,
                "impact_on_savings_percent": 10,
                "description": "No mobile device logs (iOS, Android). Blind spot for mobile-based threats.",
            },
            {
                "id": "sec_006",
                "category": "Investigation",
                "title": "Weak data enrichment",
                "severity": "Medium",
                "resolution_confidence_percent": 75,
                "impact_on_savings_percent": 5,
                "description": "Limited threat intelligence and IP geolocation data enrichment.",
            },
            {
                "id": "sec_007",
                "category": "Response",
                "title": "No real-time alerting",
                "severity": "High",
                "resolution_confidence_percent": 82,
                "impact_on_savings_percent": 7,
                "description": "Most alerts are 15-30 minutes delayed. Need immediate alerting for critical events.",
            },
            {
                "id": "sec_008",
                "category": "Detection",
                "title": "User behavior baseline missing",
                "severity": "Medium",
                "resolution_confidence_percent": 70,
                "impact_on_savings_percent": 3,
                "description": "No UEBA (User and Entity Behavior Analytics) to detect anomalous patterns.",
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
    }


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
