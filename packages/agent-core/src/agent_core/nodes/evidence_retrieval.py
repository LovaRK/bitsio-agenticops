from __future__ import annotations

from agent_core.state.telemetry_state import EvidenceItem, TelemetryAgentState
from splunk_mcp.dtos import SearchResultDTO


def evidence_retrieval(
    state: TelemetryAgentState, search_result: SearchResultDTO
) -> TelemetryAgentState:
    next_state = state.model_copy(deep=True)

    evidence_items: list[EvidenceItem] = []
    for idx, row in enumerate(search_result.results):
        evidence_items.append(
            EvidenceItem(
                source="splunk",
                reference=f"splunk://result/{idx}",
                content=row,
            )
        )

    next_state.evidence = evidence_items
    if not evidence_items:
        next_state.missing_evidence.append("splunk:no_results")

    return next_state
