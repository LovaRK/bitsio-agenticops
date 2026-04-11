from __future__ import annotations

from pathlib import Path

from agent_core.models.adapter import ModelAdapter
from agent_core.state.telemetry_state import TelemetryAgentState

PROMPT_PATH = Path("packages/prompts/graph-nodes/reasoning_draft.txt")


def reasoning_draft(state: TelemetryAgentState, model: ModelAdapter) -> TelemetryAgentState:
    next_state = state.model_copy(deep=True)
    template = PROMPT_PATH.read_text(encoding="utf-8")
    prompt = template.format(
        incident_id=next_state.incident_id,
        findings="; ".join(next_state.correlation_findings) or "none",
        missing=", ".join(next_state.missing_evidence) or "none",
    )
    next_state.reasoning_draft = model.generate(prompt)
    return next_state
