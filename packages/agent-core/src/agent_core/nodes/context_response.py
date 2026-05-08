from __future__ import annotations

from agent_core.state.context_state import IncidentContextAgentState


def _confidence(state: IncidentContextAgentState) -> float:
    score = 0.5
    if state.asset_context:
        score += 0.2
    if state.customer_context:
        score += 0.1
    high_rel = [item for item in state.similar_incidents if float(item.get("relevance", 0.0)) > 0.7]
    if len(high_rel) >= 3:
        score += 0.2
    return max(0.0, min(1.0, score))


def context_response(state: IncidentContextAgentState) -> IncidentContextAgentState:
    next_state = state.model_copy(deep=True)

    next_state.enriched_incident = {
        "original_incident": next_state.raw_incident,
        "asset": next_state.asset_context or {},
        "service": next_state.service_context or {},
        "customer": next_state.customer_context or {},
        "similar_incidents": next_state.similar_incidents,
        "anomaly": {
            "score": next_state.anomaly_score,
            "description": next_state.deviation_description,
            "baseline": next_state.baseline_metrics,
        },
        "correlation_score": next_state.correlation_score,
    }
    next_state.confidence = round(_confidence(next_state), 4)
    return next_state
