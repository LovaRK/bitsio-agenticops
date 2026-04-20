from __future__ import annotations

from apps.api.app.config import SEED_INCIDENTS, load_incidents
from packages.shared.config.settings import get_settings


class _ServiceReturnsEmpty:
    def list_incidents(self, *, limit: int = 50):
        _ = limit
        return []


class _ServiceReturnsLive:
    def list_incidents(self, *, limit: int = 50):
        _ = limit
        return [
            {
                "id": "inc_live_1",
                "title": "Live Incident",
                "severity": "high",
                "timestamp": "2026-04-19T12:00:00Z",
                "source": "tutorial",
                "status": "triaging",
            }
        ]


def test_load_incidents_falls_back_when_live_empty(monkeypatch) -> None:
    monkeypatch.setenv("SPLUNK_LIVE_MODE", "true")
    get_settings.cache_clear()
    incidents = load_incidents(_ServiceReturnsEmpty())
    assert incidents == SEED_INCIDENTS
    get_settings.cache_clear()


def test_load_incidents_uses_live_when_available(monkeypatch) -> None:
    monkeypatch.setenv("SPLUNK_LIVE_MODE", "true")
    get_settings.cache_clear()
    incidents = load_incidents(_ServiceReturnsLive())
    assert len(incidents) == 1
    assert incidents[0]["id"] == "inc_live_1"
    get_settings.cache_clear()
