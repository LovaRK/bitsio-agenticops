"""Approval management endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from apps.api.app.config import load_incidents
from apps.api.app.dependencies import get_splunk_incident_service
from apps.api.app.services.splunk_live import SplunkIncidentService
from datetime import UTC, datetime
from packages.shared.auth import AuthContext, require_analyst

router = APIRouter(prefix="/api/v1", tags=["approvals"])


@router.get("/approvals/pending")
def list_pending_approvals(
    _ctx: AuthContext = Depends(require_analyst),
    splunk_service: SplunkIncidentService = Depends(get_splunk_incident_service),
) -> dict:
    """List pending approvals from incidents."""
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
