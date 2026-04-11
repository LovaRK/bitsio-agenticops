from __future__ import annotations

from agent_core.state.telemetry_state import TelemetryAgentState, TelemetryFinalOutput


def final_response(state: TelemetryAgentState) -> TelemetryAgentState:
    next_state = state.model_copy(deep=True)

    if next_state.approval_required:
        next_state.final_output = None
        return next_state

    probable_cause = (
        next_state.correlation_findings[0]
        if next_state.correlation_findings
        else "Insufficient evidence to identify probable cause"
    )

    next_state.final_output = TelemetryFinalOutput(
        summary=next_state.reasoning_draft or "No reasoning draft generated.",
        probable_cause=probable_cause,
        evidence_refs=[item.reference for item in next_state.evidence],
        missing_evidence=next_state.missing_evidence,
        next_best_action=next_state.recommended_action
        or "Validate indexed events and rerun triage.",
        confidence=next_state.confidence,
        guardrail_notes=next_state.guardrail_notes,
        approval_required=next_state.approval_required,
    )
    return next_state
