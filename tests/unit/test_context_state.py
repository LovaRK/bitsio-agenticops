from __future__ import annotations

import json
from pathlib import Path

import pytest

from agent_core.state.context_state import IncidentContextAgentState

_FIXTURES = Path(__file__).parent.parent / "fixtures" / "context"


def _fixture(name: str) -> dict:
    return json.loads((_FIXTURES / name).read_text(encoding="utf-8"))


def test_state_initialization_with_required_fields() -> None:
    raw = _fixture("raw_incident_basic.json")
    state = IncidentContextAgentState(
        workflow_id="wf_20260408_001",
        incident_id=raw["incident_id"],
        tenant_safe_id="tenant_demo",
        raw_incident=raw,
    )
    assert state.workflow_id == "wf_20260408_001"
    assert state.incident_id == "inc_ctx_001"


def test_state_immutability_via_with_updates() -> None:
    raw = _fixture("raw_incident_basic.json")
    state = IncidentContextAgentState(
        workflow_id="wf_20260408_001",
        incident_id=raw["incident_id"],
        tenant_safe_id="tenant_demo",
        raw_incident=raw,
    )
    updated = state.with_updates(confidence=0.88)
    assert state.confidence == 0.0
    assert updated.confidence == 0.88


def test_state_from_raw_incident_classmethod() -> None:
    raw = _fixture("raw_incident_basic.json")
    state = IncidentContextAgentState.from_raw_incident("wf_20260408_777", raw)
    assert state.incident_id == "inc_ctx_001"
    assert state.raw_incident["service_name"] == "payments-api"


def test_state_validates_workflow_id_format() -> None:
    raw = _fixture("raw_incident_basic.json")
    with pytest.raises(ValueError):
        IncidentContextAgentState(
            workflow_id="wf-invalid",
            incident_id=raw["incident_id"],
            tenant_safe_id="tenant_demo",
            raw_incident=raw,
        )


def test_state_rejects_pii_in_tenant_safe_id() -> None:
    raw = _fixture("raw_incident_basic.json")
    with pytest.raises(ValueError):
        IncidentContextAgentState(
            workflow_id="wf_20260408_001",
            incident_id=raw["incident_id"],
            tenant_safe_id="rama@bitsio.ai",
            raw_incident=raw,
        )


def test_state_default_values_for_optional_fields() -> None:
    raw = _fixture("raw_incident_basic.json")
    state = IncidentContextAgentState(
        workflow_id="wf_20260408_001",
        incident_id=raw["incident_id"],
        tenant_safe_id="tenant_demo",
        raw_incident=raw,
    )
    assert state.errors == []
    assert state.similar_incidents == []
    assert state.confidence == 0.0
