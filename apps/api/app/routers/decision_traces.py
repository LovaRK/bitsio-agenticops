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


def _derive_governance_fields(trace: dict) -> dict:
    """Attach data quality/governance/compliance/agent telemetry if missing."""
    node_runs = trace.get("node_runs") or []
    policy_checks = [check for node in node_runs for check in (node.get("policy_checks") or [])]
    matched_policy = next((check for check in policy_checks if check.get("matched")), None) or (
        policy_checks[0] if policy_checks else {}
    )

    timestamp_value = trace.get("timestamp")
    try:
        parsed = datetime.fromisoformat(str(timestamp_value).replace("Z", "+00:00"))
        freshness_seconds = max(0, int((datetime.now(tz=UTC) - parsed).total_seconds()))
    except Exception:  # noqa: BLE001
        freshness_seconds = 0

    evidence_refs = trace.get("evidence_refs") or []
    missing_evidence = trace.get("missing_evidence") or []
    evidence_total = len(evidence_refs) + len(missing_evidence)
    completeness_score = (
        max(0.5, min(0.99, len(evidence_refs) / evidence_total)) if evidence_total else 0.75
    )
    confidence = float(trace.get("confidence", 0.75) or 0.75)
    approval_required = bool(trace.get("approval_required"))
    severity = str(trace.get("severity", "medium")).lower()
    validation_passed = all(str(node.get("status", "success")).lower() != "fail" for node in node_runs)

    trace.setdefault(
        "data_quality",
        {
            "completeness_score": round(completeness_score, 2),
            "freshness_seconds": freshness_seconds,
            "accuracy_confidence": round(max(0.5, min(0.99, confidence)), 2),
            "validation_passed": validation_passed,
            "source": "derived",
        },
    )
    trace.setdefault(
        "policy_evaluation",
        {
            "policy_id": matched_policy.get("rule_id", "rbac_analyst"),
            "policy_version": trace.get("graph_version", "v1.0.0"),
            "guardrail_triggered": matched_policy.get(
                "action", "require_approval" if approval_required else "allow"
            ),
            "approval_reason": (
                "Human approval required due to policy gate for this risk profile."
                if approval_required
                else "No human gate required for current risk profile."
            ),
            "source": "derived",
        },
    )
    trace.setdefault(
        "data_classification",
        {
            "classification": "restricted" if severity in {"high", "critical"} else "internal",
            "compliance_frameworks": ["PCI-DSS", "SOX"]
            if severity in {"high", "critical"}
            else ["SOC2"],
            "encryption_required": "in-transit+at-rest"
            if severity in {"high", "critical"}
            else "in-transit",
            "source": "derived",
        },
    )
    trace.setdefault(
        "agent_telemetry",
        {
            "agent_id": str(trace.get("assigned_agent", "observer-prime")).lower().replace(" ", "-"),
            "agent_version": trace.get("graph_version", "v1.0.0"),
            "agent_capabilities": "propose-only" if approval_required else "propose+auto-remediate",
            "action_confidence": round(max(0.5, min(0.99, confidence * (0.96 if approval_required else 1.02))), 2),
            "human_in_the_loop": approval_required,
            "source": "derived",
        },
    )
    return trace


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
        "data_quality": {
            "completeness_score": 0.71,
            "freshness_seconds": 0,
            "accuracy_confidence": 0.72,
            "validation_passed": True,
            "source": "derived",
        },
        "policy_evaluation": {
            "policy_id": "rbac_analyst",
            "policy_version": str(seed.get("graph_version", "v1.0.0")),
            "guardrail_triggered": "require_approval" if approval_required else "allow",
            "approval_reason": (
                "Fallback trace indicates human review is required for this severity."
                if approval_required
                else "Fallback trace indicates no additional approval requirement."
            ),
            "source": "derived",
        },
        "data_classification": {
            "classification": "restricted" if severity in {"high", "critical"} else "internal",
            "compliance_frameworks": ["PCI-DSS", "SOX"]
            if severity in {"high", "critical"}
            else ["SOC2"],
            "encryption_required": "in-transit+at-rest"
            if severity in {"high", "critical"}
            else "in-transit",
            "source": "derived",
        },
        "agent_telemetry": {
            "agent_id": "observer-prime",
            "agent_version": str(seed.get("graph_version", "v1.0.0")),
            "agent_capabilities": "propose-only" if approval_required else "propose+auto-remediate",
            "action_confidence": 0.72,
            "human_in_the_loop": approval_required,
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
        return _derive_governance_fields(trace.model_dump(mode="json"))

    # Try live mode
    if live_mode_enabled():
        try:
            return _derive_governance_fields(splunk_service.get_decision_trace(workflow_id))
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
