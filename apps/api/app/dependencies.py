from __future__ import annotations

import logging
from functools import lru_cache

from apps.api.app.services.splunk_live import SplunkIncidentService
from decision_tracing.store import InMemoryDecisionTraceStore
from packages.shared.config.settings import get_settings
from splunk_mcp.adapter import NativeSplunkAdapter, SplunkAdapter, SplunkMCPAdapter

LOGGER = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_trace_store() -> InMemoryDecisionTraceStore:
    return InMemoryDecisionTraceStore()


def _resolve_splunk_mode(mode: str, base_url: str) -> str:
    normalized_mode = mode.strip().lower()
    if normalized_mode == "auto":
        return "mcp" if "/services/mcp" in base_url else "native"
    return normalized_mode


def get_splunk_adapter() -> SplunkAdapter:
    settings = get_settings()
    mode = settings.splunk_adapter_mode.strip().lower()
    base_url = settings.splunk_mcp_base_url
    token = settings.splunk_mcp_token or None
    role = settings.splunk_mcp_role
    verify_ssl = settings.splunk_mcp_ssl_verify
    auth_scheme = settings.splunk_auth_scheme

    resolved_mode = _resolve_splunk_mode(mode, base_url)
    LOGGER.info(
        "splunk_adapter_resolve mode=%s resolved_mode=%s base_url=%s",
        mode,
        resolved_mode,
        base_url,
    )

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


def get_splunk_incident_service() -> SplunkIncidentService:
    settings = get_settings()
    runtime_mode = "local" if settings.model_provider.strip().lower() == "ollama" else "cloud"
    resolved_splunk_mode = _resolve_splunk_mode(
        settings.splunk_adapter_mode,
        settings.splunk_mcp_base_url,
    )
    return SplunkIncidentService(
        adapter=get_splunk_adapter(),
        splunk_web_base_url=settings.splunk_web_base_url.strip() or None,
        model_provider=settings.model_provider.strip().lower(),
        model_name=settings.model_name,
        runtime_mode=runtime_mode,
        splunk_mode=resolved_splunk_mode,
    )
