from __future__ import annotations

import json
from pathlib import Path

from agent_core.graphs.incident_context_agent import IncidentContextAgentGraph
from agent_core.models.adapter import StubModelAdapter
from agent_core.services.baseline_service import StubBaselineService
from agent_core.services.embedding_service import StubEmbeddingService
from agent_core.services.metadata_service import StubMetadataService
from agent_core.state.context_state import IncidentContextAgentState

_FIXTURES = Path(__file__).parent.parent / "fixtures" / "context"


def _fixture(name: str) -> dict:
    return json.loads((_FIXTURES / name).read_text(encoding="utf-8"))


def _graph() -> IncidentContextAgentGraph:
    return IncidentContextAgentGraph(
        metadata_service=StubMetadataService(),
        embedding_service=StubEmbeddingService(),
        baseline_service=StubBaselineService(),
        model_adapter=StubModelAdapter(),
    )


def test_partial_graph_runs_both_nodes_in_order() -> None:
    raw = _fixture("raw_incident_basic.json")
    state = IncidentContextAgentState.from_raw_incident("wf_20260408_106", raw)
    result = _graph().run(state)
    assert result.service_context is not None
    assert result.enriched_incident is not None


def test_partial_graph_propagates_errors_through_short_circuit() -> None:
    raw = _fixture("raw_incident_missing_fields.json")
    state = IncidentContextAgentState.from_raw_incident("wf_20260408_107", raw)
    result = _graph().run(state)
    assert any("missing_field:customer_id" in err for err in result.errors)


def test_partial_graph_emits_2_spans_per_run() -> None:
    raw = _fixture("raw_incident_basic.json")
    state = IncidentContextAgentState.from_raw_incident("wf_20260408_108", raw)
    result = _graph().run(state)
    assert result.workflow_id == "wf_20260408_108"
