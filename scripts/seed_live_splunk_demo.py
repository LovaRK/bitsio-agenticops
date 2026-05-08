from __future__ import annotations

import os
import time
from pathlib import Path

import httpx
from dotenv import load_dotenv


def _require(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required env var: {name}")
    return value


def main() -> None:
    repo_root = Path(__file__).resolve().parents[1]
    load_dotenv(repo_root / ".env")

    base_url = os.getenv("SPLUNK_MCP_BASE_URL", "https://localhost:8089").rstrip("/")
    auth_scheme = os.getenv("SPLUNK_AUTH_SCHEME", "Bearer").strip() or "Bearer"
    token = _require("SPLUNK_MCP_TOKEN")

    # Native endpoint expects /services/search/jobs/export.
    if base_url.endswith("/services/mcp"):
        base_url = base_url.removesuffix("/services/mcp")

    headers = {"Authorization": f"{auth_scheme} {token}"}
    incident_id = f"inc_live_demo_{int(time.time())}"
    query = (
        "| makeresults count=3 "
        "| streamstats count as n "
        f'| eval incident_id="{incident_id}" '
        '| eval severity=case(n=1, "high", n=2, "medium", true(), "low") '
        '| eval status=case(n=1, "pending_approval", n=2, "triaging", true(), "resolved") '
        '| eval title="BitsIO Live Demo Incident" '
        '| eval host=case(n=1, "payments-api-1", n=2, "payments-api-2", true(), "payments-api-3") '
        '| eval marker="bitsio_agenticops_demo" '
        '| eval _raw="incident_id=" . incident_id . " severity=" . severity . " status=" . status '
        '. " title=BitsIO_Live_Demo host=" . host . " marker=" . marker '
        "| collect index=tutorial sourcetype=bitsio_demo"
    )

    write = httpx.post(
        f"{base_url}/services/search/jobs/export",
        params={"output_mode": "json"},
        data={"search": query, "earliest_time": "-5m", "latest_time": "now"},
        headers=headers,
        verify=False,
        timeout=30,
    )
    write.raise_for_status()

    print(f"Seeded demo incident into index=tutorial with incident_id={incident_id}")
    print("Use this URL in browser:")
    print(f"  http://127.0.0.1:3000/incidents/{incident_id}")


if __name__ == "__main__":
    main()
