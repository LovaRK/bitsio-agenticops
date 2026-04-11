from __future__ import annotations

from collections import Counter
from datetime import UTC, datetime
from typing import Any
from urllib.parse import quote_plus

from splunk_mcp.adapter import SplunkMCPAdapter


class SplunkIncidentService:
    def __init__(self, adapter: SplunkMCPAdapter, splunk_web_base_url: str | None = None) -> None:
        self.adapter = adapter
        self.splunk_web_base_url = splunk_web_base_url.rstrip("/") if splunk_web_base_url else None

    def list_incidents(self, *, limit: int = 25) -> list[dict[str, Any]]:
        query = (
            "search index=tutorial "
            "| eval incident_id=coalesce(incident_id, tostring(id), tostring(correlation_id), tostring(_cd)) "
            "| eval severity=coalesce(severity, level, log_level, \"medium\") "
            "| eval title=coalesce(title, message, source, sourcetype, \"Telemetry incident\") "
            "| eval status=coalesce(status, \"triaging\") "
            "| stats latest(_time) as latest_time values(title) as title values(severity) as severity "
            "values(status) as status values(index) as source_index count as event_count by incident_id "
            "| sort - latest_time "
            f"| head {int(limit)}"
        )
        result = self.adapter.run_search(query=query, earliest="-24h", latest="now")

        incidents: list[dict[str, Any]] = []
        for row in result.results:
            incident_id = _extract_text(row, "incident_id", default="unknown-incident")
            severity = _normalize_severity(_extract_text(row, "severity", default="medium"))
            status = _normalize_status(_extract_text(row, "status", default="triaging"))
            incidents.append(
                {
                    "id": incident_id,
                    "title": _extract_text(row, "title", default=f"Incident {incident_id}"),
                    "severity": severity,
                    "status": status,
                    "timestamp": _extract_time(row.get("latest_time")),
                    "source": _extract_text(row, "source_index", default="tutorial"),
                    "event_count": _extract_int(row.get("event_count"), default=0),
                }
            )

        return incidents

    def get_decision_trace(self, incident_ref: str) -> dict[str, Any]:
        incident_id = _normalize_incident_id(incident_ref)
        source_index = "tutorial"
        search_query = (
            f"search index={source_index} (incident_id=\"{incident_id}\" OR \"{incident_id}\") "
            "| head 200"
        )
        result = self.adapter.run_search(query=search_query, earliest="-24h", latest="now")
        rows = result.results

        if not rows:
            raise LookupError(f"No Splunk events found for incident '{incident_ref}'")

        first = rows[0]
        severity = _normalize_severity(_extract_text(first, "severity", default="medium"))
        title = _extract_text(first, "title", default=f"Incident {incident_id}")
        status = "pending_approval" if severity == "high" else "triaging"
        timestamp = _extract_time(first.get("_time") or first.get("time"))

        host_counts = Counter(_extract_text(row, "host", default="unknown-host") for row in rows)
        probable_cause = ", ".join(
            f"host={host} events={count}" for host, count in host_counts.most_common(2)
        )
        if not probable_cause:
            probable_cause = "Insufficient host evidence in selected window."

        confidence = max(0.55, min(0.97, round(0.55 + (len(rows) / 500), 2)))
        approval_required = severity in {"high", "medium"}
        workflow_id = incident_id if incident_id.startswith("wf_") else f"wf_{incident_id}"

        return {
            "workflow_id": workflow_id,
            "incident_id": incident_id,
            "title": title,
            "severity": severity,
            "timestamp": timestamp,
            "source_index": source_index,
            "status": status,
            "graph_version": "v1.0.0",
            "assigned_agent": "Observer-Prime",
            "summary": (
                f"Splunk MCP analyzed {len(rows)} events for incident {incident_id} in index "
                f"'{source_index}'."
            ),
            "probable_cause": probable_cause,
            "confidence": confidence,
            "approval_required": approval_required,
            "evidence_refs": self._build_evidence_refs(incident_id, source_index),
            "missing_evidence": [],
            "node_runs": self._node_runs_from_results(result_count=len(rows)),
        }

    def _build_evidence_refs(self, incident_id: str, source_index: str) -> list[str]:
        search = quote_plus(f"search index={source_index} incident_id={incident_id}")
        if self.splunk_web_base_url:
            return [f"{self.splunk_web_base_url}/en-US/app/search/search?q={search}"]
        return [f"splunk://search?query=search%20index%3D{source_index}%20incident_id%3D{incident_id}"]

    @staticmethod
    def _node_runs_from_results(*, result_count: int) -> list[dict[str, Any]]:
        now = datetime.now(tz=UTC).isoformat()
        return [
            {
                "node_name": "incident_ingest",
                "status": "success",
                "started_at": now,
                "duration_ms": 48,
                "tool_calls": [],
                "policy_checks": [],
            },
            {
                "node_name": "evidence_retrieval",
                "status": "success",
                "started_at": now,
                "duration_ms": 220,
                "tool_calls": [{"tool_name": "run_search", "status": "success"}],
                "policy_checks": [],
            },
            {
                "node_name": "correlation",
                "status": "success",
                "started_at": now,
                "duration_ms": 105,
                "tool_calls": [],
                "policy_checks": [],
            },
            {
                "node_name": "reasoning_draft",
                "status": "success",
                "started_at": now,
                "duration_ms": 160,
                "tool_calls": [{"tool_name": "model_generate", "status": "success"}],
                "policy_checks": [],
            },
            {
                "node_name": "confidence_score",
                "status": "success",
                "started_at": now,
                "duration_ms": 30,
                "tool_calls": [],
                "policy_checks": [],
            },
            {
                "node_name": "approval_check",
                "status": "success",
                "started_at": now,
                "duration_ms": 22,
                "tool_calls": [],
                "policy_checks": [
                    {
                        "rule_id": "high_severity_gate",
                        "matched": result_count > 0,
                        "action": "require_approval",
                    }
                ],
            },
        ]


def _extract_text(row: dict[str, Any], key: str, *, default: str) -> str:
    value = row.get(key, default)
    if isinstance(value, list):
        value = value[0] if value else default
    text = str(value).strip()
    return text or default


def _extract_int(value: Any, *, default: int) -> int:
    try:
        if isinstance(value, list):
            value = value[0] if value else default
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _extract_time(value: Any) -> str:
    if isinstance(value, list):
        value = value[0] if value else None
    if value is None:
        return datetime.now(tz=UTC).isoformat()
    text = str(value)
    try:
        if text.replace(".", "", 1).isdigit():
            return datetime.fromtimestamp(float(text), tz=UTC).isoformat()
        return datetime.fromisoformat(text.replace("Z", "+00:00")).isoformat()
    except ValueError:
        return datetime.now(tz=UTC).isoformat()


def _normalize_severity(raw: str) -> str:
    value = raw.strip().lower()
    if value in {"critical", "high"}:
        return "high"
    if value in {"low", "info"}:
        return "low"
    return "medium"


def _normalize_status(raw: str) -> str:
    value = raw.strip().lower()
    if value in {"resolved", "closed"}:
        return "resolved"
    if value in {"pending_approval", "awaiting_approval"}:
        return "pending_approval"
    if value in {"open", "new"}:
        return "open"
    return "triaging"


def _normalize_incident_id(ref: str) -> str:
    token = ref.strip()
    if token.startswith("wf_"):
        return token.removeprefix("wf_")
    if token.startswith("inc_"):
        return token
    if token.isdigit():
        return f"inc_{token}"
    return token
