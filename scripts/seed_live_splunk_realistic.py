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


def _post_search(base_url: str, headers: dict[str, str], query: str) -> httpx.Response:
    return httpx.post(
        f"{base_url}/services/search/jobs/export",
        params={"output_mode": "json"},
        data={"search": query, "earliest_time": "-24h", "latest_time": "now"},
        headers=headers,
        verify=False,
        timeout=90,
    )


def main() -> None:
    repo_root = Path(__file__).resolve().parents[1]
    load_dotenv(repo_root / ".env")

    base_url = os.getenv("SPLUNK_MCP_BASE_URL", "https://localhost:8089").rstrip("/")
    auth_scheme = os.getenv("SPLUNK_AUTH_SCHEME", "Bearer").strip() or "Bearer"
    token = _require("SPLUNK_MCP_TOKEN")

    # Native endpoint for write path.
    if base_url.endswith("/services/mcp"):
        base_url = base_url.removesuffix("/services/mcp")

    headers = {"Authorization": f"{auth_scheme} {token}"}

    seed_id = int(time.time())
    marker = f"bitsio_realistic_seed_{seed_id}"

    # 240 events / 8 incident threads / mixed severities, services, outcomes.
    ingest_query = (
        "| makeresults count=240 "
        "| streamstats count as n "
        "| eval idx=n-1 "
        f'| eval seed_marker="{marker}" '
        '| eval incident_num=tostring(floor(idx/30)+1, "hex") '
        f'| eval incident_id="inc_live_{seed_id}_" . incident_num '
        '| eval workflow_id="wf_" . incident_id '
        '| eval source_service=mvindex(split("payments-api,checkout-api,auth-api,orders-api,inventory-api,gateway-api,billing-worker,fraud-engine", ","), idx%8) '
        '| eval host=source_service . "-" . tostring((idx%4)+1) '
        '| eval env=if(idx%10<8, "prod", "staging") '
        '| eval persona=case(idx%6=0,"SRE", idx%6=1,"OnCall", idx%6=2,"FinOps", idx%6=3,"SOC", idx%6=4,"Platform", true(),"Analyst") '
        '| eval scenario=case(idx%7=0,"latency_spike", idx%7=1,"retry_storm", idx%7=2,"auth_failures", idx%7=3,"5xx_burst", idx%7=4,"queue_backlog", idx%7=5,"ingest_waste", true(),"cpu_saturation") '
        '| eval severity=case(scenario="5xx_burst" OR scenario="retry_storm","high", scenario="auth_failures" OR scenario="queue_backlog","medium", true(),"low") '
        '| eval status=case(severity="high" AND idx%3=0,"pending_approval", severity="high","triaging", idx%5=0,"resolved", true(),"triaging") '
        "| eval confidence=round(0.55 + ((idx%40)/100), 2) "
        '| eval latency_ms=case(scenario="latency_spike", 900 + (idx%250), scenario="retry_storm", 650 + (idx%200), scenario="5xx_burst", 500 + (idx%120), true(), 110 + (idx%180)) '
        "| eval error_rate=round((idx%30)/10, 2) "
        "| eval ingest_mb=round(120 + (idx%160)*1.7, 2) "
        "| eval used_kos=idx%12 "
        '| eval title=case(scenario="latency_spike","PaymentsLatencySpike", scenario="retry_storm","CheckoutRetryStorm", scenario="auth_failures","AuthFailureBurst", scenario="5xx_burst","Gateway5xxBurst", scenario="queue_backlog","OrdersQueueBacklog", scenario="ingest_waste","TelemetryIngestWaste", true(),"ComputeSaturation") '
        '| eval probable_cause=case(scenario="latency_spike","db_pool_exhaustion", scenario="retry_storm","downstream_timeout", scenario="auth_failures","token_key_rotation", scenario="5xx_burst","upstream_dependency_error", scenario="queue_backlog","consumer_lag", scenario="ingest_waste","unused_sourcetype_ingest", true(),"cpu_pressure") '
        '| eval recommendation=case(status="pending_approval","Require human gate before rollback", scenario="ingest_waste","Reduce ingest volume for unused sourcetypes", scenario="queue_backlog","Scale workers and drain queue", true(),"Continue automated triage") '
        '| eval trace_id="trace_" . tostring(seed_marker) . "_" . tostring(idx) '
        '| eval _time=relative_time(now(), "-" . tostring(240-idx) . "m") '
        '| eval _raw="incident_id=" . incident_id . " workflow_id=" . workflow_id . " severity=" . severity . " status=" . status . " title=" . title . " source_service=" . source_service . " host=" . host . " env=" . env . " scenario=" . scenario . " persona=" . persona . " confidence=" . tostring(confidence) . " latency_ms=" . tostring(latency_ms) . " error_rate=" . tostring(error_rate) . " ingest_mb=" . tostring(ingest_mb) . " used_kos=" . tostring(used_kos) . " probable_cause=" . probable_cause . " recommendation=" . recommendation . " trace_id=" . trace_id . " marker=" . seed_marker '
        "| collect index=tutorial sourcetype=bitsio:agenticops:live"
    )

    write_resp = _post_search(base_url, headers, ingest_query)
    write_resp.raise_for_status()

    verify_query = (
        f'search index=tutorial marker="{marker}" '
        "| stats count as events dc(incident_id) as incidents dc(source_service) as services max(latency_ms) as max_latency"
    )
    verify_resp = _post_search(base_url, headers, verify_query)
    verify_resp.raise_for_status()

    print("Seeded realistic data into index=tutorial")
    print(f"marker={marker}")
    print("Open in app:")
    print("  http://127.0.0.1:3000/incidents")
    print("Sample Splunk query:")
    print(f'  index=tutorial marker="{marker}" | head 20')


if __name__ == "__main__":
    main()
