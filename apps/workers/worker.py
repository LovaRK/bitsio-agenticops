"""
BitsIO AgenticOps — Background Worker
======================================
Pulls jobs from a Redis queue and dispatches them to registered handlers.

Queue key  : bitsio:jobs
Job format : JSON { "job_type": str, "payload": dict, "workflow_id": str }

Supported job types:
  - run_agent   : Run TelemetryValueAgentGraph for an incident
  - rerun_trace : Re-run a previously approved workflow

Usage:
  uv run python apps/workers/worker.py
"""

from __future__ import annotations

import json
import logging
import os
import signal
import sys
import time
from typing import Any

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
log = logging.getLogger("bitsio.worker")

QUEUE_KEY = "bitsio:jobs"
POLL_INTERVAL = float(os.getenv("WORKER_POLL_INTERVAL", "2"))  # seconds
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")


# ---------------------------------------------------------------------------
# Graceful shutdown
# ---------------------------------------------------------------------------
_shutdown = False


def _handle_signal(sig: int, _frame: Any) -> None:
    global _shutdown
    log.info("Received signal %s — shutting down after current job.", sig)
    _shutdown = True


signal.signal(signal.SIGTERM, _handle_signal)
signal.signal(signal.SIGINT, _handle_signal)


# ---------------------------------------------------------------------------
# Job handlers
# ---------------------------------------------------------------------------

def handle_run_agent(payload: dict[str, Any], workflow_id: str) -> None:
    """Run TelemetryValueAgentGraph for an incident from a queue job."""
    from agent_core.graphs.telemetry_value_agent import TelemetryValueAgentGraph
    from agent_core.models.adapter import AnthropicModelAdapter, StubModelAdapter
    from agent_core.state.telemetry_state import TelemetryAgentState
    from splunk_mcp.adapter import SplunkMCPAdapter

    splunk_url = os.getenv("SPLUNK_MCP_URL", "http://localhost:8081")
    splunk_token = os.getenv("SPLUNK_MCP_TOKEN", "")
    api_key = os.getenv("ANTHROPIC_API_KEY", "")

    splunk = SplunkMCPAdapter(base_url=splunk_url, token=splunk_token)
    model = AnthropicModelAdapter() if api_key else StubModelAdapter()
    graph = TelemetryValueAgentGraph(splunk_adapter=splunk, model_adapter=model)

    state = TelemetryAgentState(
        workflow_id=workflow_id,
        raw_incident=payload.get("incident", {}),
    )
    env = payload.get("environment", os.getenv("ENV", "dev"))
    result = graph.run(state, environment=env)

    log.info(
        "workflow_id=%s approval_required=%s confidence=%s",
        workflow_id,
        result.approval_required,
        result.confidence,
    )


def handle_rerun_trace(payload: dict[str, Any], workflow_id: str) -> None:
    """Re-run an existing approved workflow (audit trail re-evaluation)."""
    log.info("rerun_trace workflow_id=%s payload=%s", workflow_id, payload)
    # Delegate to handle_run_agent with existing incident data.
    handle_run_agent(payload, workflow_id)


HANDLERS: dict[str, Any] = {
    "run_agent": handle_run_agent,
    "rerun_trace": handle_rerun_trace,
}


# ---------------------------------------------------------------------------
# Worker loop
# ---------------------------------------------------------------------------

def process_job(raw: str) -> None:
    try:
        job: dict[str, Any] = json.loads(raw)
    except json.JSONDecodeError:
        log.error("Failed to parse job JSON: %r", raw)
        return

    job_type = job.get("job_type", "")
    workflow_id = job.get("workflow_id", "unknown")
    payload: dict[str, Any] = job.get("payload", {})

    handler = HANDLERS.get(job_type)
    if handler is None:
        log.warning("Unknown job_type=%r workflow_id=%s — skipping.", job_type, workflow_id)
        return

    log.info("Processing job_type=%s workflow_id=%s", job_type, workflow_id)
    try:
        handler(payload, workflow_id)
        log.info("Completed job_type=%s workflow_id=%s", job_type, workflow_id)
    except Exception:
        log.exception("Error in job_type=%s workflow_id=%s", job_type, workflow_id)


def run() -> None:
    try:
        import redis as redis_lib
        r = redis_lib.Redis.from_url(REDIS_URL, decode_responses=True)
        r.ping()
        log.info("Connected to Redis at %s", REDIS_URL)
        use_redis = True
    except Exception as exc:
        log.warning("Redis unavailable (%s) — running in no-op poll mode.", exc)
        use_redis = False

    log.info("Worker started. Listening on queue '%s'.", QUEUE_KEY)

    while not _shutdown:
        if use_redis:
            try:
                result = r.blpop(QUEUE_KEY, timeout=int(POLL_INTERVAL))
                if result:
                    _, raw = result
                    process_job(raw)
            except Exception:
                log.exception("Redis error — retrying in %ss.", POLL_INTERVAL)
                time.sleep(POLL_INTERVAL)
        else:
            time.sleep(POLL_INTERVAL)

    log.info("Worker stopped.")


if __name__ == "__main__":
    run()
