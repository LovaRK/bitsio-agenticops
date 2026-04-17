from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class EnrichedIncidentResponse(BaseModel):
    workflow_id: str
    incident_id: str
    confidence: float
    errors: list[str] = Field(default_factory=list)
    enriched_incident: dict[str, Any]
    cached: bool = False
