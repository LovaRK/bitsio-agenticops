from __future__ import annotations

from agent_core.state.telemetry_state import TelemetryAgentState

REQUIRED_FIELDS = ("incident_id", "title", "severity", "timestamp")


def incident_ingest(state: TelemetryAgentState) -> TelemetryAgentState:
    next_state = state.model_copy(deep=True)
    missing = [field for field in REQUIRED_FIELDS if field not in next_state.raw_incident]

    if missing:
        next_state.missing_evidence.extend([f"missing_field:{item}" for item in missing])

    next_state.incident_id = str(next_state.raw_incident.get("incident_id", next_state.workflow_id))
    return next_state
