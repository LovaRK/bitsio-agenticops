"""System monitoring endpoints."""

from __future__ import annotations

from collections import Counter
from datetime import UTC, datetime
from statistics import mean
from time import perf_counter

from fastapi import APIRouter, Depends

from apps.api.app.config import load_incidents
from apps.api.app.dependencies import get_splunk_incident_service
from apps.api.app.services.contracts import IncidentServiceProtocol
from apps.api.app.services.runtime_profiles import runtime_label_for_provider
from packages.shared.auth import AuthContext, require_analyst
from packages.shared.config.settings import get_settings

router = APIRouter(prefix="/api/v1", tags=["monitoring"])


@router.get("/monitoring/overview")
def monitoring_overview(
    _ctx: AuthContext = Depends(require_analyst),
    splunk_service: IncidentServiceProtocol = Depends(get_splunk_incident_service),
) -> dict:
    """Get monitoring overview with service health and index info."""
    settings = get_settings()
    t_inc_start = perf_counter()
    try:
        incidents = load_incidents(splunk_service)
        incident_ms = max(1, int((perf_counter() - t_inc_start) * 1000))
    except Exception:  # noqa: BLE001
        incidents = []
        incident_ms = 999

    try:
        t_server = perf_counter()
        server = splunk_service.adapter.get_server_info().model_dump()
        _ = max(1, int((perf_counter() - t_server) * 1000))
    except Exception:  # noqa: BLE001
        server = {"version": "unknown", "build": "unknown", "mode": "unknown"}
    index_ms = 0
    indexes = []
    splunk_connected = False
    sample_search_ms = 0

    try:
        t_indexes = perf_counter()
        indexes = [item.model_dump() for item in splunk_service.adapter.list_indexes()]
        index_ms = max(1, int((perf_counter() - t_indexes) * 1000))
        splunk_connected = True
    except Exception:  # noqa: BLE001
        indexes = []
        index_ms = 999

    try:
        t_search = perf_counter()
        splunk_service.adapter.run_search(
            "search index=tutorial | head 1", earliest="-24h", latest="now"
        )
        sample_search_ms = max(1, int((perf_counter() - t_search) * 1000))
    except Exception:  # noqa: BLE001
        sample_search_ms = 999

    severity_counter = Counter(item.get("severity", "medium") for item in incidents)
    load_guess = min(95, max(8, (len(incidents) * 7) + len(indexes)))
    high_ratio = severity_counter.get("high", 0) / max(1, len(incidents))

    control_plane_status = "Healthy" if incident_ms < 500 else "Degraded"
    adapter_status = "Healthy" if splunk_connected and index_ms < 1200 else "Degraded"
    worker_status = "Healthy" if sample_search_ms < 1500 else "Degraded"

    services = [
        {
            "name": "FastAPI Control Plane",
            "status": control_plane_status,
            "uptime": f"{max(90.0, 100 - incident_ms / 40):.2f}%",
            "latency_ms": incident_ms,
            "load_percent": min(99, max(5, load_guess // 3)),
        },
        {
            "name": "Splunk Search Adapter",
            "status": "Degraded" if high_ratio >= 0.5 else adapter_status,
            "uptime": f"{max(85.0, 100 - index_ms / 30):.2f}%",
            "latency_ms": index_ms,
            "load_percent": min(97, max(10, load_guess + (index_ms // 80))),
        },
        {
            "name": "Reasoning Worker",
            "status": worker_status,
            "uptime": f"{max(88.0, 100 - sample_search_ms / 35):.2f}%",
            "latency_ms": sample_search_ms,
            "load_percent": min(99, max(10, load_guess // 2 + (sample_search_ms // 100))),
        },
    ]

    runtime_mode = runtime_label_for_provider(settings.model_provider)
    llm_calls = max(0, len(incidents))
    retrieval_calls = max(1, len(incidents))
    policy_calls = sum(
        1 for item in incidents if str(item.get("severity", "low")).lower() in {"high", "medium"}
    )
    avg_llm_latency_ms = max(80, int((incident_ms + sample_search_ms) / 2))
    avg_retrieval_latency_ms = max(50, index_ms)
    avg_policy_latency_ms = max(10, int(avg_llm_latency_ms * 0.2))

    token_source = "derived" if llm_calls > 0 else "not_applicable"
    prompt_tokens = llm_calls * 420 if llm_calls > 0 else 0
    completion_tokens = llm_calls * 185 if llm_calls > 0 else 0
    total_tokens = prompt_tokens + completion_tokens
    if settings.model_mock_mode or settings.model_provider.strip().lower() == "stub":
        token_source = "not_applicable"
        prompt_tokens = 0
        completion_tokens = 0
        total_tokens = 0

    est_cost_usd = 0.0
    cost_source = "not_applicable"
    if token_source != "not_applicable":
        # Approximate runtime cost for demo observability, not billing-grade accounting.
        blended_rate_per_million = (
            2.5 if settings.model_provider.strip().lower() == "anthropic" else 0.8
        )
        est_cost_usd = round((total_tokens / 1_000_000) * blended_rate_per_million, 4)
        cost_source = "derived"

    freshness = datetime.now(tz=UTC).isoformat()
    return {
        "kpis": {
            "global_uptime": f"{mean(float(item['uptime'].rstrip('%')) for item in services):.2f}%",
            "active_nodes": max(3, len(indexes)),
            "avg_latency_ms": round(mean(item["latency_ms"] for item in services), 1),
            "system_load_percent": round(mean(item["load_percent"] for item in services), 1),
        },
        "kpi_explanations": [
            {
                "label": "Global Uptime",
                "formula": "Mean service uptime across control plane, adapter, and worker",
                "source": "derived",
                "freshness": freshness,
            },
            {
                "label": "Active Nodes",
                "formula": "Visible Splunk indexes count (minimum floor = 3)",
                "source": "reported" if splunk_connected else "derived",
                "freshness": freshness,
            },
            {
                "label": "Avg Latency",
                "formula": "Mean latency across core services in current check window",
                "source": "derived",
                "freshness": freshness,
            },
            {
                "label": "System Load",
                "formula": "Mean synthetic load score across core services",
                "source": "derived",
                "freshness": freshness,
            },
        ],
        "agent_runtime": {
            "window_minutes": 15,
            "model_provider": settings.model_provider,
            "model_name": settings.model_name,
            "runtime_mode": runtime_mode,
            "splunk_mode": settings.splunk_adapter_mode,
            "llm_calls": llm_calls,
            "retrieval_calls": retrieval_calls,
            "policy_calls": policy_calls,
            "avg_llm_latency_ms": avg_llm_latency_ms,
            "avg_retrieval_latency_ms": avg_retrieval_latency_ms,
            "avg_policy_latency_ms": avg_policy_latency_ms,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": total_tokens,
            "estimated_cost_usd": est_cost_usd,
            "token_source": token_source,
            "cost_source": cost_source,
            "freshness": freshness,
        },
        "services": services,
        "indexes": indexes,
        "server_info": server,
    }
