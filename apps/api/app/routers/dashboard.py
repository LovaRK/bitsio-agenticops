"""Dashboard endpoints."""

from __future__ import annotations

from datetime import UTC, datetime
from statistics import mean

from fastapi import APIRouter, Depends

from apps.api.app.config import live_mode_enabled, load_incidents
from apps.api.app.dependencies import get_splunk_incident_service
from apps.api.app.services.splunk_live import SplunkIncidentService
from packages.shared.auth import AuthContext, require_analyst

router = APIRouter(prefix="/api/v1", tags=["dashboard"])


@router.get("/dashboard/summary")
def dashboard_summary(
    _ctx: AuthContext = Depends(require_analyst),
    splunk_service: SplunkIncidentService = Depends(get_splunk_incident_service),
) -> dict:
    """Get dashboard summary with incident statistics."""
    incidents = load_incidents(splunk_service)
    live_mode = live_mode_enabled()
    data_source = "reported" if live_mode else "seed"
    degraded_reason = (
        "No matching live incidents found in current Splunk query window."
        if live_mode and not incidents
        else None
    )

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
            "data_source": data_source,
            "degraded_reason": degraded_reason,
        },
        "items": incidents,
    }
