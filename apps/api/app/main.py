from __future__ import annotations

from collections import Counter
from datetime import UTC, datetime
from statistics import mean

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from agent_core.models.adapter import resolve_model_adapter
from apps.api.app.config import load_incidents, live_mode_enabled
from apps.api.app.dependencies import (
    get_splunk_adapter,
    get_splunk_incident_service,
    get_trace_store,
)
from apps.api.app.middleware.otel import instrument_fastapi
from apps.api.app.middleware.rate_limit import install_rate_limit_middleware
from apps.api.app.services.splunk_live import SplunkIncidentService
from apps.api.app.services.trace_service import TraceService
from decision_tracing.models import ApprovalRequest
from decision_tracing.store import InMemoryDecisionTraceStore
from packages.shared.auth import AuthContext, require_analyst, require_approver
from packages.shared.config.settings import get_settings

app = FastAPI(title="BitsIO AgenticOps API", version="0.1.0")
settings = get_settings()
_web_base = settings.web_base_url.rstrip("/")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        _web_base,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
instrument_fastapi(app)
install_rate_limit_middleware(
    app,
    rate_limit_per_minute=settings.rate_limit_per_minute,
    redis_url=settings.redis_url,
    default_tenant=settings.tenant_safe_id,
)



class RuntimeConfigPayload(BaseModel):
    model_provider: str = Field(default="ollama")
    model_name: str = Field(default="qwen2.5:14b")
    splunk_adapter_mode: str = Field(default="auto")
    model_mock_mode: bool = Field(default=False)
    splunk_live_mode: bool = Field(default=False)


class RuntimeConfigResponse(BaseModel):
    updated: bool
    model_provider: str
    model_name: str
    splunk_adapter_mode: str
    model_mock_mode: bool
    splunk_live_mode: bool


class RuntimeConnectivityResponse(BaseModel):
    model: dict[str, str | bool]
    splunk: dict[str, str | bool]


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "time": datetime.now(tz=UTC).isoformat()}


@app.get("/api/v1/incidents")
def list_incidents(
    _ctx: AuthContext = Depends(require_analyst),
    splunk_service: SplunkIncidentService = Depends(get_splunk_incident_service),
) -> dict:
    try:
        return {"items": load_incidents(splunk_service)}
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Splunk list_incidents failed: {exc}",
        ) from exc


@app.post("/api/v1/decision-traces")
def create_decision_trace(
    payload: dict,
    force_merge: bool = Query(default=False),
    _ctx: AuthContext = Depends(require_analyst),
    store: InMemoryDecisionTraceStore = Depends(get_trace_store),
) -> JSONResponse:
    service = TraceService(store)

    try:
        trace, created = service.create_or_merge_trace(payload, force_merge=force_merge)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc

    code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
    return JSONResponse(
        status_code=code,
        content={"workflow_id": trace.workflow_id, "id": trace.workflow_id},
    )


@app.get("/api/v1/decision-traces/{workflow_id}")
def get_decision_trace(
    workflow_id: str,
    _ctx: AuthContext = Depends(require_analyst),
    store: InMemoryDecisionTraceStore = Depends(get_trace_store),
    splunk_service: SplunkIncidentService = Depends(get_splunk_incident_service),
) -> dict:
    trace = store.get(workflow_id)
    if trace is not None:
        return trace.model_dump(mode="json")

    if live_mode_enabled():
        try:
            return splunk_service.get_decision_trace(workflow_id)
        except LookupError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Splunk MCP decision trace fetch failed: {exc}",
            ) from exc

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="decision trace not found")


@app.post("/api/v1/decision-traces/{workflow_id}/approvals")
def create_approval_event(
    workflow_id: str,
    payload: ApprovalRequest,
    ctx: AuthContext = Depends(require_approver),
    store: InMemoryDecisionTraceStore = Depends(get_trace_store),
) -> dict:
    service = TraceService(store)

    try:
        event = service.add_approval(workflow_id, payload, actor_from_auth=ctx.user_id)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc

    return event.model_dump(mode="json")


@app.get("/api/v1/decision-traces/{workflow_id}/approvals")
def list_approval_events(
    workflow_id: str,
    _ctx: AuthContext = Depends(require_analyst),
    store: InMemoryDecisionTraceStore = Depends(get_trace_store),
) -> dict:
    service = TraceService(store)
    return {
        "items": [event.model_dump(mode="json") for event in service.list_approvals(workflow_id)]
    }


