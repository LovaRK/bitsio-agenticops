from __future__ import annotations

from datetime import UTC, datetime

from decision_tracing.models import ApprovalEvent, ApprovalRequest, DecisionTrace


class InMemoryDecisionTraceStore:
    """Sync in-memory store. Also exposes async wrappers for interface compatibility."""
    def __init__(self) -> None:
        self._traces: dict[str, DecisionTrace] = {}
        self._approvals: dict[str, list[ApprovalEvent]] = {}

    def get(self, workflow_id: str) -> DecisionTrace | None:
        return self._traces.get(workflow_id)

    def upsert(
        self, trace: DecisionTrace, *, force_merge: bool = False
    ) -> tuple[DecisionTrace, bool]:
        existing = self._traces.get(trace.workflow_id)

        if existing and not force_merge:
            return existing, False

        if existing and force_merge:
            merged = existing.model_copy(deep=True)
            merged.node_runs.extend(trace.node_runs)
            merged.completed_at = trace.completed_at
            merged.final_assessment = trace.final_assessment
            merged.confidence = trace.confidence
            merged.approval_required = trace.approval_required
            self._traces[trace.workflow_id] = merged
            return merged, False

        self._traces[trace.workflow_id] = trace
        return trace, True

    def add_approval(self, workflow_id: str, request: ApprovalRequest) -> ApprovalEvent:
        event = ApprovalEvent(
            workflow_id=workflow_id,
            approver=request.approver,
            decision=request.decision,
            reason=request.reason,
            created_at=datetime.now(tz=UTC),
        )
        self._approvals.setdefault(workflow_id, []).append(event)
        return event

    def list_approvals(self, workflow_id: str) -> list[ApprovalEvent]:
        return self._approvals.get(workflow_id, [])

    # ── Async wrappers (interface parity with PostgresDecisionTraceStore) ──────

    async def aget(self, workflow_id: str) -> DecisionTrace | None:
        return self.get(workflow_id)

    async def aupsert(
        self, trace: DecisionTrace, *, force_merge: bool = False
    ) -> tuple[DecisionTrace, bool]:
        return self.upsert(trace, force_merge=force_merge)

    async def aadd_approval(self, workflow_id: str, request: ApprovalRequest) -> ApprovalEvent:
        return self.add_approval(workflow_id, request)

    async def alist_approvals(self, workflow_id: str) -> list[ApprovalEvent]:
        return self.list_approvals(workflow_id)
