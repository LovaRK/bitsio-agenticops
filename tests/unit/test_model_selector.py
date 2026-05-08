from apps.api.app.services.model_selector import Complexity, TaskType, select_model


def test_select_model_telemetry_is_deterministic() -> None:
    decision = select_model(
        task=TaskType.TELEMETRY,
        complexity=Complexity.LOW,
        latency_budget_ms=500,
        provider="ollama",
    )

    assert decision.llm_required is False
    assert decision.requested == "none"
    assert decision.resolved == "none"
    assert decision.reason == "deterministic_pipeline"


def test_select_model_fraud_prefers_quality_when_latency_allows() -> None:
    decision = select_model(
        task=TaskType.FRAUD,
        complexity=Complexity.HIGH,
        latency_budget_ms=1500,
        provider="ollama",
    )

    assert decision.llm_required is True
    assert decision.requested == "qwen2.5:14b"
    assert decision.resolved == "qwen2.5:14b"
    assert decision.reason == "high_complexity"


def test_select_model_fraud_downgrades_on_low_latency_budget() -> None:
    decision = select_model(
        task=TaskType.FRAUD,
        complexity=Complexity.HIGH,
        latency_budget_ms=900,
        provider="ollama",
    )

    assert decision.requested == "qwen2.5:14b"
    assert decision.resolved == "qwen2.5:7b"
    assert decision.reason == "latency_optimized"


def test_select_model_fallback_when_preferred_model_unavailable() -> None:
    decision = select_model(
        task=TaskType.INVESTIGATION,
        complexity=Complexity.HIGH,
        latency_budget_ms=1800,
        provider="ollama",
        available_models={"qwen2.5:7b"},
    )

    assert decision.requested == "qwen2.5:14b"
    assert decision.resolved == "qwen2.5:7b"
    assert decision.reason == "fallback_model_unavailable"

