from __future__ import annotations

import json
from pathlib import Path

from fastapi.testclient import TestClient

from apps.api.app.main import app

FIXTURE = Path(__file__).parent.parent / "fixtures" / "decision_tracing" / "sample_trace.json"


def _payload() -> dict:
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def test_create_decision_trace_returns_201_then_200() -> None:
    client = TestClient(app)
    payload = _payload()
    headers = {"x-api-key": "dev-analyst", "x-user-id": "analyst1"}

    first = client.post("/api/v1/decision-traces", json=payload, headers=headers)
    assert first.status_code == 200 or first.status_code == 201

    second = client.post("/api/v1/decision-traces", json=payload, headers=headers)
    assert second.status_code == 200


def test_invalid_hash_rejected() -> None:
    client = TestClient(app)
    payload = _payload()
    payload["workflow_id"] = "wf_bad_hash"
    payload["node_runs"][0]["input_hash"] = "oops"
    headers = {"x-api-key": "dev-analyst", "x-user-id": "analyst1"}

    response = client.post("/api/v1/decision-traces", json=payload, headers=headers)
    assert response.status_code == 400


def test_force_merge_appends_node_runs() -> None:
    client = TestClient(app)
    payload = _payload()
    payload["workflow_id"] = "wf_merge_1"
    headers = {"x-api-key": "dev-analyst", "x-user-id": "analyst1"}

    created = client.post("/api/v1/decision-traces", json=payload, headers=headers)
    assert created.status_code in {200, 201}

    extra = _payload()
    extra["workflow_id"] = "wf_merge_1"
    extra["node_runs"][0]["node_name"] = "final_response"

    merged = client.post("/api/v1/decision-traces?force_merge=true", json=extra, headers=headers)
    assert merged.status_code == 200
