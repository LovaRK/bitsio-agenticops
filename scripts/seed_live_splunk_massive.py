from __future__ import annotations

import os
import random
import time
from datetime import UTC, datetime, timedelta
from pathlib import Path

import httpx
from dotenv import load_dotenv


def _require(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required env var: {name}")
    return value


def _base_url() -> str:
    base = os.getenv("SPLUNK_MCP_BASE_URL", "https://localhost:8089").rstrip("/")
    if base.endswith("/services/mcp"):
        base = base.removesuffix("/services/mcp")
    return base


def main() -> None:
    repo_root = Path(__file__).resolve().parents[1]
    load_dotenv(repo_root / ".env")

    token = _require("SPLUNK_MCP_TOKEN")
    scheme = os.getenv("SPLUNK_AUTH_SCHEME", "Bearer").strip() or "Bearer"
    base = _base_url()
    headers = {"Authorization": f"{scheme} {token}"}

    total_events = int(os.getenv("BITSIO_SEED_EVENTS", "1800"))
    incident_count = int(os.getenv("BITSIO_SEED_INCIDENTS", "72"))
    batch_size = int(os.getenv("BITSIO_SEED_BATCH", "300"))

    seed_id = int(time.time())
    marker = f"bitsio_massive_seed_{seed_id}"

    services = [
        "payments-api",
        "checkout-api",
        "auth-api",
        "orders-api",
        "inventory-api",
        "gateway-api",
        "billing-worker",
        "fraud-engine",
    ]
    scenarios = [
        "latency_spike",
        "retry_storm",
        "auth_failures",
        "5xx_burst",
        "queue_backlog",
        "ingest_waste",
        "cpu_saturation",
        "dependency_timeout",
    ]
    personas = ["SRE", "OnCall", "Platform", "SOC", "Analyst", "FinOps"]

    now = datetime.now(tz=UTC)
    lines: list[str] = []
    for i in range(total_events):
        inc_idx = i % incident_count
        incident_id = f"inc_live_{seed_id}_{inc_idx:03d}"
        workflow_id = f"wf_{incident_id}"
        service = services[i % len(services)]
        scenario = scenarios[(i + inc_idx) % len(scenarios)]
        persona = personas[(i * 3) % len(personas)]
        host = f"{service}-{(i % 5) + 1}"

        if scenario in {"retry_storm", "5xx_burst", "dependency_timeout"}:
            severity = "high"
        elif scenario in {"auth_failures", "queue_backlog", "latency_spike"}:
            severity = "medium"
        else:
            severity = "low"

        status = (
            "pending_approval"
            if severity == "high" and i % 3 == 0
            else ("resolved" if i % 9 == 0 else "triaging")
        )

        title_map = {
            "latency_spike": "PaymentsLatencySpike",
            "retry_storm": "CheckoutRetryStorm",
            "auth_failures": "AuthFailureBurst",
            "5xx_burst": "Gateway5xxBurst",
            "queue_backlog": "OrdersQueueBacklog",
            "ingest_waste": "TelemetryIngestWaste",
            "cpu_saturation": "ComputeSaturation",
            "dependency_timeout": "DependencyTimeout",
        }
        title = title_map[scenario]

        base_latency = {
            "latency_spike": 900,
            "retry_storm": 780,
            "auth_failures": 420,
            "5xx_burst": 650,
            "queue_backlog": 500,
            "ingest_waste": 180,
            "cpu_saturation": 360,
            "dependency_timeout": 820,
        }[scenario]
        latency_ms = base_latency + random.randint(0, 240)
        error_rate = round((i % 30) / 10.0, 2)
        confidence = round(0.55 + ((i % 40) / 100.0), 2)

        event_time = now - timedelta(minutes=(total_events - i))
        ts = event_time.strftime("%Y-%m-%dT%H:%M:%SZ")

        line = (
            f"{ts} "
            f"incident_id={incident_id} workflow_id={workflow_id} "
            f"severity={severity} status={status} title={title} "
            f"source_service={service} host={host} env=prod persona={persona} "
            f"scenario={scenario} confidence={confidence} latency_ms={latency_ms} "
            f"error_rate={error_rate} marker={marker}"
        )
        lines.append(line)

    ingest_url = (
        f"{base}/services/receivers/simple?index=tutorial&sourcetype=bitsio:agenticops:live"
    )
    for start in range(0, len(lines), batch_size):
        payload = "\n".join(lines[start : start + batch_size]) + "\n"
        resp = httpx.post(ingest_url, content=payload, headers=headers, verify=False, timeout=120)
        resp.raise_for_status()

    verify_query = (
        f'search index=tutorial marker="{marker}" '
        "| stats count as events dc(incident_id) as incidents dc(source_service) as services "
        "max(latency_ms) as max_latency avg(latency_ms) as avg_latency"
    )
    verify = httpx.post(
        f"{base}/services/search/jobs/export",
        params={"output_mode": "json"},
        data={"search": verify_query, "earliest_time": "-24h", "latest_time": "now"},
        headers=headers,
        verify=False,
        timeout=60,
    )
    verify.raise_for_status()

    print("Massive realistic dataset seeded to index=tutorial")
    print(f"marker={marker}")
    print(f"events={total_events} incidents={incident_count}")
    print("verify:")
    print(verify.text[:1000])
    print("open:")
    print("  http://127.0.0.1:3000/incidents")


if __name__ == "__main__":
    main()
