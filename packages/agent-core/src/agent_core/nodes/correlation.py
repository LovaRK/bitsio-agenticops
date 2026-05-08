from __future__ import annotations

from collections import Counter

from agent_core.state.telemetry_state import TelemetryAgentState


def correlation(state: TelemetryAgentState) -> TelemetryAgentState:
    next_state = state.model_copy(deep=True)
    hosts = [item.content.get("host", "unknown") for item in next_state.evidence]

    if not hosts:
        next_state.correlation_findings = ["No evidence available for host correlation."]
        return next_state

    counts = Counter(hosts)
    next_state.correlation_findings = [
        f"host={host} events={count}" for host, count in counts.most_common(3)
    ]
    return next_state
