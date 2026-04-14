"""
State model for the Telemetry Waste Detection Agent.

This agent analyzes Splunk index usage patterns — ingest volume vs. search
activity, field utilization, and retention — to identify wasted data and
quantify cost savings.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class SourceTypeProfile(BaseModel):
    """Usage profile for a single Splunk source type or data feed."""

    source_type: str
    index: str
    daily_ingest_gb: float = 0.0
    search_count_90d: int = 0
    dashboard_references: int = 0
    alert_references: int = 0
    unused_fields: list[str] = Field(default_factory=list)
    used_fields: list[str] = Field(default_factory=list)
    retention_days: int = 90
    estimated_monthly_cost_usd: float = 0.0


class WasteRecommendation(BaseModel):
    """A concrete cost-reduction recommendation."""

    source_type: str
    action: str  # reduce_retention | filter_fields | route_to_cold_storage | delete
    current_retention_days: int
    recommended_retention_days: int
    field_savings_pct: float = 0.0  # 0.0–1.0
    estimated_daily_gb_saved: float = 0.0
    estimated_annual_savings_usd: float = 0.0
    rationale: str


class TelemetryWasteFinalOutput(BaseModel):
    """Final output of the waste detection agent."""

    summary: str
    total_wasteful_sources: int
    total_daily_ingest_gb: float
    total_daily_wasted_gb: float
    estimated_annual_savings_usd: float
    waste_pct: float  # 0.0–1.0
    top_offenders: list[SourceTypeProfile]
    recommendations: list[WasteRecommendation]
    confidence: float
    approval_required: bool
    guardrail_notes: list[str] = Field(default_factory=list)


class TelemetryWasteAgentState(BaseModel):
    """State flowing through the 7-node waste detection graph."""

    workflow_id: str
    tenant_id: str = "tenant_demo"

    # Raw input
    raw_index_profiles: list[dict[str, Any]] = Field(default_factory=list)
    raw_search_activity: list[dict[str, Any]] = Field(default_factory=list)
    raw_field_stats: list[dict[str, Any]] = Field(default_factory=list)

    # Derived
    source_profiles: list[SourceTypeProfile] = Field(default_factory=list)
    wasteful_sources: list[SourceTypeProfile] = Field(default_factory=list)
    missing_evidence: list[str] = Field(default_factory=list)

    # Analysis
    correlation_findings: list[str] = Field(default_factory=list)
    reasoning_draft: str = ""
    confidence: float = 0.0
    guardrail_notes: list[str] = Field(default_factory=list)
    policy_checks: list[dict[str, Any]] = Field(default_factory=list)
    approval_required: bool = False
    recommendations: list[WasteRecommendation] = Field(default_factory=list)

    # Final
    final_output: TelemetryWasteFinalOutput | None = None
