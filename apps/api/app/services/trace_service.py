from __future__ import annotations

import json
import re
from pathlib import Path

from opentelemetry import trace

from decision_tracing.models import ApprovalEvent, ApprovalRequest, DecisionTrace

SCHEMA_PATH = Path("packages/decision-tracing/schema/decision_trace.schema.json")
SHA256_RE = re.compile(r"^[a-f0-9]{64}$")


class TraceService:
    def __init__(self, store: object) -> None:
        self.store = store

    async def create_or_merge_trace(
        self, trace_payload: dict, force_merge: bool = False
    ) -> tuple[DecisionTrace, bool]:
        schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
        from jsonschema import validate
        validate(instance=trace_payload, schema=schema)

        trace_obj = DecisionTrace.model_validate(trace_payload)

        for node_run in trace_obj.node_runs:
            if not SHA256_RE.match(node_run.input_hash) or not SHA256_RE.match(
                node_run.output_hash
            ):
                raise ValueError("node run hashes must be 64-char lowercase hex strings")

        tracer = trace.get_tracer("decision-tracing")
        with tracer.start_as_current_span("decision_trace.persist") as span:
            span.set_attribute("workflow_id", trace_obj.workflow_id)
            span.set_attribute("graph_name", trace_obj.graph_name)
            span.set_attribute("node_count", len(trace_obj.node_runs))
            span.set_attribute("started_at", trace_obj.started_at.isoformat())
            saved, created = await self.store.aupsert(trace_obj, force_merge=force_merge)  # type: ignore[union-attr]
            return saved, created

    async def add_approval(
        self, workflow_id: str, request: ApprovalRequest, actor_from_auth: str
    ) -> ApprovalEvent:
        if actor_from_auth != request.approver:
            raise PermissionError("approver identity must come from auth context")
        if actor_from_auth.lower() in {"agent", "system"}:
            raise PermissionError("self-approval by automated actor is not allowed")

        return await self.store.aadd_approval(workflow_id, request)  # type: ignore[union-attr]

    async def list_approvals(self, workflow_id: str) -> list[ApprovalEvent]:
        return await self.store.alist_approvals(workflow_id)  # type: ignore[union-attr]