@app.get("/api/v1/dashboard/summary")
def dashboard_summary(
    _ctx: AuthContext = Depends(require_analyst),
    splunk_service: SplunkIncidentService = Depends(get_splunk_incident_service),
) -> dict:
    incidents = load_incidents(splunk_service)
    pending = [item for item in incidents if item.get("status") == "pending_approval"]
    confidence_seed = [
        (
            0.91
            if item.get("severity") == "high"
            else 0.79 if item.get("severity") == "medium" else 0.67
        )
        for item in incidents
    ]
    source_indexes = sorted({str(item.get("source", "tutorial")) for item in incidents})
    return {
        "stats": {
            "active_incidents": len(incidents),
            "pending_approvals": len(pending),
            "avg_confidence": round(mean(confidence_seed), 2) if confidence_seed else 0.0,
            "source_indexes": source_indexes,
            "last_updated": datetime.now(tz=UTC).isoformat(),
        },
        "items": incidents,
    }


@app.get("/api/v1/approvals/pending")
def list_pending_approvals(
    _ctx: AuthContext = Depends(require_analyst),
    splunk_service: SplunkIncidentService = Depends(get_splunk_incident_service),
) -> dict:
    incidents = load_incidents(splunk_service)
    pending: list[dict] = []
    for incident in incidents:
        if incident.get("status") != "pending_approval":
            continue
        incident_id = str(incident.get("id", "unknown"))
        pending.append(
            {
                "workflow_id": (
                    f"wf_{incident_id}" if not incident_id.startswith("wf_") else incident_id
                ),
                "incident_id": incident_id,
                "title": incident.get("title", f"Incident {incident_id}"),
                "severity": incident.get("severity", "medium"),
                "confidence": 0.9 if incident.get("severity") == "high" else 0.78,
                "recommendation": (
                    "Approve remediation playbook after verifying query impact and service rollback path."
                ),
                "time_queued": incident.get("timestamp", datetime.now(tz=UTC).isoformat()),
            }
        )
    return {"items": pending}


