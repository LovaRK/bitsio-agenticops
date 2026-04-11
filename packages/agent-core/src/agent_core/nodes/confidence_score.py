from __future__ import annotations

from agent_core.state.telemetry_state import TelemetryAgentState


def confidence_score(state: TelemetryAgentState) -> TelemetryAgentState:
    next_state = state.model_copy(deep=True)

    evidence_factor = min(len(next_state.evidence) / 5.0, 1.0)
    missing_penalty = min(len(next_state.missing_evidence) * 0.15, 0.6)
    correlation_factor = min(len(next_state.correlation_findings) * 0.12, 0.35)

    score = max(0.0, min(1.0, evidence_factor + correlation_factor - missing_penalty))
    next_state.confidence = round(score, 2)
    return next_state
