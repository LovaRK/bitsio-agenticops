from __future__ import annotations

import json
from pathlib import Path

from jsonschema import Draft202012Validator


def main() -> None:
    schema_path = Path("packages/decision-tracing/schema/decision_trace.schema.json")
    payload = json.loads(schema_path.read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(payload)
    print("decision_trace.schema.json is valid")


if __name__ == "__main__":
    main()
