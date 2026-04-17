from __future__ import annotations

from agent_core.state.context_state import IncidentContextAgentState

_REQUIRED_FIELDS = ("incident_id", "customer_id", "service_name", "severity", "timestamp")


def context_ingest(state: IncidentContextAgentState) -> IncidentContextAgentState:
    next_state = state.model_copy(deep=True)

    missing = [field for field in _REQUIRED_FIELDS if field not in next_state.raw_incident]
    if missing:
        next_state.errors.extend([f"missing_field:{item}" for item in missing])
        return next_state

    next_state.incident_id = str(next_state.raw_incident.get("incident_id", next_state.incident_id))
    next_state.customer_id = str(next_state.raw_incident.get("customer_id", "")).strip() or None
    next_state.service_name = str(next_state.raw_incident.get("service_name", "")).strip() or None
    return next_state
