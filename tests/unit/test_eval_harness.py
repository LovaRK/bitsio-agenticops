from __future__ import annotations

import json
from pathlib import Path

from infra.scripts.run_eval_harness import run


def test_eval_harness_passes_with_valid_fixture(tmp_path: Path) -> None:
    fixture = {
        "id": "ok_case",
        "prediction": {
            "confidence": 0.8,
            "approval_required": False,
            "missing_evidence": [],
            "guardrail_notes": [],
        },
        "expect": {"confidence_min": 0.7, "approval_required": False},
    }
    (tmp_path / "case.json").write_text(json.dumps(fixture), encoding="utf-8")
    assert run(tmp_path, min_pass_rate=90.0) == 0


def test_eval_harness_fails_when_pass_rate_below_threshold(tmp_path: Path) -> None:
    fixture = {
        "id": "bad_case",
        "prediction": {
            "confidence": 0.9,
            "approval_required": False,
            "missing_evidence": [],
            "guardrail_notes": [],
        },
        "expect": {"confidence_max": 0.3, "approval_required": True},
    }
    (tmp_path / "case.json").write_text(json.dumps(fixture), encoding="utf-8")
    assert run(tmp_path, min_pass_rate=90.0) == 1

