from __future__ import annotations

from fastapi.testclient import TestClient

from apps.api.app.main import app

client = TestClient(app)


def test_approval_requires_auth_context_match() -> None:
    response = client.post(
        "/api/v1/decision-traces/wf_approval_1/approvals",
        json={"approver": "alice", "decision": "approved", "reason": "Looks safe"},
        headers={"x-user-id": "bob", "x-api-key": "dev-approver"},
    )
    assert response.status_code == 403


def test_approval_append_and_list() -> None:
    workflow_id = "wf_approval_2"
    create = client.post(
        f"/api/v1/decision-traces/{workflow_id}/approvals",
        json={"approver": "alice", "decision": "approved", "reason": "Validated"},
        headers={"x-user-id": "alice", "x-api-key": "dev-approver"},
    )
    assert create.status_code == 200

    listed = client.get(
        f"/api/v1/decision-traces/{workflow_id}/approvals",
        headers={"x-user-id": "alice", "x-api-key": "dev-analyst"},
    )
    assert listed.status_code == 200
    assert len(listed.json()["items"]) >= 1
