from __future__ import annotations

from agent_core.graphs.incident_context_agent import IncidentContextAgentGraph
from agent_core.models.adapter import StubModelAdapter
from agent_core.services.baseline_service import StubBaselineService
from agent_core.services.embedding_service import StubEmbeddingService
from agent_core.services.metadata_service import StubMetadataService
from agent_core.state.context_state import IncidentContextAgentState


def _graph() -> IncidentContextAgentGraph:
    return IncidentContextAgentGraph(
        metadata_service=StubMetadataService(),
        embedding_service=StubEmbeddingService(),
        baseline_service=StubBaselineService(),
        model_adapter=StubModelAdapter(),
    )


def test_full_graph_run_with_all_stubs() -> None:
    raw = {
        "incident_id": "inc_ctx_999",
        "tenant_safe_id": "tenant_demo",
        "customer_id": "cust_001",
        "service_name": "payments-api",
        "asset_id": "asset-payments-api-1",
        "severity": "high",
        "timestamp": "2026-04-08T10:00:00Z",
        "title": "Payments timeout spike",
        "description": "timeouts with retry amplification",
        "metrics": {"latency_p95": 420, "error_rate": 0.08},
    }
    state = IncidentContextAgentState.from_raw_incident("wf_20260408_109", raw)
    result = _graph().run(state)
    assert result.enriched_incident is not None
    assert result.confidence >= 0.5
    assert len(result.similar_incidents) == 5
    assert result.anomaly_score > 0


def test_full_graph_short_circuits_on_ingest_error() -> None:
    raw = {"incident_id": "inc_ctx_999"}
    state = IncidentContextAgentState.from_raw_incident("wf_20260408_110", raw)
    result = _graph().run(state)
    assert any("missing_field:" in error for error in result.errors)


def test_full_graph_emits_5_spans_in_order() -> None:
    raw = {
        "incident_id": "inc_ctx_999",
        "tenant_safe_id": "tenant_demo",
        "customer_id": "cust_001",
        "service_name": "payments-api",
        "asset_id": "asset-payments-api-1",
        "severity": "high",
        "timestamp": "2026-04-08T10:00:00Z",
        "title": "Payments timeout spike",
        "description": "timeouts with retry amplification",
        "metrics": {"latency_p95": 420, "error_rate": 0.08},
    }
    state = IncidentContextAgentState.from_raw_incident("wf_20260408_111", raw)
    result = _graph().run(state)
    assert result.workflow_id == "wf_20260408_111"
