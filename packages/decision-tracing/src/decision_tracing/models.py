from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class NodeRun(BaseModel):
    node_name: str
    started_at: datetime
    status: str
    input_hash: str
    output_hash: str
    tool_calls: list[dict[str, Any]] = Field(default_factory=list)
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
