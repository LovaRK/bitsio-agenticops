"""Token and cost reporting service.

All cost logic lives here — no duplication across routers.
Cost estimation is model/provider-aware. Local Ollama returns 0.0 (no external cost).
Cloud providers use per-million-token pricing.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Literal

log = logging.getLogger(__name__)

# Per-million-token pricing (input, output) in USD — updated 2026-04
_PRICING: dict[str, tuple[float, float]] = {
    # Anthropic Claude
    "claude-haiku-4-5-20251001":  (0.80, 4.00),
    "claude-haiku-4-5":           (0.80, 4.00),
    "claude-sonnet-4-5-20251001": (3.00, 15.00),
    "claude-sonnet-4-5":          (3.00, 15.00),
    "claude-sonnet-4-20250514":   (3.00, 15.00),
    "claude-opus-4-20250514":     (15.00, 75.00),
    # Generic fallback per provider
    "anthropic:default":          (3.00, 15.00),
    # Local Ollama — zero external cost
    "ollama:default":             (0.0, 0.0),
    # Stub — zero
    "stub:default":               (0.0, 0.0),
}


@dataclass
class TokenCostResult:
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    estimated_cost_usd: float | None = None
    cost_source: Literal["reported", "derived", "not_applicable"] = "not_applicable"
    latency_ms: int | None = None
    provider: str | None = None
    model: str | None = None
    reason: str | None = None

    def to_dict(self) -> dict:
        return {
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "total_tokens": self.total_tokens,
            "estimated_cost_usd": self.estimated_cost_usd,
            "cost_source": self.cost_source,
            "latency_ms": self.latency_ms,
            "provider": self.provider,
            "model": self.model,
            "reason": self.reason,
        }


class TokenCostService:
    """Centralised token / cost calculator."""

    def estimate_cost(
        self,
        provider: str,
        model: str,
        input_tokens: int,
        output_tokens: int,
    ) -> TokenCostResult:
        """Return a TokenCostResult with cost estimate.

        For Ollama (local), estimated_cost_usd is 0.0 (no cloud spend).
        For unknown models, try the provider default; if still unknown, return null + reason.
        """
        provider_lc = (provider or "").strip().lower()
        model_lc = (model or "").strip().lower()

        total = input_tokens + output_tokens

        # 1. Exact model match
        pricing = _PRICING.get(model_lc)

        # 2. Provider default
        if pricing is None:
            pricing = _PRICING.get(f"{provider_lc}:default")

        if pricing is None:
            log.debug("token_cost: no pricing for provider=%s model=%s", provider_lc, model_lc)
            return TokenCostResult(
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                total_tokens=total,
                estimated_cost_usd=None,
                cost_source="not_applicable",
                provider=provider,
                model=model,
                reason=f"No pricing table entry for provider={provider_lc}, model={model_lc}",
            )

        input_price_per_m, output_price_per_m = pricing
        cost = (input_tokens / 1_000_000) * input_price_per_m + (
            output_tokens / 1_000_000
        ) * output_price_per_m

        return TokenCostResult(
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total,
            estimated_cost_usd=round(cost, 8),
            cost_source="derived",
            provider=provider,
            model=model,
        )

    def aggregate(self, results: list[TokenCostResult]) -> TokenCostResult:
        """Sum a list of TokenCostResults into one aggregate."""
        total_input = sum(r.input_tokens for r in results)
        total_output = sum(r.output_tokens for r in results)
        costs = [r.estimated_cost_usd for r in results if r.estimated_cost_usd is not None]
        total_cost = round(sum(costs), 8) if costs else None
        source: Literal["reported", "derived", "not_applicable"] = (
            "derived" if costs else "not_applicable"
        )
        provider = results[0].provider if results else None
        model = results[0].model if results else None
        return TokenCostResult(
            input_tokens=total_input,
            output_tokens=total_output,
            total_tokens=total_input + total_output,
            estimated_cost_usd=total_cost,
            cost_source=source,
            provider=provider,
            model=model,
        )


class TimedOperation:
    """Context manager to measure latency_ms for a TokenCostResult."""

    def __init__(self, result: TokenCostResult) -> None:
        self._result = result
        self._start: float = 0.0

    def __enter__(self) -> "TimedOperation":
        self._start = time.perf_counter()
        return self

    def __exit__(self, *_: object) -> None:
        self._result.latency_ms = int((time.perf_counter() - self._start) * 1000)


# Module-level singleton — one service, not duplicated.
_service: TokenCostService | None = None


def get_token_cost_service() -> TokenCostService:
    global _service
    if _service is None:
        _service = TokenCostService()
    return _service
