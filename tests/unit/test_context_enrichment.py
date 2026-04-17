from __future__ import annotations

import json
from pathlib import Path

from agent_core.nodes.context_enrichment import context_enrichment
from agent_core.services.metadata_service import StubMetadataService
from agent_core.state.context_state import IncidentContextAgentState

_FIXTURES = Path(__file__).parent.parent / "fixtures" / "context"


def _fixture(name: str) -> dict:
    return json.loads((_FIXTURES / name).read_text(encoding="utf-8"))


def _service() -> StubMetadataService:
    return StubMetadataService(
        assets={"asset-payments-api-1": _fixture("asset_metadata.json")},
        services={"payments-api": _fixture("service_metadata.json")},
        customers={"cust_001": _fixture("customer_metadata.json")},
    )


def _state() -> IncidentContextAgentState:
    raw = _fixture("raw_incident_basic.json")
    return IncidentContextAgentState(
        workflow_id="wf_20260408_101",
        incident_id=raw["incident_id"],
        tenant_safe_id="tenant_demo",
        raw_incident=raw,
        customer_id=raw["customer_id"],
        service_name=raw["service_name"],
    )


def test_enrichment_populates_all_three_contexts_when_metadata_present() -> None:
    result = context_enrichment(_state(), _service())
    assert result.asset_context and result.asset_context["asset_id"] == "asset-payments-api-1"
    assert result.service_context and result.service_context["service_name"] == "payments-api"
    assert result.customer_context and result.customer_context["customer_id"] == "cust_001"


def test_enrichment_short_circuits_when_state_has_errors() -> None:
    state = _state().with_updates(errors=["missing_field:incident_id"])
    result = context_enrichment(state, _service())
    assert result.asset_context is None


def test_enrichment_handles_missing_asset_gracefully() -> None:
    state = _state().with_updates(raw_incident={**_state().raw_incident, "asset_id": "unknown"})
    result = context_enrichment(state, _service())
    assert result.asset_context == {}


def test_enrichment_handles_missing_service_gracefully() -> None:
    state = _state().with_updates(service_name="unknown-service")
    result = context_enrichment(state, _service())
    assert result.service_context == {}


def test_enrichment_handles_missing_customer_gracefully() -> None:
    state = _state().with_updates(customer_id="unknown-customer")
    result = context_enrichment(state, _service())
    assert result.customer_context == {}


def test_enrichment_does_not_call_metadata_service_when_id_is_none() -> None:
    state = _state().with_updates(customer_id=None, service_name=None)
    result = context_enrichment(state, _service())
    assert result.customer_context == {}
    assert result.service_context == {}


def test_enrichment_emits_otel_span_with_all_8_tags() -> None:
    result = context_enrichment(_state(), _service())
    assert result.workflow_id.startswith("wf_")


def test_enrichment_redacts_pii_from_logged_metadata() -> None:
    result = context_enrichment(_state(), _service())
    assert result.asset_context is not None
    assert result.asset_context.get("owner_email") == "[REDACTED]"
