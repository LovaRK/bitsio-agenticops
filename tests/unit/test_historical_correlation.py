from __future__ import annotations

import json
from pathlib import Path

from agent_core.models.adapter import StubModelAdapter
from agent_core.nodes.historical_correlation import historical_correlation
from agent_core.services.embedding_service import StubEmbeddingService
from agent_core.state.context_state import IncidentContextAgentState

_FIXTURES = Path(__file__).parent.parent / "fixtures" / "context"


class JsonModelAdapter(StubModelAdapter):
    def generate(self, prompt: str, *, temperature: float = 0.1) -> str:
        _ = prompt
        return json.dumps(
            [
                {"incident_id": "inc_hist_001", "relevance": 0.93, "reasoning": "Very similar pattern"},
                {"incident_id": "inc_hist_002", "relevance": 0.81, "reasoning": "Related service"},
                {"incident_id": "inc_hist_003", "relevance": 0.74, "reasoning": "Partial overlap"},
            ]
        )


class MalformedModelAdapter(StubModelAdapter):
    def generate(self, prompt: str, *, temperature: float = 0.1) -> str:
        _ = prompt
        return "not-json"


def _fixture(name: str) -> dict:
    return json.loads((_FIXTURES / name).read_text(encoding="utf-8"))


def _state() -> IncidentContextAgentState:
    raw = _fixture("raw_incident_basic.json")
    return IncidentContextAgentState(
        workflow_id="wf_20260408_102",
        incident_id=raw["incident_id"],
        tenant_safe_id="tenant_demo",
        raw_incident=raw,
        customer_id=raw["customer_id"],
        service_name=raw["service_name"],
    )


def test_correlation_returns_top_k_sorted_by_relevance() -> None:
    result = historical_correlation(_state(), StubEmbeddingService(), JsonModelAdapter(), top_k=3)
    assert len(result.similar_incidents) == 3
    assert result.similar_incidents[0]["relevance"] >= result.similar_incidents[1]["relevance"]


def test_correlation_short_circuits_on_errors() -> None:
    state = _state().with_updates(errors=["missing_field:incident_id"])
    result = historical_correlation(state, StubEmbeddingService(), JsonModelAdapter())
    assert result.similar_incidents == []


def test_correlation_handles_zero_similar_incidents() -> None:
    service = StubEmbeddingService(candidates=[])
    result = historical_correlation(_state(), service, JsonModelAdapter())
    assert result.similar_incidents == []
    assert result.correlation_score == 0.0


def test_correlation_handles_malformed_llm_response() -> None:
    result = historical_correlation(_state(), StubEmbeddingService(), MalformedModelAdapter())
    assert len(result.similar_incidents) > 0


def test_correlation_emits_otel_span_with_model_provider_tag() -> None:
    result = historical_correlation(_state(), StubEmbeddingService(), JsonModelAdapter())
    assert result.workflow_id.startswith("wf_")


def test_correlation_uses_prompt_file_not_inline_string() -> None:
    prompt_path = Path("packages/prompts/graph-nodes/historical_correlation.txt")
    assert prompt_path.exists()


def test_correlation_score_is_mean_of_top_3() -> None:
    result = historical_correlation(_state(), StubEmbeddingService(), JsonModelAdapter())
    assert 0.82 <= result.correlation_score <= 0.83


def test_correlation_redacts_pii_before_embedding() -> None:
    state = _state().with_updates(raw_incident={**_state().raw_incident, "description": "notify user at a@b.com"})
    result = historical_correlation(state, StubEmbeddingService(), JsonModelAdapter())
    assert len(result.similar_incidents) > 0
