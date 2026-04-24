"""Deterministic model selection policy for task-level routing."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Literal


class TaskType(str, Enum):
    TELEMETRY = "telemetry"
    FRAUD = "fraud"
    CLASSIFICATION = "classification"
    CHAT = "chat"
    INVESTIGATION = "investigation"


class Complexity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


@dataclass(frozen=True)
class ModelDecision:
    task: str
    complexity: str
    latency_budget_ms: int
    context_size: int
    requested: str
    resolved: str
    reason: str
    llm_required: bool
    source: Literal["policy"] = "policy"

    def to_dict(self) -> dict[str, str | int | bool]:
        return {
            "task": self.task,
            "complexity": self.complexity,
            "latency_budget_ms": self.latency_budget_ms,
            "context_size": self.context_size,
            "requested": self.requested,
            "resolved": self.resolved,
            "reason": self.reason,
            "llm_required": self.llm_required,
            "source": self.source,
        }


def _provider_tier_models(provider: str) -> tuple[str, str]:
    normalized = provider.strip().lower()
    if normalized == "anthropic":
        return ("claude-haiku-4-5-20251001", "claude-sonnet-4-5-20251001")
    if normalized == "stub":
        return ("stub", "stub")
    return ("qwen2.5:7b", "qwen2.5:14b")


def _fallback_model(
    *,
    preferred_model: str,
    available_models: set[str],
    provider: str,
) -> tuple[str, str | None]:
    if not available_models or preferred_model in available_models:
        return preferred_model, None
    fast_model, _ = _provider_tier_models(provider)
    if fast_model in available_models:
        return fast_model, "fallback_model_unavailable"
    return next(iter(sorted(available_models))), "fallback_model_unavailable"


def select_model(
    *,
    task: TaskType,
    complexity: Complexity,
    latency_budget_ms: int,
    provider: str,
    available_models: set[str] | None = None,
    context_size: int = 0,
) -> ModelDecision:
    fast_model, quality_model = _provider_tier_models(provider)
    available = available_models or set()

    if task == TaskType.TELEMETRY:
        return ModelDecision(
            task=task.value,
            complexity=complexity.value,
            latency_budget_ms=max(0, int(latency_budget_ms)),
            context_size=max(0, int(context_size)),
            requested="none",
            resolved="none",
            reason="deterministic_pipeline",
            llm_required=False,
        )

    requested = fast_model
    reason = "default_low_cost"
    llm_required = True

    if task in {TaskType.FRAUD, TaskType.INVESTIGATION}:
        requested = quality_model
        reason = "multi_signal_reasoning"
    elif task == TaskType.CLASSIFICATION:
        requested = fast_model
        reason = "fast_classification"
    elif task == TaskType.CHAT:
        requested = fast_model
        reason = "chat_low_latency_default"

    if complexity == Complexity.HIGH:
        requested = quality_model
        reason = "high_complexity"

    resolved = requested
    if latency_budget_ms < 1000:
        resolved = fast_model
        reason = "latency_optimized"

    resolved, fallback_reason = _fallback_model(
        preferred_model=resolved,
        available_models=available,
        provider=provider,
    )
    if fallback_reason:
        reason = fallback_reason

    return ModelDecision(
        task=task.value,
        complexity=complexity.value,
        latency_budget_ms=max(0, int(latency_budget_ms)),
        context_size=max(0, int(context_size)),
        requested=requested,
        resolved=resolved,
        reason=reason,
        llm_required=llm_required,
    )
