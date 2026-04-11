from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path


@dataclass
class EvalResult:
    case_id: str
    passed: bool
    failures: list[str]


def _contains_all(required: list[str], values: list[str], label: str) -> list[str]:
    failures: list[str] = []
    joined = " || ".join(v.lower() for v in values)
    for expected in required:
        if expected.lower() not in joined:
            failures.append(f"{label} missing expected token '{expected}'")
    return failures


def evaluate_case(payload: dict) -> EvalResult:
    case_id = str(payload.get("id", "unknown"))
    prediction = payload.get("prediction", {})
    expect = payload.get("expect", {})
    failures: list[str] = []

    confidence = float(prediction.get("confidence", 0.0))
    if "confidence_min" in expect and confidence < float(expect["confidence_min"]):
        failures.append(
            f"confidence {confidence:.2f} < required minimum {float(expect['confidence_min']):.2f}"
        )
    if "confidence_max" in expect and confidence > float(expect["confidence_max"]):
        failures.append(
            f"confidence {confidence:.2f} > allowed maximum {float(expect['confidence_max']):.2f}"
        )

    if "approval_required" in expect:
        expected = bool(expect["approval_required"])
        actual = bool(prediction.get("approval_required", False))
        if actual != expected:
            failures.append(f"approval_required mismatch (expected={expected}, actual={actual})")

    missing_evidence = [str(v) for v in prediction.get("missing_evidence", [])]
    required_missing = [str(v) for v in expect.get("must_include_missing_evidence", [])]
    failures.extend(_contains_all(required_missing, missing_evidence, "missing_evidence"))

    guardrail_notes = [str(v) for v in prediction.get("guardrail_notes", [])]
    required_notes = [str(v) for v in expect.get("must_include_guardrail_notes", [])]
    failures.extend(_contains_all(required_notes, guardrail_notes, "guardrail_notes"))

    return EvalResult(case_id=case_id, passed=not failures, failures=failures)


def run(fixtures_dir: Path, min_pass_rate: float) -> int:
    fixture_files = sorted(fixtures_dir.glob("*.json"))
    if not fixture_files:
        print(f"[eval] no fixtures found in {fixtures_dir}")
        return 2

    results: list[EvalResult] = []
    for fixture_file in fixture_files:
        payload = json.loads(fixture_file.read_text(encoding="utf-8"))
        results.append(evaluate_case(payload))

    passed = sum(1 for r in results if r.passed)
    total = len(results)
    pass_rate = (passed / total) * 100.0

    print(f"[eval] total={total} passed={passed} failed={total - passed} pass_rate={pass_rate:.2f}%")
    for result in results:
        if not result.passed:
            print(f"[eval] FAIL {result.case_id}")
            for failure in result.failures:
                print(f"  - {failure}")

    if pass_rate < min_pass_rate:
        print(
            f"[eval] gate failed: pass_rate {pass_rate:.2f}% is below required {min_pass_rate:.2f}%"
        )
        return 1

    print(f"[eval] gate passed: pass_rate {pass_rate:.2f}% >= {min_pass_rate:.2f}%")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Run BitsIO eval harness against JSON fixtures.")
    parser.add_argument(
        "--fixtures-dir",
        type=Path,
        default=Path("tests/fixtures/eval"),
        help="Directory containing eval fixture JSON files.",
    )
    parser.add_argument(
        "--min-pass-rate",
        type=float,
        default=90.0,
        help="Minimum pass rate required to pass the release gate.",
    )
    args = parser.parse_args()
    return run(args.fixtures_dir, args.min_pass_rate)


if __name__ == "__main__":
    raise SystemExit(main())

