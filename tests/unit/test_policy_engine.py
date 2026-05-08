from __future__ import annotations

from pathlib import Path

from agent_core.policies.evaluator import PolicyEvaluator

RULES_DIR = Path("packages/agent-core/src/agent_core/policies/rules")


def test_policy_engine_flags_prod() -> None:
    evaluator = PolicyEvaluator(RULES_DIR)
    checks = evaluator.evaluate({"environment": "prod", "confidence": 0.9, "action_type": "read"})
    assert any(check.matched for check in checks if check.rule_id == "env-prod-approval")


def test_policy_engine_flags_low_confidence() -> None:
    evaluator = PolicyEvaluator(RULES_DIR)
    checks = evaluator.evaluate({"environment": "dev", "confidence": 0.2, "action_type": "read"})
    assert any(check.matched for check in checks if check.rule_id == "low-confidence-approval")
