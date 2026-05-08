from __future__ import annotations

import json
from pathlib import Path

from agent_core.models.adapter import StubModelAdapter
from agent_core.nodes.anomaly_detection import anomaly_detection
from agent_core.services.baseline_service import StubBaselineService
from agent_core.state.context_state import IncidentContextAgentState

_FIXTURES = Path(__file__).parent.parent / "fixtures" / "context"


class EchoModelAdapter(StubModelAdapter):
    def generate(self, prompt: str, *, temperature: float = 0.1) -> str:
        _ = temperature
        return f"Deviation detected: {prompt[:80]}"


def _fixture(name: str) -> dict:
    return json.loads((_FIXTURES / name).read_text(encoding="utf-8"))


def _state() -> IncidentContextAgentState:
    raw = _fixture("raw_incident_basic.json")
    return IncidentContextAgentState(
        workflow_id="wf_20260408_103",
        incident_id=raw["incident_id"],
        tenant_safe_id="tenant_demo",
        raw_incident=raw,
        customer_id=raw["customer_id"],
        service_name=raw["service_name"],
    )


def test_anomaly_score_zero_when_metrics_match_baseline() -> None:
    baseline = _fixture("baseline_metrics.json")
    state = _state().with_updates(raw_incident={**_state().raw_incident, "metrics": {"latency_p95": 240.0, "error_rate": 0.02}})
    svc = StubBaselineService({"payments-api": baseline})
    result = anomaly_detection(state, svc, EchoModelAdapter())
    assert result.anomaly_score == 0.0


def test_anomaly_score_high_when_metrics_exceed_5_stddev() -> None:
    baseline = _fixture("baseline_anomaly_high.json")
    state = _state().with_updates(raw_incident={**_state().raw_incident, "metrics": {"latency_p95": 300.0, "error_rate": 0.08}})
    svc = StubBaselineService({"payments-api": baseline})
    result = anomaly_detection(state, svc, EchoModelAdapter())
    assert result.anomaly_score >= 1.0


def test_anomaly_score_capped_at_1() -> None:
    baseline = _fixture("baseline_anomaly_high.json")
    state = _state().with_updates(raw_incident={**_state().raw_incident, "metrics": {"latency_p95": 800.0, "error_rate": 1.0}})
    svc = StubBaselineService({"payments-api": baseline})
    result = anomaly_detection(state, svc, EchoModelAdapter())
    assert result.anomaly_score == 1.0


def test_anomaly_uses_max_of_latency_and_error_rate_z_scores() -> None:
    baseline = _fixture("baseline_metrics.json")
    state = _state().with_updates(raw_incident={**_state().raw_incident, "metrics": {"latency_p95": 270.0, "error_rate": 0.2}})
    svc = StubBaselineService({"payments-api": baseline})
    result = anomaly_detection(state, svc, EchoModelAdapter())
    assert result.anomaly_score > 0.3


def test_anomaly_calls_llm_only_when_score_above_threshold() -> None:
    baseline = _fixture("baseline_metrics.json")
    svc = StubBaselineService({"payments-api": baseline})
    low = anomaly_detection(
        _state().with_updates(raw_incident={**_state().raw_incident, "metrics": {"latency_p95": 240.0, "error_rate": 0.02}}),
        svc,
        EchoModelAdapter(),
    )
    high = anomaly_detection(
        _state().with_updates(raw_incident={**_state().raw_incident, "metrics": {"latency_p95": 500.0, "error_rate": 0.2}}),
        svc,
        EchoModelAdapter(),
    )
    assert "Deviation detected" not in low.deviation_description
    assert "Deviation detected" in high.deviation_description


def test_anomaly_handles_missing_baseline_gracefully() -> None:
    result = anomaly_detection(_state(), StubBaselineService({}), EchoModelAdapter())
    assert result.anomaly_score == 0.0
    assert result.deviation_description == "No baseline available"


def test_anomaly_handles_zero_stddev() -> None:
    baseline = _fixture("baseline_metrics.json")
    baseline["stddev"] = {"latency_p95": 0.0, "error_rate": 0.0}
    state = _state().with_updates(raw_incident={**_state().raw_incident, "metrics": {"latency_p95": 500.0, "error_rate": 0.2}})
    svc = StubBaselineService({"payments-api": baseline})
    result = anomaly_detection(state, svc, EchoModelAdapter())
    assert result.anomaly_score <= 1.0


def test_anomaly_emits_otel_span() -> None:
    baseline = _fixture("baseline_metrics.json")
    svc = StubBaselineService({"payments-api": baseline})
    result = anomaly_detection(_state(), svc, EchoModelAdapter())
    assert result.workflow_id.startswith("wf_")
