from __future__ import annotations

import json
import os
from pathlib import Path
from uuid import uuid4

from locust import HttpUser, between, task


def _load_trace_fixture() -> dict:
    fixture_path = Path(__file__).resolve().parents[1] / "fixtures" / "decision_tracing" / "sample_trace.json"
    return json.loads(fixture_path.read_text(encoding="utf-8"))


class AnalystUser(HttpUser):
    wait_time = between(0.1, 0.5)

    def on_start(self) -> None:
        self.trace_payload = _load_trace_fixture()
        tenant_id = os.getenv("LOCUST_TENANT_ID", f"tenant_load_{uuid4().hex[:8]}")
        self.headers = {
            "x-api-key": "dev-analyst",
            "x-user-id": "analyst-load",
            "x-tenant-id": tenant_id,
        }
        self.approver_headers = {
            "x-api-key": "dev-approver",
            "x-user-id": "approver-load",
            "x-tenant-id": tenant_id,
        }

    @task(4)
    def list_incidents(self) -> None:
        self.client.get("/api/v1/incidents", headers=self.headers, name="GET /incidents")

    @task(2)
    def write_decision_trace(self) -> None:
        payload = dict(self.trace_payload)
        payload["workflow_id"] = f"wf_load_{uuid4().hex[:12]}"
        self.client.post(
            "/api/v1/decision-traces",
            json=payload,
            headers=self.headers,
            name="POST /decision-traces",
        )

    @task(1)
    def approvals_flow(self) -> None:
        workflow_id = f"wf_approval_{uuid4().hex[:12]}"
        self.client.post(
            f"/api/v1/decision-traces/{workflow_id}/approvals",
            json={"approver": "approver-load", "decision": "approved", "reason": "load test"},
            headers=self.approver_headers,
            name="POST /approvals",
        )
        self.client.get(
            f"/api/v1/decision-traces/{workflow_id}/approvals",
            headers=self.headers,
            name="GET /approvals",
        )

    @task(1)
    def health(self) -> None:
        self.client.get("/health", name="GET /health")