@app.get("/api/v1/monitoring/overview")
def monitoring_overview(
    _ctx: AuthContext = Depends(require_analyst),
    splunk_service: SplunkIncidentService = Depends(get_splunk_incident_service),
) -> dict:
    incidents = load_incidents(splunk_service)
    try:
        server = splunk_service.adapter.get_server_info().model_dump()
    except Exception:  # noqa: BLE001
        server = {"version": "unknown", "build": "unknown", "mode": "unknown"}

    try:
        indexes = [item.model_dump() for item in splunk_service.adapter.list_indexes()]
    except Exception:  # noqa: BLE001
        indexes = []

    severity_counter = Counter(item.get("severity", "medium") for item in incidents)
    load_guess = min(95, max(8, (len(incidents) * 7)))
    high_ratio = severity_counter.get("high", 0) / max(1, len(incidents))

    services = [
        {
            "name": "FastAPI Control Plane",
            "status": "Healthy",
            "uptime": "99.95%",
            "latency_ms": 24,
            "load_percent": max(5, load_guess // 3),
        },
        {
            "name": "Splunk Search Adapter",
            "status": "Degraded" if high_ratio >= 0.5 else "Healthy",
            "uptime": "99.80%",
            "latency_ms": 130 if high_ratio >= 0.5 else 68,
            "load_percent": min(97, load_guess + 20),
        },
        {
            "name": "Reasoning Worker",
            "status": "Healthy",
            "uptime": "99.99%",
            "latency_ms": 310,
            "load_percent": max(10, load_guess // 2),
        },
    ]
    return {
        "kpis": {
            "global_uptime": "99.91%",
            "active_nodes": max(3, len(indexes)),
            "avg_latency_ms": round(mean(item["latency_ms"] for item in services), 1),
            "system_load_percent": round(mean(item["load_percent"] for item in services), 1),
        },
        "services": services,
        "indexes": indexes,
        "server_info": server,
    }


@app.get("/api/v1/settings")
def get_settings_snapshot(
    _ctx: AuthContext = Depends(require_analyst),
    splunk_service: SplunkIncidentService = Depends(get_splunk_incident_service),
) -> dict:
    cfg = get_settings()
    try:
        index_count = len(splunk_service.adapter.list_indexes())
        splunk_connected = True
    except Exception:  # noqa: BLE001
        index_count = 0
        splunk_connected = False

    return {
        "platform_name": "BitsIO AgenticOps",
        "environment": cfg.environment,
        "timezone": cfg.app_timezone,
        "splunk": {
            "adapter_mode": cfg.splunk_adapter_mode,
            "live_mode": live_mode_enabled(),
            "base_url": cfg.splunk_mcp_base_url,
            "web_base_url": cfg.splunk_web_base_url,
            "connected": splunk_connected,
            "index_count": index_count,
        },
        "model": {
            "provider": cfg.model_provider,
            "name": cfg.model_name,
            "runtime": "local" if cfg.model_provider.strip().lower() == "ollama" else "cloud",
            "base_url": cfg.ollama_base_url,
            "mock_mode": cfg.model_mock_mode,
        },
        "security": {
            "rbac_enabled": True,
            "rate_limit_per_minute": cfg.rate_limit_per_minute,
            "oidc_boundary": True,
        },
    }


@app.put("/api/v1/settings/runtime", response_model=RuntimeConfigResponse)
def update_runtime_settings(
    payload: RuntimeConfigPayload,
    _ctx: AuthContext = Depends(require_analyst),
) -> RuntimeConfigResponse:
    model_provider = payload.model_provider.strip().lower()
    if model_provider not in {"ollama", "anthropic", "stub"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="model_provider must be one of: ollama, anthropic, stub",
        )

    adapter_mode = payload.splunk_adapter_mode.strip().lower()
    if adapter_mode not in {"mcp", "native", "auto"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="splunk_adapter_mode must be one of: mcp, native, auto",
        )

    model_name = payload.model_name.strip()
    if not model_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="model_name is required"
        )

    # Update environment variables for runtime reconfiguration
    import os
    os.environ["MODEL_PROVIDER"] = model_provider
    os.environ["MODEL_NAME"] = model_name
    os.environ["MODEL_MOCK_MODE"] = "true" if payload.model_mock_mode else "false"
    os.environ["SPLUNK_ADAPTER_MODE"] = adapter_mode
    os.environ["SPLUNK_LIVE_MODE"] = "true" if payload.splunk_live_mode else "false"

    # Clear cached dependency singletons so API uses new settings immediately
    get_settings.cache_clear()
    get_splunk_adapter.cache_clear()
    get_splunk_incident_service.cache_clear()

    return RuntimeConfigResponse(
        updated=True,
        model_provider=model_provider,
        model_name=model_name,
        splunk_adapter_mode=adapter_mode,
        model_mock_mode=payload.model_mock_mode,
        splunk_live_mode=payload.splunk_live_mode,
    )


@app.get("/api/v1/settings/runtime/check", response_model=RuntimeConnectivityResponse)
def check_runtime_connections(
    _ctx: AuthContext = Depends(require_analyst),
    splunk_service: SplunkIncidentService = Depends(get_splunk_incident_service),
) -> RuntimeConnectivityResponse:
    cfg = get_settings()
    model_connected = False
    model_detail = "unavailable"

    provider = cfg.model_provider.strip().lower()
    if provider == "anthropic" and not cfg.anthropic_api_key.strip():
        model_connected = False
        model_detail = "missing ANTHROPIC_API_KEY"
    else:
        try:
            sample = resolve_model_adapter().generate(
                "Health check: respond with OK.", temperature=0.0
            )
            model_connected = not sample.startswith("[fallback]")
            model_detail = sample[:120]
        except Exception as exc:  # noqa: BLE001
            model_connected = False
            model_detail = f"{type(exc).__name__}: {exc}"

    try:
        index_count = len(splunk_service.adapter.list_indexes())
        splunk_connected = True
        splunk_detail = f"{index_count} indexes visible"
    except Exception as exc:  # noqa: BLE001
        splunk_connected = False
        splunk_detail = f"{type(exc).__name__}: {exc}"

    return RuntimeConnectivityResponse(
        model={"connected": model_connected, "detail": model_detail},
        splunk={"connected": splunk_connected, "detail": splunk_detail},
    )


@app.get("/api/v1/support/resources")
def support_resources(
    _ctx: AuthContext = Depends(require_analyst),
) -> dict:
    return {
        "categories": [
            {
                "title": "Runbooks",
                "icon": "rocket_launch",
                "links": [
                    {"label": "Live Monitoring View", "href": "/monitoring"},
                    {"label": "Approval Workflow", "href": "/approvals"},
                    {"label": "Incident Explorer", "href": "/incidents"},
                ],
            },
            {
                "title": "System Design",
                "icon": "menu_book",
                "links": [
                    {"label": "Dashboard Overview", "href": "/"},
                    {"label": "Settings Snapshot", "href": "/settings"},
                    {"label": "Service Health Matrix", "href": "/monitoring"},
                ],
            },
            {
                "title": "Security & Ops",
                "icon": "shield",
                "links": [
                    {"label": "Rate Limit + RBAC Status", "href": "/settings"},
                    {"label": "Decision Traces", "href": "/incidents"},
                ],
            },
        ],
        "contact": {
            "email": "support@bitsio.example",
            "chat": "Slack #bitsio-agenticops",
        },
    }
