from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class TokenUsage(BaseModel):
    prompt: int = 0
    completion: int = 0
    total: int = 0
    source: Literal["reported", "derived", "not_applicable"] = "not_applicable"


class CostUsage(BaseModel):
    usd: float = 0.0
    source: Literal["reported", "derived", "not_applicable"] = "not_applicable"


class ToolCall(BaseModel):
    tool_name: str
    status: str
    tool_type: Literal["llm", "retrieval", "policy", "transform"] | None = None
    metric_source: dict[str, Literal["reported", "derived", "not_applicable"]] = Field(
        default_factory=dict
    )
    token_usage: TokenUsage | None = None
    cost_usage: CostUsage | None = None
    latency_ms: int | None = None
    confidence_impact: float | None = None
    provider: str | None = None
    model_name: str | None = None
    runtime_mode: Literal["local", "cloud", "unknown"] | None = None
    splunk_mode: Literal["mcp", "native", "auto", "unknown"] | None = None
    input_preview: str | None = None
    output_preview: str | None = None
    explainability_notes: list[str] = Field(default_factory=list)


class NodeRun(BaseModel):
    node_name: str
    started_at: datetime
    status: str
    input_hash: str
    output_hash: str
    tool_calls: list[ToolCall] = Field(default_factory=list)
    policy_checks: list[dict[str, Any]] = Field(default_factory=list)


class DecisionTrace(BaseModel):
    workflow_id: str
    incident_id: str
    graph_name: str
    graph_version: str
    started_at: datetime
    completed_at: datetime | None = None
    actor_type: str = "agent"
    model_provider: str = "anthropic"
    model_name: str = "claude"
    prompt_version: str = "v1"
    node_runs: list[NodeRun]
    final_assessment: str
    confidence: float = 0.0
    approval_required: bool = False


class ApprovalRequest(BaseModel):
    approver: str
    decision: Literal["approved", "rejected"]
    reason: str


class ApprovalEvent(BaseModel):
    workflow_id: str
    approver: str
    decision: Literal["approved", "rejected"]
    reason: str
    created_at: datetime
