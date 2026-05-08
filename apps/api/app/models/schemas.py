"""Pydantic schemas for the API."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from pydantic import Literal


class TelemetryEvent(BaseModel):
    """Telemetry event model."""
    timestamp: datetime
    source: str
    service: str
    event_type: str
    severity: Literal["info", "warning", "error", "critical"] = "info"
    raw_message: str
    metadata: dict = Field(default_factory=dict)


class TelemetryMetrics(BaseModel):
    """Telemetry metrics model."""
    total_events: int = 0
    error_rate: float = 0.0
    avg_response_time: float = 0.0
    anomaly_score: float = 0.0
    cost_estimate: float = 0.0


class ValueInsight(BaseModel):
    """Value insight recommendation model."""
    category: Literal["cost", "anomaly", "roi", "optimization"]
    severity: Literal["low", "medium", "high", "critical"]
    description: str
    recommendation: str
    estimated_impact: float = 0.0
    evidence: list[str] = Field(default_factory=list)


class IndexProfile(BaseModel):
    """Index profile for waste analysis."""
    index_name: str
    daily_ingest_gb: float
    search_count_90d: int
    dashboard_references: int
    alert_references: int
    estimated_annual_cost: float
    utilization_score: float
    recommendation: Literal["KEEP", "REVIEW", "REMOVE"]
    confidence: float


class DecisionTraceNode(BaseModel):
    """Individual node in decision trace."""
    node_name: str
    start_time: datetime
    end_time: Optional[datetime] = None
    input_state: dict = Field(default_factory=dict)
    output_state: dict = Field(default_factory=dict)
    error: Optional[str] = None


class DecisionTrace(BaseModel):
    """Decision trace model for audit trail."""
    workflow_id: str
    graph_name: str
    graph_version: str
    start_time: datetime
    end_time: Optional[datetime] = None
    status: Literal["running", "completed", "failed", "awaiting_approval", "rejected"]
    nodes: list[DecisionTraceNode] = Field(default_factory=list)
    final_output: Optional[dict] = None
    trace_hash: Optional[str] = None


class ApprovalEvent(BaseModel):
    """Approval event model."""
    workflow_id: str
    decision: Literal["approved", "rejected"]
    reviewer_id: str
    comment: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class RuntimeConfig(BaseModel):
    """Runtime configuration for AI models."""
    model_provider: Literal["ollama", "anthropic", "openrouter"]
    model_name: str
    local_mode: bool = True
    anthropic_api_key: Optional[str] = None
    openrouter_api_key: Optional[str] = None


class RuntimeStatus(BaseModel):
    """Runtime status response."""
    provider: str
    model: str
    local_mode: bool
    inference: Literal["LOCAL", "CLOUD"]
    cloud_access: Literal["DISABLED", "ENABLED"]
    telemetry_source: Literal["MOCK", "LIVE"]