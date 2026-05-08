from __future__ import annotations

import re
from typing import Any

from pydantic import BaseModel, Field, field_validator

_WORKFLOW_RE = re.compile(r"^wf_\d{8}_[A-Za-z0-9_-]+$")


class IncidentContextAgentState(BaseModel):
    workflow_id: str
    incident_id: str
    tenant_safe_id: str
    raw_incident: dict[str, Any]

    customer_id: str | None = None
    service_name: str | None = None
    asset_context: dict[str, Any] | None = None
    service_context: dict[str, Any] | None = None
    customer_context: dict[str, Any] | None = None

    similar_incidents: list[dict[str, Any]] = Field(default_factory=list)
    correlation_score: float = 0.0
    baseline_metrics: dict[str, Any] | None = None
    anomaly_score: float = 0.0
    deviation_description: str = ""
    enriched_incident: dict[str, Any] | None = None

    confidence: float = 0.0
    errors: list[str] = Field(default_factory=list)

    @field_validator("workflow_id")
    @classmethod
    def validate_workflow_id(cls, value: str) -> str:
        if not _WORKFLOW_RE.match(value):
            raise ValueError("workflow_id must match wf_YYYYMMDD_NNN")
        return value

    @field_validator("tenant_safe_id")
    @classmethod
    def validate_tenant_safe_id(cls, value: str) -> str:
        lowered = value.lower()
        if "@" in value:
            raise ValueError("tenant_safe_id must not contain email-like identifiers")
        for banned in (" ram ", " rama ", " krishna ", " teja "):
            if banned.strip() in lowered:
                raise ValueError("tenant_safe_id appears to contain a personal identifier")
        return value

    def with_updates(self, **kwargs: Any) -> IncidentContextAgentState:
        return self.model_copy(update=kwargs, deep=True)

    @classmethod
    def from_raw_incident(
        cls,
        workflow_id: str,
        incident_dict: dict[str, Any],
    ) -> IncidentContextAgentState:
        return cls(
            workflow_id=workflow_id,
            incident_id=str(incident_dict.get("incident_id", "unknown_incident")),
            tenant_safe_id=str(incident_dict.get("tenant_safe_id", "tenant_demo")),
            raw_incident=incident_dict,
        )
