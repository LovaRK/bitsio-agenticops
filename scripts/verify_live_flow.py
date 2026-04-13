from __future__ import annotations

from pathlib import Path

import httpx
from dotenv import load_dotenv


def main() -> None:
    repo_root = Path(__file__).resolve().parents[1]
    load_dotenv(repo_root / ".env")

    api_base = "http://127.0.0.1:8001"
    analyst_headers = {
        "x-api-key": "dev-analyst",
        "x-user-id": "rama",
        "x-tenant-id": "tenant_demo",
    }
    approver_headers = {
        "x-api-key": "dev-approver",
        "x-user-id": "analyst1",
        "x-tenant-id": "tenant_demo",
    }

    with httpx.Client(base_url=api_base, timeout=20) as client:
        health = client.get("/health")
        health.raise_for_status()
        print("[ok] /health")

        incidents = client.get("/api/v1/incidents", headers=analyst_headers)
        incidents.raise_for_status()
        items = incidents.json().get("items", [])
        print(f"[ok] /api/v1/incidents -> {len(items)} items")
        if not items:
            print("[warn] no incidents found in live data")
            return

        incident_id = items[0]["id"]
        trace = client.get(f"/api/v1/decision-traces/{incident_id}", headers=analyst_headers)
        trace.raise_for_status()
        trace_data = trace.json()
        print(
            f"[ok] /decision-traces/{incident_id} -> "
            f"severity={trace_data.get('severity')} approval_required={trace_data.get('approval_required')}"
        )

        workflow_id = trace_data.get("workflow_id") or (
            incident_id if incident_id.startswith("wf_") else f"wf_{incident_id}"
        )
        approve = client.post(
            f"/api/v1/decision-traces/{workflow_id}/approvals",
            json={"approver": "analyst1", "decision": "approved", "reason": "live verify approve"},
            headers=approver_headers,
        )
        approve.raise_for_status()
        print(f"[ok] approve -> {workflow_id}")

        reject = client.post(
            f"/api/v1/decision-traces/{workflow_id}/approvals",
            json={"approver": "analyst1", "decision": "rejected", "reason": "live verify reject"},
            headers=approver_headers,
        )
        reject.raise_for_status()
        print(f"[ok] reject -> {workflow_id}")

        approvals = client.get(
            f"/api/v1/decision-traces/{workflow_id}/approvals", headers=analyst_headers
        )
        approvals.raise_for_status()
        print(f"[ok] approvals count -> {len(approvals.json().get('items', []))}")


if __name__ == "__main__":
    main()
