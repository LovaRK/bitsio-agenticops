from __future__ import annotations

import os
from functools import lru_cache

from apps.api.app.services.splunk_live import SplunkIncidentService
from decision_tracing.store import InMemoryDecisionTraceStore
from splunk_mcp.adapter import SplunkMCPAdapter


@lru_cache(maxsize=1)
def get_trace_store() -> InMemoryDecisionTraceStore:
    return InMemoryDecisionTraceStore()


@lru_cache(maxsize=1)
def get_splunk_adapter() -> SplunkMCPAdapter:
    return SplunkMCPAdapter(
        base_url=os.getenv("SPLUNK_MCP_BASE_URL", "http://localhost:8081"),
        token=os.getenv("SPLUNK_MCP_TOKEN", "") or None,
        role=os.getenv("SPLUNK_MCP_ROLE", "read_only"),
    )


@lru_cache(maxsize=1)
def get_splunk_incident_service() -> SplunkIncidentService:
    return SplunkIncidentService(
        adapter=get_splunk_adapter(),
        splunk_web_base_url=os.getenv("SPLUNK_WEB_BASE_URL", "").strip() or None,
    )
