from __future__ import annotations

import os
from dataclasses import dataclass, field

from agent_core.models.adapter import ModelAdapter, StubModelAdapter
from agent_core.nodes.anomaly_detection import anomaly_detection
from agent_core.nodes.context_enrichment import context_enrichment
from agent_core.nodes.context_ingest import context_ingest
from agent_core.nodes.context_response import context_response
from agent_core.nodes.historical_correlation import historical_correlation
from agent_core.services.baseline_service import BaselineService, StubBaselineService
from agent_core.services.embedding_service import EmbeddingService, StubEmbeddingService
from agent_core.services.metadata_service import MetadataService, StubMetadataService
from agent_core.state.context_state import IncidentContextAgentState
from agent_core.telemetry import node_span

_GRAPH_NAME = "incident_context_agent"
_GRAPH_VERSION = "v1.0.0"


@dataclass
class IncidentContextAgentGraph:
    metadata_service: MetadataService = field(default_factory=StubMetadataService)
    embedding_service: EmbeddingService = field(default_factory=StubEmbeddingService)
    baseline_service: BaselineService = field(default_factory=StubBaselineService)
    model_adapter: ModelAdapter = field(default_factory=StubModelAdapter)

    def run(
        self,
        state: IncidentContextAgentState,
        *,
        environment: str = "dev",
    ) -> IncidentContextAgentState:
        env = environment or os.getenv("ENV", "dev")
        span_kwargs = {
            "workflow_id": state.workflow_id,
            "graph_name": _GRAPH_NAME,
            "graph_version": _GRAPH_VERSION,
            "env": env,
        }

        with node_span("context_ingest", **span_kwargs):
            current = context_ingest(state)

        with node_span("context_enrichment", **span_kwargs):
            current = context_enrichment(current, self.metadata_service)

        with node_span("historical_correlation", **span_kwargs):
            current = historical_correlation(
                current,
                embedding_service=self.embedding_service,
                model_adapter=self.model_adapter,
            )

        with node_span("anomaly_detection", **span_kwargs):
            current = anomaly_detection(
                current,
                baseline_service=self.baseline_service,
                model_adapter=self.model_adapter,
            )

        with node_span("context_response", **span_kwargs):
            current = context_response(current)

        return current
