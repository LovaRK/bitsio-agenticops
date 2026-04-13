"""Decision trace management endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse

from apps.api.app.config import live_mode_enabled
from apps.api.app.dependencies import get_splunk_incident_service, get_trace_store
from apps.api.app.services.splunk_live import SplunkIncidentService
from apps.api.app.services.trace_service import TraceService
from decision_tracing.models import ApprovalRequest
from decision_tracing.store import InMemoryDecisionTraceStore
from packages.shared.auth import AuthContext, require_analyst, require_approver

router = APIRouter(prefix="/api/v1", tags=["decision-traces"])


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
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Splunk MCP decision trace fetch failed: {exc}",
            ) from exc

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
