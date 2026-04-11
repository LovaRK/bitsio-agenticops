from __future__ import annotations

import os
from dataclasses import dataclass, field

from agent_core.models.adapter import ModelAdapter, StubModelAdapter
from agent_core.nodes.approval_check import approval_check
from agent_core.nodes.confidence_score import confidence_score
from agent_core.nodes.correlation import correlation
from agent_core.nodes.evidence_retrieval import evidence_retrieval
from agent_core.nodes.final_response import final_response
from agent_core.nodes.incident_ingest import incident_ingest
from agent_core.nodes.reasoning_draft import reasoning_draft
from agent_core.state.telemetry_state import TelemetryAgentState
from agent_core.telemetry import node_span
from splunk_mcp.adapter import SplunkMCPAdapter

_GRAPH_NAME = "telemetry_value_agent"
_GRAPH_VERSION = "v1.0.0"


@dataclass
class TelemetryValueAgentGraph:
    splunk_adapter: SplunkMCPAdapter
    model_adapter: ModelAdapter = field(default_factory=StubModelAdapter)

    def run(
        self,
        state: TelemetryAgentState,
        *,
        earliest: str = "-15m",
        latest: str = "now",
        environment: str = "dev",
        action_type: str = "read",
    ) -> TelemetryAgentState:
        env = environment or os.getenv("ENV", "dev")
        wf_id = state.workflow_id

        span_kwargs = dict(
            workflow_id=wf_id,
            graph_name=_GRAPH_NAME,
            graph_version=_GRAPH_VERSION,
            env=env,
        )

        with node_span("incident_ingest", **span_kwargs):
            current = incident_ingest(state)

        with node_span("evidence_retrieval", **span_kwargs):
            search_result = self.splunk_adapter.run_search(
                query=f"search index=tutorial incident_id={current.incident_id}",
                earliest=earliest,
                latest=latest,
            )
            current = evidence_retrieval(current, search_result)

        with node_span("correlation", **span_kwargs):
            current = correlation(current)

        with node_span("reasoning_draft", **span_kwargs):
            current = reasoning_draft(current, self.model_adapter)

        with node_span("confidence_score", **span_kwargs):
            current = confidence_score(current)

        with node_span("approval_check", **span_kwargs):
            current = approval_check(current, environment=environment, action_type=action_type)

        with node_span("final_response", **span_kwargs):
            current = final_response(current)

        return current
