from __future__ import annotations

import os
from functools import lru_cache

from apps.api.app.services.splunk_live import SplunkIncidentService
from decision_tracing.store import InMemoryDecisionTraceStore
from splunk_mcp.adapter import NativeSplunkAdapter, SplunkAdapter, SplunkMCPAdapter


@lru_cache(maxsize=1)
def get_trace_store() -> InMemoryDecisionTraceStore:
    return InMemoryDecisionTraceStore()


@lru_cache(maxsize=1)
def get_splunk_adapter() -> SplunkAdapter:
    mode = os.getenv("SPLUNK_ADAPTER_MODE", "auto").strip().lower()
    base_url = os.getenv("SPLUNK_MCP_BASE_URL", "http://localhost:8081")
    token = os.getenv("SPLUNK_MCP_TOKEN", "") or None
    role = os.getenv("SPLUNK_MCP_ROLE", "read_only")
    verify_ssl = os.getenv("SPLUNK_MCP_SSL_VERIFY", "true").lower() == "true"
    auth_scheme = os.getenv("SPLUNK_AUTH_SCHEME", "Bearer")

    resolved_mode = mode
    if mode == "auto":
        resolved_mode = "mcp" if "/services/mcp" in base_url else "native"

    if resolved_mode == "native":
        return NativeSplunkAdapter(
            base_url=base_url,
            token=token,
            role=role,
            verify_ssl=verify_ssl,
            auth_scheme=auth_scheme,
        )

    return SplunkMCPAdapter(
        base_url=base_url,
        token=token,
        role=role,
        verify_ssl=verify_ssl,
    )


@lru_cache(maxsize=1)
def get_splunk_incident_service() -> SplunkIncidentService:
    return SplunkIncidentService(
        adapter=get_splunk_adapter(),
        splunk_web_base_url=os.getenv("SPLUNK_WEB_BASE_URL", "").strip() or None,
    )
