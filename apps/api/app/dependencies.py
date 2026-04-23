from __future__ import annotations

import logging
from functools import lru_cache
from typing import Literal

from agent_core.graphs.incident_context_agent import IncidentContextAgentGraph
from agent_core.models.adapter import resolve_model_adapter
from agent_core.services.baseline_service import SplunkBaselineService, StubBaselineService
from agent_core.services.embedding_service import PgvectorEmbeddingService, StubEmbeddingService
from agent_core.services.metadata_service import PostgresMetadataService, StubMetadataService
from apps.api.app.services.contracts import IncidentServiceProtocol
from apps.api.app.services.splunk_live import SplunkIncidentService
from decision_tracing.store import InMemoryDecisionTraceStore
from packages.shared.config.settings import get_settings
from splunk_mcp.adapter import NativeSplunkAdapter, SplunkAdapter, SplunkMCPAdapter

try:
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session
except Exception:  # pragma: no cover
    create_engine = None  # type: ignore[assignment]
    Session = None  # type: ignore[assignment]

LOGGER = logging.getLogger(__name__)

SplunkWorkload = Literal["configured", "deterministic", "agentic"]


@lru_cache(maxsize=1)
def get_trace_store() -> InMemoryDecisionTraceStore:
    return InMemoryDecisionTraceStore()


def _resolve_splunk_mode(
    mode: str,
    base_url: str,
    *,
    workload: SplunkWorkload = "configured",
) -> str:
    normalized_mode = mode.strip().lower()
    if normalized_mode == "auto":
        if workload == "agentic" and "/services/mcp" in base_url:
            return "mcp"
        return "native"
    return normalized_mode


def resolve_splunk_mode_for_workload(*, workload: SplunkWorkload) -> str:
    """Resolve effective adapter mode from settings for a given workload class."""
    settings = get_settings()
    return _resolve_splunk_mode(
        settings.splunk_adapter_mode,
        settings.splunk_mcp_base_url,
        workload=workload,
    )


def _build_adapter_for_mode(resolved_mode: str) -> SplunkAdapter:
    settings = get_settings()
    base_url = settings.splunk_mcp_base_url
    token = settings.splunk_mcp_token or None
    role = settings.splunk_mcp_role
    verify_ssl = settings.splunk_mcp_ssl_verify
    auth_scheme = settings.splunk_auth_scheme

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


def get_splunk_adapter() -> SplunkAdapter:
    """Configured adapter selection honoring explicit settings mode."""
    settings = get_settings()
    mode = settings.splunk_adapter_mode.strip().lower()
    base_url = settings.splunk_mcp_base_url

    resolved_mode = _resolve_splunk_mode(mode, base_url, workload="configured")
    LOGGER.info(
        "splunk_adapter_resolve mode=%s workload=%s resolved_mode=%s base_url=%s",
        mode,
        "configured",
        resolved_mode,
        base_url,
    )

    return _build_adapter_for_mode(resolved_mode)


def get_splunk_adapter_native_default() -> SplunkAdapter:
    """Deterministic workloads default to native when SPLUNK_ADAPTER_MODE=auto."""
    settings = get_settings()
    mode = settings.splunk_adapter_mode.strip().lower()
    base_url = settings.splunk_mcp_base_url
    resolved_mode = _resolve_splunk_mode(mode, base_url, workload="deterministic")
    LOGGER.info(
        "splunk_adapter_resolve mode=%s workload=%s resolved_mode=%s base_url=%s",
        mode,
        "deterministic",
        resolved_mode,
        base_url,
    )

    return _build_adapter_for_mode(resolved_mode)


def get_splunk_adapter_agentic() -> SplunkAdapter:
    """Agentic workloads prefer MCP when available, fallback to native in auto mode."""
    settings = get_settings()
    mode = settings.splunk_adapter_mode.strip().lower()
    base_url = settings.splunk_mcp_base_url
    resolved_mode = _resolve_splunk_mode(mode, base_url, workload="agentic")
    LOGGER.info(
        "splunk_adapter_resolve mode=%s workload=%s resolved_mode=%s base_url=%s",
        mode,
        "agentic",
        resolved_mode,
        base_url,
    )

    return _build_adapter_for_mode(resolved_mode)


def get_splunk_incident_service() -> IncidentServiceProtocol:
    settings = get_settings()
    runtime_mode = "local" if settings.model_provider.strip().lower() == "ollama" else "cloud"
    resolved_splunk_mode = _resolve_splunk_mode(
        settings.splunk_adapter_mode,
        settings.splunk_mcp_base_url,
        workload="deterministic",
    )
    return SplunkIncidentService(
        adapter=get_splunk_adapter_native_default(),
        splunk_web_base_url=settings.splunk_web_base_url.strip() or None,
        model_provider=settings.model_provider.strip().lower(),
        model_name=settings.model_name,
        runtime_mode=runtime_mode,
        splunk_mode=resolved_splunk_mode,
    )


@lru_cache(maxsize=1)
def get_incident_context_graph() -> IncidentContextAgentGraph:
    settings = get_settings()
    model_adapter = resolve_model_adapter()
    splunk_adapter = get_splunk_adapter_agentic()

    metadata_service = StubMetadataService()
    embedding_service = StubEmbeddingService()

    if create_engine is not None and settings.database_url:
        try:
            engine = create_engine(settings.database_url)
            if Session is not None:
                session = Session(engine)
                metadata_service = PostgresMetadataService(session)
                embedding_service = PgvectorEmbeddingService(session)
        except Exception:
            metadata_service = StubMetadataService()
            embedding_service = StubEmbeddingService()

    baseline_service = (
        SplunkBaselineService(splunk_adapter) if settings.splunk_live_mode else StubBaselineService()
    )

    return IncidentContextAgentGraph(
        metadata_service=metadata_service,
        embedding_service=embedding_service,
        baseline_service=baseline_service,
        model_adapter=model_adapter,
    )
