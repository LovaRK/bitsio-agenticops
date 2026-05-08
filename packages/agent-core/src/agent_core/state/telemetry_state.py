from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class EvidenceItem(BaseModel):
    source: str
    reference: str
    content: dict[str, Any]


class TelemetryFinalOutput(BaseModel):
    summary: str
    probable_cause: str
    evidence_refs: list[str] = Field(default_factory=list)
    missing_evidence: list[str] = Field(default_factory=list)
    next_best_action: str
    confidence: float
    guardrail_notes: list[str] = Field(default_factory=list)
    approval_required: bool


class TelemetryAgentState(BaseModel):
    workflow_id: str
    incident_id: str = ""
    raw_incident: dict[str, Any] = Field(default_factory=dict)
    evidence: list[EvidenceItem] = Field(default_factory=list)
    missing_evidence: list[str] = Field(default_factory=list)
    reasoning_draft: str = ""
    correlation_findings: list[str] = Field(default_factory=list)
    confidence: float = 0.0
    guardrail_notes: list[str] = Field(default_factory=list)
    policy_checks: list[dict[str, Any]] = Field(default_factory=list)
    recommended_action: str = ""
    approval_required: bool = False
    final_output: TelemetryFinalOutput | None = None
