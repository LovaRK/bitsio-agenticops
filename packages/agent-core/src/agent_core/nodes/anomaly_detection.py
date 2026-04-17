from __future__ import annotations

import json
import os
from pathlib import Path

from agent_core.models.adapter import ModelAdapter
from agent_core.services.baseline_service import BaselineService
from agent_core.state.context_state import IncidentContextAgentState
from agent_core.telemetry import node_span

_PROMPT_PATH = Path("packages/prompts/graph-nodes/anomaly_explanation.txt")


def _z_score(current: float, baseline: float, stddev: float) -> float:
    denom = stddev if stddev > 0 else 1.0
    return abs((current - baseline) / denom)


def anomaly_detection(
    state: IncidentContextAgentState,
    baseline_service: BaselineService,
    model_adapter: ModelAdapter,
) -> IncidentContextAgentState:
    next_state = state.model_copy(deep=True)

    if not next_state.service_name:
        next_state.baseline_metrics = None
        next_state.anomaly_score = 0.0
        next_state.deviation_description = "No baseline available"
        return next_state

    span_kwargs = {
        "workflow_id": next_state.workflow_id,
        "graph_name": "incident_context_agent",
        "graph_version": "v1.0.0",
        "env": os.getenv("ENV", "dev"),
    }

    with node_span("anomaly_detection", **span_kwargs):
        baseline = baseline_service.get_baseline(next_state.service_name, lookback_days=30)
        if not baseline:
            next_state.baseline_metrics = None
            next_state.anomaly_score = 0.0
            next_state.deviation_description = "No baseline available"
            return next_state

        current_metrics = next_state.raw_incident.get("metrics", {})
        latency_current = float(current_metrics.get("latency_p95", baseline.get("latency_p95", 0.0)) or 0.0)
        error_current = float(current_metrics.get("error_rate", baseline.get("error_rate", 0.0)) or 0.0)

        stddev = baseline.get("stddev", {}) or {}
        latency_z = _z_score(
            latency_current,
            float(baseline.get("latency_p95", 0.0) or 0.0),
            float(stddev.get("latency_p95", 0.0) or 0.0),
        )
        error_z = _z_score(
            error_current,
            float(baseline.get("error_rate", 0.0) or 0.0),
            float(stddev.get("error_rate", 0.0) or 0.0),
        )
        anomaly = min(1.0, max(latency_z, error_z) / 5.0)

        next_state.baseline_metrics = baseline
        next_state.anomaly_score = round(anomaly, 4)

        if next_state.anomaly_score > 0.3:
            template = _PROMPT_PATH.read_text(encoding="utf-8")
            prompt = template.format(
                baseline=json.dumps(baseline, ensure_ascii=True),
                current=json.dumps(current_metrics, ensure_ascii=True),
                anomaly_score=f"{next_state.anomaly_score:.4f}",
            )
            next_state.deviation_description = model_adapter.generate(prompt)[:280]
        else:
            next_state.deviation_description = "Metrics remain within expected baseline variance."

    return next_state
