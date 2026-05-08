"""Unit tests for TokenCostService."""

from __future__ import annotations

import pytest

from apps.api.app.services.token_cost import TokenCostResult, TokenCostService


@pytest.fixture()
def svc() -> TokenCostService:
    return TokenCostService()


class TestEstimateCost:
    def test_ollama_zero_cost(self, svc: TokenCostService) -> None:
        result = svc.estimate_cost("ollama", "qwen2.5:7b", 1000, 200)
        assert result.estimated_cost_usd == 0.0
        assert result.cost_source == "derived"
        assert result.total_tokens == 1200

    def test_anthropic_haiku(self, svc: TokenCostService) -> None:
        result = svc.estimate_cost(
            "anthropic", "claude-haiku-4-5-20251001", 1_000_000, 1_000_000
        )
        # $0.80 input + $4.00 output = $4.80 per million each
        assert result.estimated_cost_usd == pytest.approx(4.80, abs=1e-5)
        assert result.cost_source == "derived"

    def test_stub_zero_cost(self, svc: TokenCostService) -> None:
        result = svc.estimate_cost("stub", "stub", 500, 100)
        assert result.estimated_cost_usd == 0.0

    def test_unknown_model_uses_provider_default(self, svc: TokenCostService) -> None:
        result = svc.estimate_cost("anthropic", "claude-future-9999", 1000, 1000)
        # Should fall back to anthropic:default pricing
        assert result.estimated_cost_usd is not None
        assert result.cost_source == "derived"

    def test_unknown_provider_returns_null(self, svc: TokenCostService) -> None:
        result = svc.estimate_cost("totally_unknown", "some_model", 100, 100)
        assert result.estimated_cost_usd is None
        assert result.cost_source == "not_applicable"
        assert result.reason is not None

    def test_total_tokens_calculated(self, svc: TokenCostService) -> None:
        result = svc.estimate_cost("ollama", "qwen2.5:7b", 300, 150)
        assert result.total_tokens == 450
        assert result.input_tokens == 300
        assert result.output_tokens == 150

    def test_zero_tokens(self, svc: TokenCostService) -> None:
        result = svc.estimate_cost("ollama", "qwen2.5:7b", 0, 0)
        assert result.total_tokens == 0
        assert result.estimated_cost_usd == 0.0


class TestAggregate:
    def test_aggregate_empty(self, svc: TokenCostService) -> None:
        result = svc.aggregate([])
        assert result.total_tokens == 0
        assert result.estimated_cost_usd is None
        assert result.cost_source == "not_applicable"

    def test_aggregate_sums_tokens(self, svc: TokenCostService) -> None:
        r1 = svc.estimate_cost("ollama", "qwen2.5:7b", 100, 50)
        r2 = svc.estimate_cost("ollama", "qwen2.5:7b", 200, 100)
        agg = svc.aggregate([r1, r2])
        assert agg.input_tokens == 300
        assert agg.output_tokens == 150
        assert agg.total_tokens == 450

    def test_aggregate_sums_cost(self, svc: TokenCostService) -> None:
        r1 = svc.estimate_cost("anthropic", "claude-haiku-4-5-20251001", 1000, 500)
        r2 = svc.estimate_cost("anthropic", "claude-haiku-4-5-20251001", 2000, 800)
        agg = svc.aggregate([r1, r2])
        expected = (
            r1.estimated_cost_usd + r2.estimated_cost_usd  # type: ignore[operator]
        )
        assert agg.estimated_cost_usd == pytest.approx(expected, abs=1e-8)
        assert agg.cost_source == "derived"

    def test_aggregate_null_cost_skipped(self, svc: TokenCostService) -> None:
        r1 = TokenCostResult(
            input_tokens=100,
            output_tokens=50,
            total_tokens=150,
            estimated_cost_usd=None,
            cost_source="not_applicable",
        )
        r2 = svc.estimate_cost("ollama", "qwen2.5:7b", 100, 50)
        agg = svc.aggregate([r1, r2])
        # Only ollama result contributes (cost=0.0)
        assert agg.estimated_cost_usd == pytest.approx(0.0)
        assert agg.total_tokens == 300

    def test_to_dict(self, svc: TokenCostService) -> None:
        result = svc.estimate_cost("ollama", "qwen2.5:7b", 100, 50)
        d = result.to_dict()
        assert "input_tokens" in d
        assert "estimated_cost_usd" in d
        assert "cost_source" in d
