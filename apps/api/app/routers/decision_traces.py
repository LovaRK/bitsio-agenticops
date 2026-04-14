"""Decision trace management endpoints."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse

from apps.api.app.config import SEED_INCIDENTS, live_mode_enabled
from apps.api.app.dependencies import get_splunk_incident_service, get_trace_store
from apps.api.app.services.splunk_live import SplunkIncidentService
from apps.api.app.services.trace_service import TraceService
from decision_tracing.models import ApprovalRequest
from decision_tracing.store import InMemoryDecisionTraceStore
from packages.shared.auth import AuthContext, require_analyst, require_approver

router = APIRouter(prefix="/api/v1", tags=["decision-traces"])


def _build_fallback_trace(
    workflow_id: str,
    splunk_service: SplunkIncidentService,
    reason: str | None = None,
) -> dict:
    incident_id = workflow_id.removeprefix("wf_")
    seed = next((item for item in SEED_INCIDENTS if item["id"] == incident_id), SEED_INCIDENTS[0])
    incident_id = str(seed["id"]) if seed else incident_id
    workflow = workflow_id if workflow_id.startswith("wf_") else f"wf_{incident_id}"
    severity = str(seed.get("severity", "medium")) if seed else "medium"
    approval_required = severity in {"high", "medium"}

    reason_suffix = f" Reason: {reason}" if reason else ""
    return {
        "workflow_id": workflow,
        "incident_id": incident_id,
        "title": str(seed.get("title", f"Incident {incident_id}")),
        "severity": severity,
        "timestamp": str(seed.get("timestamp", datetime.now(tz=UTC).isoformat())),
        "source_index": str(seed.get("source", "tutorial")),
        "status": str(seed.get("status", "triaging")),
        "graph_version": str(seed.get("graph_version", "v1.0.0")),
        "assigned_agent": "Observer-Prime",
        "summary": (
            "Live Splunk decision trace is unavailable; showing local fallback trace so the incident page remains usable."
            f"{reason_suffix}"
        ),
        "probable_cause": "Live evidence is unavailable. Verify Splunk connectivity or tunnel and refresh.",
        "confidence": 0.72,
        "approval_required": approval_required,
        "evidence_refs": [],
        "missing_evidence": ["live_decision_trace_unavailable"],
        "node_runs": [],
        "run_metadata": {
            "model_provider": splunk_service.model_provider,
            "model_name": splunk_service.model_name,
            "runtime_mode": splunk_service.runtime_mode,
            "splunk_mode": splunk_service.splunk_mode,
            "run_time_ms": 0,
            "source": "derived",
        },
    }


@router.post("/decision-traces")
def create_decision_trace(
    payload: dict,
    force_merge: bool = Query(default=False),
    _ctx: AuthContext = Depends(require_analyst),
    store: InMemoryDecisionTraceStore = Depends(get_trace_store),
) -> JSONResponse:
    """Create or merge a decision trace."""
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


@router.get("/decision-traces/{workflow_id}")
def get_decision_trace(
    workflow_id: str,
    _ctx: AuthContext = Depends(require_analyst),
    store: InMemoryDecisionTraceStore = Depends(get_trace_store),
    splunk_service: SplunkIncidentService = Depends(get_splunk_incident_service),
) -> dict:
    """Get a decision trace by workflow ID."""
    trace = store.get(workflow_id)
    if trace is not None:
        return trace.model_dump(mode="json")

    # Try live mode
    if live_mode_enabled():
        try:
            return splunk_service.get_decision_trace(workflow_id)
        except LookupError as exc:
            return _build_fallback_trace(workflow_id, splunk_service, reason=str(exc))
        except Exception as exc:  # noqa: BLE001
            return _build_fallback_trace(workflow_id, splunk_service, reason=str(exc))

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="decision trace not found")


@router.post("/decision-traces/{workflow_id}/approvals")
def create_approval_event(
    workflow_id: str,
    payload: ApprovalRequest,
    ctx: AuthContext = Depends(require_approver),
    store: InMemoryDecisionTraceStore = Depends(get_trace_store),
) -> dict:
    """Create an approval event for a decision trace."""
    service = TraceService(store)

    try:
        event = service.add_approval(workflow_id, payload, actor_from_auth=ctx.user_id)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc

    return event.model_dump(mode="json")


@router.get("/decision-traces/{workflow_id}/approvals")
def list_approval_events(
    workflow_id: str,
    _ctx: AuthContext = Depends(require_analyst),
    store: InMemoryDecisionTraceStore = Depends(get_trace_store),
) -> dict:
    """List approval events for a decision trace."""
    service = TraceService(store)
    return {
        "items": [event.model_dump(mode="json") for event in service.list_approvals(workflow_id)]
    }
