from __future__ import annotations

import os
from datetime import UTC, datetime

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.responses import JSONResponse

from apps.api.app.dependencies import get_splunk_incident_service, get_trace_store
from apps.api.app.middleware.otel import instrument_fastapi
from apps.api.app.middleware.rate_limit import install_rate_limit_middleware
from apps.api.app.services.splunk_live import SplunkIncidentService
from apps.api.app.services.trace_service import TraceService
from decision_tracing.models import ApprovalRequest
from decision_tracing.store import InMemoryDecisionTraceStore
from packages.shared.auth import AuthContext, require_analyst, require_approver

app = FastAPI(title="BitsIO AgenticOps API", version="0.1.0")
instrument_fastapi(app)
install_rate_limit_middleware(
    app,
    rate_limit_per_minute=int(os.getenv("RATE_LIMIT_PER_MINUTE", "100")),
    redis_url=os.getenv("REDIS_URL", ""),
    default_tenant=os.getenv("TENANT_SAFE_ID", "tenant_demo"),
)

SEED_INCIDENTS = [
    {
        "id": "inc_20260408_42",
        "title": "Payments latency spike",
        "severity": "high",
        "timestamp": "2026-04-08T10:00:00Z",
        "source": "tutorial",
        "status": "triaging",
        "graph_version": "v1.0.0",
    },
    {
        "id": "inc_20260408_43",
        "title": "Checkout retry storm",
        "severity": "medium",
        "timestamp": "2026-04-08T10:08:00Z",
        "source": "tutorial",
        "status": "pending_approval",
        "graph_version": "v1.0.0",
    },
    {
        "id": "inc_20260408_44",
        "title": "Auth token expiration surge",
        "severity": "low",
        "timestamp": "2026-04-08T10:12:00Z",
        "source": "main",
        "status": "open",
        "graph_version": "v1.0.0",
    },
]


def _live_mode_enabled() -> bool:
    return os.getenv("SPLUNK_LIVE_MODE", "false").strip().lower() in {"1", "true", "yes", "on"}


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "time": datetime.now(tz=UTC).isoformat()}


@app.get("/api/v1/incidents")
def list_incidents(
    _ctx: AuthContext = Depends(require_analyst),
    splunk_service: SplunkIncidentService = Depends(get_splunk_incident_service),
) -> dict:
    if _live_mode_enabled():
        try:
            return {"items": splunk_service.list_incidents(limit=50)}
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Splunk MCP list_incidents failed: {exc}",
            ) from exc
    return {"items": SEED_INCIDENTS}


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

    if _live_mode_enabled():
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
