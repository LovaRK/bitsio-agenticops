from __future__ import annotations

from agent_core.domain.confidence import (
    CORRELATION_MAX,
    CORRELATION_MULTIPLIER,
    EVIDENCE_DIVISOR,
    MAX_CONFIDENCE,
    MIN_CONFIDENCE,
    MISSING_PENALTY_MAX,
    MISSING_PENALTY_MULTIPLIER,
    PRECISION_DECIMALS,
)
from agent_core.state.telemetry_state import TelemetryAgentState


def confidence_score(state: TelemetryAgentState) -> TelemetryAgentState:
    next_state = state.model_copy(deep=True)

    evidence_factor = min(len(next_state.evidence) / EVIDENCE_DIVISOR, 1.0)
    missing_penalty = min(
        len(next_state.missing_evidence) * MISSING_PENALTY_MULTIPLIER, MISSING_PENALTY_MAX
    )
    correlation_factor = min(
        len(next_state.correlation_findings) * CORRELATION_MULTIPLIER, CORRELATION_MAX
    )

    score = max(
        MIN_CONFIDENCE, min(MAX_CONFIDENCE, evidence_factor + correlation_factor - missing_penalty)
    )
    next_state.confidence = round(score, PRECISION_DECIMALS)
    return next_state
