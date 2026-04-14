"""
Baseline Load Test Scenario - 10 concurrent users, 5 minutes

This test verifies:
- API response times under baseline load (p95 <400ms target)
- Incident list endpoint performance
- Decision trace retrieval performance
- Approval creation performance
- Rate limiter is responsive but not triggering
"""

import json

from locust import HttpUser, between, task


class BitsIOUser(HttpUser):
    """Simulates a typical BitsIO AgenticOps user."""

    wait_time = between(1, 3)  # Wait 1-3 seconds between requests

    def on_start(self):
        """Set up auth headers for all requests."""
        self.headers = {"x-api-key": "dev-analyst", "Content-Type": "application/json"}
        self.approver_headers = {"x-api-key": "dev-approver", "Content-Type": "application/json"}
        self.incidents = []

    @task(7)  # 70% of traffic
    def list_incidents(self):
        """GET /api/v1/incidents - Fetch incident list."""
        response = self.client.get(
            "/api/v1/incidents", headers=self.headers, name="GET /api/v1/incidents"
        )
        if response.status_code == 200:
            try:
                data = response.json()
                self.incidents = data.get("items", [])
            except json.JSONDecodeError:
                pass

    @task(2)  # 20% of traffic
    def get_decision_trace(self):
        """GET /api/v1/decision-traces/{id} - Fetch decision trace detail."""
        if self.incidents:
            incident = self.incidents[0]
            incident_id = str(incident.get("id", "inc_20260408_42"))
            workflow_id = f"wf_{incident_id}" if not incident_id.startswith("wf_") else incident_id

            self.client.get(
                f"/api/v1/decision-traces/{workflow_id}",
                headers=self.headers,
                name="GET /api/v1/decision-traces/{id}",
            )
        else:
            # Fallback to known incident ID
            self.client.get(
                "/api/v1/decision-traces/wf_inc_20260408_42",
                headers=self.headers,
                name="GET /api/v1/decision-traces/{id}",
            )

    @task(1)  # 10% of traffic
    def create_approval(self):
        """POST /api/v1/decision-traces/{id}/approvals - Submit approval."""
        if self.incidents:
            incident = self.incidents[0]
            incident_id = str(incident.get("id", "inc_20260408_42"))
            workflow_id = f"wf_{incident_id}" if not incident_id.startswith("wf_") else incident_id
        else:
            workflow_id = "wf_inc_20260408_42"

        approval_payload = {"decision": "approve", "comment": "Load test verification"}

        self.client.post(
            f"/api/v1/decision-traces/{workflow_id}/approvals",
            json=approval_payload,
            headers=self.approver_headers,
            name="POST /api/v1/decision-traces/{id}/approvals",
        )
