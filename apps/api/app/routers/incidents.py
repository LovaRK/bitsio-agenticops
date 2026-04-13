"""Incidents list endpoint."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from apps.api.app.config import load_incidents
from apps.api.app.dependencies import get_splunk_incident_service
from apps.api.app.services.splunk_live import SplunkIncidentService
from packages.shared.auth import AuthContext, require_analyst

router = APIRouter(prefix="/api/v1", tags=["incidents"])


@router.get("/incidents")
def list_incidents(
    _ctx: AuthContext = Depends(require_analyst),
    splunk_service: SplunkIncidentService = Depends(get_splunk_incident_service),
) -> dict:
    """List incidents from live Splunk or return seed data."""
    try:
        return {"items": load_incidents(splunk_service)}
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Splunk list_incidents failed: {exc}",
        ) from exc
