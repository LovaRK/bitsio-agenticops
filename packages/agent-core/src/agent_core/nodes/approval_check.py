from __future__ import annotations

from pathlib import Path

from agent_core.policies.evaluator import PolicyEvaluator
from agent_core.state.telemetry_state import TelemetryAgentState

RULES_DIR = Path(__file__).parent.parent / "policies" / "rules"


def approval_check(
    state: TelemetryAgentState,
    *,
    evaluator: PolicyEvaluator | None = None,
    environment: str = "dev",
    action_type: str = "read",
) -> TelemetryAgentState:
    next_state = state.model_copy(deep=True)
    if evaluator is None:
        evaluator = PolicyEvaluator(RULES_DIR)

    checks = evaluator.evaluate(
        {
            "environment": environment,
            "confidence": next_state.confidence,
            "action_type": action_type,
        }
    )

    matched = [check for check in checks if check.matched and check.action == "require_approval"]
    next_state.approval_required = len(matched) > 0
    next_state.guardrail_notes = [f"{item.rule_id}:{item.note}" for item in matched]
    next_state.policy_checks = [item.model_dump() for item in checks]

    return next_state
