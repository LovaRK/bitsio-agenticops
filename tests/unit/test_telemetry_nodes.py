from __future__ import annotations

import json
from pathlib import Path

from agent_core.models.adapter import StubModelAdapter
from agent_core.nodes.approval_check import approval_check
from agent_core.nodes.confidence_score import confidence_score
from agent_core.nodes.correlation import correlation
from agent_core.nodes.evidence_retrieval import evidence_retrieval
from agent_core.nodes.final_response import final_response
from agent_core.nodes.incident_ingest import incident_ingest
from agent_core.nodes.reasoning_draft import reasoning_draft
from agent_core.state.telemetry_state import TelemetryAgentState
from splunk_mcp.dtos import SearchResultDTO

FIXTURE_DIR = Path(__file__).parent.parent / "fixtures" / "telemetry_agent"


def _fixture(name: str) -> dict:
    return json.loads((FIXTURE_DIR / name).read_text(encoding="utf-8"))


def test_nodes_pipeline_happy_path() -> None:
    state = TelemetryAgentState(workflow_id="wf1", raw_incident=_fixture("raw_incident.json"))

    state = incident_ingest(state)
    assert state.incident_id == "inc_20260408_42"

    search = SearchResultDTO.model_validate(_fixture("search_result.json"))
    state = evidence_retrieval(state, search)
    assert len(state.evidence) == 3

    state = correlation(state)
    assert "payments-api-1" in state.correlation_findings[0]

    state = reasoning_draft(state, StubModelAdapter())
    assert state.reasoning_draft.startswith("stub:")

    state = confidence_score(state)
    assert 0.0 <= state.confidence <= 1.0

    state = approval_check(state, environment="dev", action_type="read")
    assert state.approval_required is False
    assert len(state.policy_checks) > 0

    state = final_response(state)
    assert state.final_output is not None


def test_approval_required_in_prod() -> None:
    state = TelemetryAgentState(workflow_id="wf2", raw_incident=_fixture("raw_incident.json"))
    state = incident_ingest(state)
    state = approval_check(state, environment="prod", action_type="read")
    assert state.approval_required is True


def test_final_response_halts_when_approval_pending() -> None:
    state = TelemetryAgentState(
        workflow_id="wf3",
        incident_id="inc1",
        approval_required=True,
    )
    state = final_response(state)
    assert state.final_output is None
