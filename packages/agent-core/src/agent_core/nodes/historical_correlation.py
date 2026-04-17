from __future__ import annotations

import json
import os
import re
from pathlib import Path
from statistics import mean
from typing import Any

from opentelemetry import trace

from agent_core.models.adapter import ModelAdapter
from agent_core.services.embedding_service import EmbeddingService
from agent_core.state.context_state import IncidentContextAgentState
from agent_core.telemetry import node_span

_PROMPT_PATH = Path("packages/prompts/graph-nodes/historical_correlation.txt")
_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")


def _redact_text(value: str) -> str:
    return _EMAIL_RE.sub("[REDACTED]", value)


def _extract_relevance_payload(raw: str) -> list[dict[str, Any]]:
    payload = json.loads(raw)
    if isinstance(payload, dict) and "items" in payload:
        payload = payload["items"]
    if not isinstance(payload, list):
        return []
    rows: list[dict[str, Any]] = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        relevance = float(item.get("relevance", 0.0) or 0.0)
        rows.append(
            {
                "incident_id": str(item.get("incident_id", "unknown")),
                "relevance": max(0.0, min(1.0, relevance)),
                "reasoning": str(item.get("reasoning", ""))[:200],
            }
        )
    return rows


def historical_correlation(
    state: IncidentContextAgentState,
    embedding_service: EmbeddingService,
    model_adapter: ModelAdapter,
    top_k: int = 5,
) -> IncidentContextAgentState:
    next_state = state.model_copy(deep=True)
    if next_state.errors and any(not err.startswith("warn:") for err in next_state.errors):
        return next_state

    text_blob = _redact_text(
        f"{next_state.raw_incident.get('title', '')} {next_state.raw_incident.get('description', '')}"
    )

    span_kwargs = {
        "workflow_id": next_state.workflow_id,
        "graph_name": "incident_context_agent",
        "graph_version": "v1.0.0",
        "env": os.getenv("ENV", "dev"),
    }
    with node_span("historical_correlation", **span_kwargs):
        tracer = trace.get_tracer("agent-core")
        with tracer.start_as_current_span("historical_correlation.model") as span:
            span.set_attribute("model.provider", model_adapter.__class__.__name__)

            embedding = embedding_service.embed(text_blob)
            candidates = embedding_service.search_similar(embedding, top_k=top_k)
            if not candidates:
                next_state.similar_incidents = []
                next_state.correlation_score = 0.0
                return next_state

            template = _PROMPT_PATH.read_text(encoding="utf-8")
            prompt = (
                template.replace("{{current_incident}}", json.dumps(next_state.raw_incident, ensure_ascii=True))
                .replace("{{candidates}}", json.dumps(candidates, ensure_ascii=True))
            )
            raw_response = model_adapter.generate(prompt)

            try:
                scored = _extract_relevance_payload(raw_response)
            except Exception:
                scored = []

            if not scored:
                # fallback to adapter-independent ordering
                scored = [
                    {
                        "incident_id": str(item.get("incident_id", "unknown")),
                        "relevance": float(item.get("raw_score", 0.0) or 0.0),
                        "reasoning": "Derived from vector distance fallback.",
                    }
                    for item in candidates
                ]

            merged: list[dict[str, Any]] = []
            candidate_by_id = {str(item.get("incident_id", "unknown")): item for item in candidates}
            for item in scored:
                base = candidate_by_id.get(item["incident_id"], {})
                merged.append({**base, **item})

            merged.sort(key=lambda item: float(item.get("relevance", 0.0)), reverse=True)
            next_state.similar_incidents = merged[:top_k]

            top3 = [float(item.get("relevance", 0.0)) for item in next_state.similar_incidents[:3]]
            next_state.correlation_score = round(mean(top3), 4) if top3 else 0.0

    return next_state
