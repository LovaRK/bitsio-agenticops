from __future__ import annotations

from agent_core.nodes.context_response import context_response
from agent_core.state.context_state import IncidentContextAgentState


def test_context_response_assembles_enriched_incident() -> None:
    state = IncidentContextAgentState(
        workflow_id="wf_20260408_104",
        incident_id="inc_ctx_001",
        tenant_safe_id="tenant_demo",
        raw_incident={"incident_id": "inc_ctx_001"},
        asset_context={"asset_id": "a1"},
        service_context={"service_name": "svc"},
        customer_context={"customer_id": "c1"},
        similar_incidents=[{"incident_id": "x", "relevance": 0.9} for _ in range(3)],
        correlation_score=0.8,
        anomaly_score=0.6,
        deviation_description="High latency anomaly",
    )
    result = context_response(state)
    assert result.enriched_incident is not None
    assert result.enriched_incident["anomaly"]["score"] == 0.6


def test_context_response_confidence_clamped() -> None:
    state = IncidentContextAgentState(
        workflow_id="wf_20260408_105",
        incident_id="inc_ctx_001",
        tenant_safe_id="tenant_demo",
        raw_incident={"incident_id": "inc_ctx_001"},
        asset_context={"asset_id": "a1"},
        customer_context={"customer_id": "c1"},
        similar_incidents=[{"incident_id": "x", "relevance": 0.95} for _ in range(3)],
    )
    result = context_response(state)
    assert 0.0 <= result.confidence <= 1.0
    assert result.confidence == 1.0
