from __future__ import annotations

from functools import lru_cache

from apps.api.app.services.splunk_live import SplunkIncidentService
from decision_tracing.store import InMemoryDecisionTraceStore
from packages.shared.config.settings import get_settings
from splunk_mcp.adapter import NativeSplunkAdapter, SplunkAdapter, SplunkMCPAdapter


@lru_cache(maxsize=1)
def get_trace_store() -> InMemoryDecisionTraceStore:
    return InMemoryDecisionTraceStore()


@lru_cache(maxsize=1)
def get_splunk_adapter() -> SplunkAdapter:
    settings = get_settings()
    mode = settings.splunk_adapter_mode.strip().lower()
    base_url = settings.splunk_mcp_base_url
    token = settings.splunk_mcp_token or None
    role = settings.splunk_mcp_role
    verify_ssl = settings.splunk_mcp_ssl_verify
    auth_scheme = settings.splunk_auth_scheme

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
    settings = get_settings()
    return SplunkIncidentService(
        adapter=get_splunk_adapter(),
        splunk_web_base_url=settings.splunk_web_base_url.strip() or None,
    )
