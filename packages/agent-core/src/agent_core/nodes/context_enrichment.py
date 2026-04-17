from __future__ import annotations

import os
import re
from typing import Any

from agent_core.services.metadata_service import MetadataService
from agent_core.state.context_state import IncidentContextAgentState
from agent_core.telemetry import node_span

_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")


def _redact(value: dict[str, Any] | None) -> dict[str, Any]:
    if not value:
        return {}
    redacted: dict[str, Any] = {}
    for key, item in value.items():
        if isinstance(item, str):
            redacted[key] = _EMAIL_RE.sub("[REDACTED]", item)
        else:
            redacted[key] = item
    return redacted


def context_enrichment(
    state: IncidentContextAgentState,
    metadata_service: MetadataService,
) -> IncidentContextAgentState:
    next_state = state.model_copy(deep=True)
    if next_state.errors:
        return next_state

    span_kwargs = {
        "workflow_id": next_state.workflow_id,
        "graph_name": "incident_context_agent",
        "graph_version": "v1.0.0",
        "env": os.getenv("ENV", "dev"),
    }
    with node_span("context_enrichment", **span_kwargs):
        asset_id = str(next_state.raw_incident.get("asset_id", "")).strip()
        if asset_id:
            asset_context = metadata_service.get_asset(asset_id)
            next_state.asset_context = _redact(asset_context)
            if not asset_context:
                next_state.errors.append("warn:missing_asset_metadata")
        else:
            next_state.asset_context = {}

        if next_state.service_name:
            service_context = metadata_service.get_service(next_state.service_name)
            next_state.service_context = _redact(service_context)
            if not service_context:
                next_state.errors.append("warn:missing_service_metadata")
        else:
            next_state.service_context = {}

        if next_state.customer_id:
            customer_context = metadata_service.get_customer(next_state.customer_id)
            next_state.customer_context = _redact(customer_context)
            if not customer_context:
                next_state.errors.append("warn:missing_customer_metadata")
        else:
            next_state.customer_context = {}

    return next_state
