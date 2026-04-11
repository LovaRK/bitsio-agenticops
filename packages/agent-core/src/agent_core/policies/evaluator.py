from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel


class PolicyRule(BaseModel):
    id: str
    description: str
    condition: str
    action: str
    threshold: float | None = None


class PolicyCheckResult(BaseModel):
    rule_id: str
    matched: bool
    action: str
    note: str


class PolicyEvaluator:
    def __init__(self, rules_dir: Path) -> None:
        self.rules = self._load_rules(rules_dir)

    def _load_rules(self, rules_dir: Path) -> list[PolicyRule]:
        loaded: list[PolicyRule] = []
        for file_path in sorted(rules_dir.glob("*.yaml")):
            payload = yaml.safe_load(file_path.read_text(encoding="utf-8")) or {}
            for item in payload.get("rules", []):
                loaded.append(PolicyRule.model_validate(item))
        return loaded

    def evaluate(self, context: dict[str, Any]) -> list[PolicyCheckResult]:
        checks: list[PolicyCheckResult] = []

        for rule in self.rules:
            matched = False
            if rule.condition == "environment_is_prod":
                matched = context.get("environment") == "prod"
            elif rule.condition == "confidence_below":
                threshold = rule.threshold or 0.7
                matched = float(context.get("confidence", 0.0)) < threshold
            elif rule.condition == "write_action":
                matched = context.get("action_type") == "write"

            checks.append(
                PolicyCheckResult(
                    rule_id=rule.id,
                    matched=matched,
                    action=rule.action,
                    note=rule.description,
                )
            )

        return checks
