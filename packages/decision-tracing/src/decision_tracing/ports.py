"""
Port definitions (abstract interfaces) for decision tracing.
Defines the stable boundaries for store implementations.
"""

from __future__ import annotations

from typing import Protocol

from decision_tracing.models import ApprovalEvent, ApprovalRequest, DecisionTrace


class DecisionTraceStore(Protocol):
    """
    Protocol for decision trace persistence.

    Both sync (InMemoryDecisionTraceStore) and async (PostgresDecisionTraceStore)
    implementations conform to this interface at the method level.
    """

    def get(self, workflow_id: str) -> DecisionTrace | None:
        """Retrieve a decision trace by workflow_id, or None if not found."""
        ...

    def upsert(
        self, trace: DecisionTrace, *, force_merge: bool = False
    ) -> tuple[DecisionTrace, bool]:
        """
        Insert or update a decision trace.

        Returns (trace, is_new):
        - is_new=True if this is a new trace
        - is_new=False if existing trace unchanged or merged
        """
        ...

    def add_approval(self, workflow_id: str, request: ApprovalRequest) -> ApprovalEvent:
        """Record an approval decision for a workflow."""
        ...

    def list_approvals(self, workflow_id: str) -> list[ApprovalEvent]:
        """Retrieve all approval events for a workflow."""
        ...
