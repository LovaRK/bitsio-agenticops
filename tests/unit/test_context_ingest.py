from __future__ import annotations

import json
from pathlib import Path

from agent_core.nodes.context_ingest import context_ingest
from agent_core.state.context_state import IncidentContextAgentState

_FIXTURES = Path(__file__).parent.parent / "fixtures" / "context"


def _fixture(name: str) -> dict:
    return json.loads((_FIXTURES / name).read_text(encoding="utf-8"))


def _state(name: str) -> IncidentContextAgentState:
    raw = _fixture(name)
    return IncidentContextAgentState(
        workflow_id="wf_20260408_100",
        incident_id=raw.get("incident_id", "inc-unknown"),
        tenant_safe_id="tenant_demo",
        raw_incident=raw,
    )


def test_ingest_extracts_customer_and_service_from_raw() -> None:
    result = context_ingest(_state("raw_incident_basic.json"))
    assert result.customer_id == "cust_001"
    assert result.service_name == "payments-api"


def test_ingest_appends_error_on_missing_incident_id() -> None:
    state = _state("raw_incident_basic.json").with_updates(raw_incident={"customer_id": "cust_001"})
    result = context_ingest(state)
    assert "missing_field:incident_id" in result.errors


def test_ingest_appends_error_on_missing_customer_id() -> None:
    result = context_ingest(_state("raw_incident_missing_fields.json"))
    assert "missing_field:customer_id" in result.errors


def test_ingest_is_pure_function() -> None:
    state = _state("raw_incident_basic.json")
    first = context_ingest(state)
    second = context_ingest(state)
    assert first.model_dump() == second.model_dump()


def test_ingest_does_not_mutate_input_state() -> None:
    state = _state("raw_incident_basic.json")
    _ = context_ingest(state)
    assert state.customer_id is None


def test_ingest_with_empty_raw_incident_returns_errors() -> None:
    state = _state("raw_incident_basic.json").with_updates(raw_incident={})
    result = context_ingest(state)
    assert len(result.errors) >= 1
