from __future__ import annotations

import json
from pathlib import Path

from fastapi.testclient import TestClient

from apps.api.app.main import app

FIXTURE = Path(__file__).parent.parent / "fixtures" / "decision_tracing" / "sample_trace.json"


def _payload() -> dict:
    payload = json.loads(FIXTURE.read_text(encoding="utf-8"))
    payload["workflow_id"] = "wf_smoke_test_unit"
    return payload


def test_smoke_flow_rbac_rate_limit_and_lifecycle() -> None:
    client = TestClient(app)

    payload = _payload()
    analyst_headers = {
        "x-api-key": "dev-analyst",
        "x-user-id": "smoke-analyst",
        "x-tenant-id": "tenant_smoke",
    }
    approver_headers = {
        "x-api-key": "dev-approver",
        "x-user-id": "smoke-approver",
        "x-tenant-id": "tenant_smoke",
    }

    created = client.post("/api/v1/decision-traces", json=payload, headers=analyst_headers)
    assert created.status_code in {200, 201}

    fetched = client.get("/api/v1/decision-traces/wf_smoke_test_unit", headers=analyst_headers)
    assert fetched.status_code == 200
    assert fetched.json()["workflow_id"] == "wf_smoke_test_unit"

    denied = client.post(
        "/api/v1/decision-traces/wf_smoke_test_unit/approvals",
        json={"approver": "smoke-approver", "decision": "approved", "reason": "rbac deny"},
        headers=analyst_headers,
    )
    assert denied.status_code == 403

    approved = client.post(
        "/api/v1/decision-traces/wf_smoke_test_unit/approvals",
        json={"approver": "smoke-approver", "decision": "approved", "reason": "rbac allow"},
        headers=approver_headers,
    )
    assert approved.status_code == 200

    listed = client.get(
        "/api/v1/decision-traces/wf_smoke_test_unit/approvals", headers=analyst_headers
    )
    assert listed.status_code == 200
    assert len(listed.json()["items"]) >= 1

    # Hit a dedicated tenant until rate limit triggers.
    limited_status = 0
    for _ in range(110):
        # Use an in-process route to avoid external latency from live Splunk calls.
        resp = client.get(
            "/api/v1/decision-traces/wf_smoke_test_unit",
            headers={
                "x-api-key": "dev-analyst",
                "x-user-id": "smoke-analyst",
                "x-tenant-id": "tenant_smoke_limit_unit",
            },
        )
        limited_status = resp.status_code
        if limited_status == 429:
            break
    assert limited_status == 429

    isolated = client.get(
        "/api/v1/incidents",
        headers={
            "x-api-key": "dev-analyst",
            "x-user-id": "smoke-analyst",
            "x-tenant-id": "tenant_smoke_isolated_unit",
        },
    )
    assert isolated.status_code == 200
