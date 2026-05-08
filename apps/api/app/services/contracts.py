"""Service contracts for protocol-oriented dependency boundaries."""

from __future__ import annotations

from typing import Any, Protocol

from splunk_mcp.adapter import SplunkAdapter


class IncidentServiceProtocol(Protocol):
    adapter: SplunkAdapter
    model_provider: str
    model_name: str
    runtime_mode: str
    splunk_mode: str

    def list_incidents(self, *, limit: int = 25) -> list[dict[str, Any]]:
        ...

    def get_decision_trace(self, incident_ref: str) -> dict[str, Any]:
        ...
