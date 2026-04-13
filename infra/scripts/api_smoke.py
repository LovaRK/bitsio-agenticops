from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import httpx
from fastapi.testclient import TestClient

FIXTURE_PATH = Path("tests/fixtures/decision_tracing/sample_trace.json")
ROOT = Path(__file__).resolve().parents[2]
for extra_path in [
    ROOT,
    ROOT / "apps/api",
    ROOT / "packages/decision-tracing/src",
    ROOT / "packages/agent-core/src",
    ROOT / "packages/connectors/splunk-mcp/src",
]:
    path_str = str(extra_path)
    if path_str not in sys.path:
        sys.path.insert(0, path_str)


def _assert(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def run(base_url: str, tenant_id: str) -> None:
    with httpx.Client(base_url=base_url, timeout=10.0) as client:
        health = client.get("/health")
        _assert(health.status_code == 200, f"/health failed: {health.status_code}")

        incidents = client.get(
            "/api/v1/incidents",
            headers={
                "x-api-key": "dev-analyst",
                "x-user-id": "smoke-analyst",
                "x-tenant-id": tenant_id,
            },
        )
        _assert(incidents.status_code == 200, f"/incidents failed: {incidents.status_code}")

        payload = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
        payload["workflow_id"] = "wf_smoke_contract_0001"

        trace_create = client.post(
            "/api/v1/decision-traces",
            json=payload,
            headers={
                "x-api-key": "dev-analyst",
                "x-user-id": "smoke-analyst",
                "x-tenant-id": tenant_id,
            },
        )
        _assert(
            trace_create.status_code in {200, 201},
            f"create trace failed: {trace_create.status_code}",
        )

        wrong_role = client.post(
            "/api/v1/decision-traces/wf_smoke_contract_0001/approvals",
            json={"approver": "smoke-approver", "decision": "approved", "reason": "smoke"},
            headers={
                "x-api-key": "dev-analyst",
                "x-user-id": "smoke-approver",
                "x-tenant-id": tenant_id,
            },
        )
        _assert(wrong_role.status_code == 403, f"RBAC deny check failed: {wrong_role.status_code}")

        approval = client.post(
            "/api/v1/decision-traces/wf_smoke_contract_0001/approvals",
            json={"approver": "smoke-approver", "decision": "approved", "reason": "smoke"},
            headers={
                "x-api-key": "dev-approver",
                "x-user-id": "smoke-approver",
                "x-tenant-id": tenant_id,
            },
        )
        _assert(approval.status_code == 200, f"approval create failed: {approval.status_code}")

        approvals = client.get(
            "/api/v1/decision-traces/wf_smoke_contract_0001/approvals",
            headers={
                "x-api-key": "dev-analyst",
                "x-user-id": "smoke-analyst",
                "x-tenant-id": tenant_id,
            },
        )
        _assert(approvals.status_code == 200, f"approval list failed: {approvals.status_code}")
        _assert(len(approvals.json().get("items", [])) >= 1, "approval list should not be empty")

        # Rate-limit boundary on a single tenant (limit=100/min by default).
        last_status = 0
        for _ in range(110):
            response = client.get(
                "/api/v1/incidents",
                headers={
                    "x-api-key": "dev-analyst",
                    "x-user-id": "smoke-analyst",
                    "x-tenant-id": "tenant_smoke_limit",
                },
            )
            last_status = response.status_code
            if last_status == 429:
                break
        _assert(last_status == 429, "expected rate limit 429 on tenant_smoke_limit")

        isolated = client.get(
            "/api/v1/incidents",
            headers={
                "x-api-key": "dev-analyst",
                "x-user-id": "smoke-analyst",
                "x-tenant-id": "tenant_smoke_isolated",
            },
        )
        _assert(isolated.status_code == 200, "tenant isolation check failed (expected 200)")

    print("[smoke] API smoke checks passed.")


def run_in_process(tenant_id: str) -> None:
    from apps.api.app.main import app

    with TestClient(app) as client:
        health = client.get("/health")
        _assert(health.status_code == 200, f"/health failed: {health.status_code}")

        incidents = client.get(
            "/api/v1/incidents",
            headers={
                "x-api-key": "dev-analyst",
                "x-user-id": "smoke-analyst",
                "x-tenant-id": tenant_id,
            },
        )
        _assert(incidents.status_code == 200, f"/incidents failed: {incidents.status_code}")

        payload = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
        payload["workflow_id"] = "wf_smoke_contract_0001"

        trace_create = client.post(
            "/api/v1/decision-traces",
            json=payload,
            headers={
                "x-api-key": "dev-analyst",
                "x-user-id": "smoke-analyst",
                "x-tenant-id": tenant_id,
            },
        )
        _assert(
            trace_create.status_code in {200, 201},
            f"create trace failed: {trace_create.status_code}",
        )

        wrong_role = client.post(
            "/api/v1/decision-traces/wf_smoke_contract_0001/approvals",
            json={"approver": "smoke-approver", "decision": "approved", "reason": "smoke"},
            headers={
                "x-api-key": "dev-analyst",
                "x-user-id": "smoke-approver",
                "x-tenant-id": tenant_id,
            },
        )
        _assert(wrong_role.status_code == 403, f"RBAC deny check failed: {wrong_role.status_code}")

        approval = client.post(
            "/api/v1/decision-traces/wf_smoke_contract_0001/approvals",
            json={"approver": "smoke-approver", "decision": "approved", "reason": "smoke"},
            headers={
                "x-api-key": "dev-approver",
                "x-user-id": "smoke-approver",
                "x-tenant-id": tenant_id,
            },
        )
        _assert(approval.status_code == 200, f"approval create failed: {approval.status_code}")

        approvals = client.get(
            "/api/v1/decision-traces/wf_smoke_contract_0001/approvals",
            headers={
                "x-api-key": "dev-analyst",
                "x-user-id": "smoke-analyst",
                "x-tenant-id": tenant_id,
            },
        )
        _assert(approvals.status_code == 200, f"approval list failed: {approvals.status_code}")
        _assert(len(approvals.json().get("items", [])) >= 1, "approval list should not be empty")

        limited_status = 0
        for _ in range(110):
            response = client.get(
                "/api/v1/incidents",
                headers={
                    "x-api-key": "dev-analyst",
                    "x-user-id": "smoke-analyst",
                    "x-tenant-id": "tenant_smoke_limit",
                },
            )
            limited_status = response.status_code
            if limited_status == 429:
                break
        _assert(limited_status == 429, "expected rate limit 429 on tenant_smoke_limit")

        isolated = client.get(
            "/api/v1/incidents",
            headers={
                "x-api-key": "dev-analyst",
                "x-user-id": "smoke-analyst",
                "x-tenant-id": "tenant_smoke_isolated",
            },
        )
        _assert(isolated.status_code == 200, "tenant isolation check failed (expected 200)")

    print("[smoke] API smoke checks passed (in-process).")


def main() -> int:
    parser = argparse.ArgumentParser(description="Run API smoke checks against local BitsIO stack.")
    parser.add_argument("--base-url", default="http://localhost:8001")
    parser.add_argument("--tenant-id", default="tenant_smoke_api")
    parser.add_argument(
        "--mode",
        choices=["auto", "network", "in-process"],
        default="auto",
        help="auto: try network then fallback in-process; network: only HTTP; in-process: TestClient.",
    )
    args = parser.parse_args()
    if args.mode == "network":
        run(args.base_url, args.tenant_id)
    elif args.mode == "in-process":
        run_in_process(args.tenant_id)
    else:
        try:
            run(args.base_url, args.tenant_id)
        except Exception:  # noqa: BLE001
            run_in_process(args.tenant_id)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
