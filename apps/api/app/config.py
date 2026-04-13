"""Seed data and configuration helpers for the API."""

from __future__ import annotations

from apps.api.app.services.splunk_live import SplunkIncidentService
from packages.shared.config.settings import get_settings

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


def live_mode_enabled() -> bool:
    """Check if live Splunk mode is enabled."""
    return get_settings().splunk_live_mode


def load_incidents(splunk_service: SplunkIncidentService) -> list[dict]:
    """Load incidents from live Splunk or return seed data."""
    if live_mode_enabled():
        return splunk_service.list_incidents(limit=50)
    return SEED_INCIDENTS
