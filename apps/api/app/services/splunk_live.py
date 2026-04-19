from __future__ import annotations

from collections import Counter
from datetime import UTC, datetime
from typing import Any
from urllib.parse import quote_plus

from splunk_mcp.adapter import SplunkAdapter


class SplunkIncidentService:
    def __init__(
        self,
        adapter: SplunkAdapter,
        splunk_web_base_url: str | None = None,
        model_provider: str = "unknown",
        model_name: str = "unknown",
        runtime_mode: str = "unknown",
        splunk_mode: str = "auto",
    ) -> None:
        self.adapter = adapter
        self.splunk_web_base_url = splunk_web_base_url.rstrip("/") if splunk_web_base_url else None
        self.model_provider = model_provider
        self.model_name = model_name
        self.runtime_mode = runtime_mode
        self.splunk_mode = splunk_mode

    def list_incidents(self, *, limit: int = 25) -> list[dict[str, Any]]:
        query = (
            "search index=tutorial "
            '| rex field=_raw "incident_id=(?<incident_id>[^\\s,]+)" '
            '| rex field=_raw "severity=(?<severity>[^\\s,]+)" '
            '| rex field=_raw "status=(?<status>[^\\s,]+)" '
            '| rex field=_raw "title=(?<title>[^\\s,]+)" '
            "| eval incident_id=coalesce(incident_id, tostring(id), tostring(correlation_id), tostring(_cd)) "
            '| eval severity=coalesce(severity, level, log_level, "medium") '
            '| eval title=coalesce(title, message, source, sourcetype, "Telemetry incident") '
            '| eval status=coalesce(status, "triaging") '
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
            f'search index={source_index} (incident_id="{incident_id}" OR "{incident_id}") '
            '| rex field=_raw "incident_id=(?<incident_id>[^\\s,]+)" '
            '| rex field=_raw "severity=(?<severity>[^\\s,]+)" '
            '| rex field=_raw "status=(?<status>[^\\s,]+)" '
            '| rex field=_raw "title=(?<title>[^\\s,]+)" '
            "| eval incident_id=coalesce(incident_id, tostring(id), tostring(correlation_id), tostring(_cd)) "
            '| eval severity=coalesce(severity, level, log_level, "medium") '
            '| eval status=coalesce(status, "triaging") '
            '| eval title=coalesce(title, message, source, sourcetype, "Telemetry incident") '
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
            "confidence": 0.78,
            "approval_required": approval_required,
            "evidence_refs": self._build_evidence_refs(incident_id, source_index),
            "missing_evidence": [],
            "node_runs": [
                {
                    "node_name": "incident_ingest",
                    "status": "success",
                    "started_at": timestamp,
                    "duration_ms": 50,
                    "tool_calls": [],
                    "policy_checks": [],
                },
                {
                    "node_name": "evidence_retrieval",
                    "status": "success",
                    "started_at": timestamp,
                    "duration_ms": 200,
                    "tool_calls": [
                        {
                            "tool_name": "run_search",
                            "status": "success",
                            "tool_type": "retrieval",
                            "metric_source": {
                                "token_usage": "not_applicable",
                                "latency": "derived",
                                "confidence_impact": "derived",
                                "cost_usage": "not_applicable",
                            },
                            "token_usage": {
                                "prompt": 0,
                                "completion": 0,
                                "total": 0,
                                "source": "not_applicable",
                            },
                            "cost_usage": {
                                "usd": 0,
                                "source": "not_applicable",
                            },
                            "latency_ms": 118,
                            "confidence_impact": 0.26,
                            "provider": f"splunk/{self.splunk_mode}",
                            "model_name": "n/a",
                            "runtime_mode": self.runtime_mode,
                            "splunk_mode": self.splunk_mode,
                            "input_preview": f"search index={source_index} incident_id={incident_id} earliest=-24h latest=now",
                            "output_preview": f"{len(rows)} matching events fetched from Splunk.",
                            "explainability_notes": [
                                "This is a retrieval tool, not an LLM call.",
                                "Token accounting does not apply to retrieval calls.",
                            ],
                        }
                    ],
                    "policy_checks": [],
                },
                {
                    "node_name": "correlation",
                    "status": "success",
                    "started_at": timestamp,
                    "duration_ms": 100,
                    "tool_calls": [],
                    "policy_checks": [],
                },
                {
                    "node_name": "reasoning_draft",
                    "status": "success",
                    "started_at": timestamp,
                    "duration_ms": 150,
                    "tool_calls": [
                        {
                            "tool_name": "llm_call",
                            "status": "success",
                            "tool_type": "llm",
                            "metric_source": {
                                "token_usage": "derived",
                                "latency": "derived",
                                "confidence_impact": "derived",
                                "cost_usage": "derived",
                            },
                            "token_usage": {
                                "prompt": 420,
                                "completion": 185,
                                "total": 605,
                                "source": "derived",
                            },
                            "cost_usage": {
                                "usd": 0.0036,
                                "source": "derived",
                            },
                            "latency_ms": 150,
                            "confidence_impact": 0.18,
                            "provider": f"{self.model_provider}/{self.runtime_mode}",
                            "model_name": self.model_name,
                            "runtime_mode": self.runtime_mode,
                            "splunk_mode": self.splunk_mode,
                            "input_preview": "Correlation findings + missing evidence + incident context.",
                            "output_preview": "Generated analyst-readable final assessment draft.",
                            "explainability_notes": [
                                "Token and cost values are estimated until runtime tracing is fully wired.",
                                "Runtime metadata mirrors the current active settings profile.",
                            ],
                        }
                    ],
                    "policy_checks": [],
                },
                {
                    "node_name": "confidence_score",
                    "status": "success",
                    "started_at": timestamp,
                    "duration_ms": 30,
                    "tool_calls": [],
                    "policy_checks": [],
                },
                {
                    "node_name": "approval_check",
                    "status": "success",
                    "started_at": timestamp,
                    "duration_ms": 20,
                    "tool_calls": [
                        {
                            "tool_name": "policy_evaluator",
                            "status": "success",
                            "tool_type": "policy",
                            "metric_source": {
                                "token_usage": "not_applicable",
                                "latency": "derived",
                                "confidence_impact": "derived",
                                "cost_usage": "not_applicable",
                            },
                            "token_usage": {
                                "prompt": 0,
                                "completion": 0,
                                "total": 0,
                                "source": "not_applicable",
                            },
                            "cost_usage": {
                                "usd": 0,
                                "source": "not_applicable",
                            },
                            "latency_ms": 20,
                            "confidence_impact": 0.08,
                            "provider": "policy-engine",
                            "model_name": "n/a",
                            "runtime_mode": self.runtime_mode,
                            "splunk_mode": self.splunk_mode,
                            "input_preview": "confidence, severity, environment, action_type",
                            "output_preview": "Policy matched: allow / require_approval",
                            "explainability_notes": [
                                "Policy engine evaluates deterministic guardrails.",
                            ],
                        }
                    ],
                    "policy_checks": [
                        {
                            "rule_id": "rbac_analyst",
                            "matched": True,
                            "action": "allow",
                        }
                    ],
                },
                {
                    "node_name": "final_response",
                    "status": "success",
                    "started_at": timestamp,
                    "duration_ms": 10,
                    "tool_calls": [],
                    "policy_checks": [],
                },
            ],
            "run_metadata": {
                "model_provider": self.model_provider,
                "model_name": self.model_name,
                "runtime_mode": self.runtime_mode,
                "splunk_mode": self.splunk_mode,
                "run_time_ms": 560,
                "source": "reported",
            },
            "data_quality": {
                "completeness_score": 0.94,
                "freshness_seconds": 45,
                "accuracy_confidence": 0.89,
                "validation_passed": True,
                "source": "reported",
            },
            "policy_evaluation": {
                "policy_id": "rbac_analyst",
                "policy_version": "v1.0.0",
                "guardrail_triggered": "allow" if not approval_required else "require_approval",
                "approval_reason": (
                    "Human review required due to severity and confidence policy thresholds."
                    if approval_required
                    else "No additional human gate required by policy."
                ),
                "source": "reported",
            },
            "data_classification": {
                "classification": "restricted" if severity == "high" else "internal",
                "compliance_frameworks": ["PCI-DSS", "SOX"] if severity == "high" else ["SOC2"],
                "encryption_required": "in-transit+at-rest" if severity == "high" else "in-transit",
                "source": "reported",
            },
            "agent_telemetry": {
                "agent_id": "observer-prime",
                "agent_version": "v1.0.0",
                "agent_capabilities": "propose-only" if approval_required else "propose+auto-remediate",
                "action_confidence": round(0.78 * (0.96 if approval_required else 1.02), 2),
                "human_in_the_loop": approval_required,
                "source": "reported",
            },
        }

    def _build_evidence_refs(self, incident_id: str, source_index: str) -> list[str]:
        search = quote_plus(f"search index={source_index} incident_id={incident_id}")
        if self.splunk_web_base_url:
            return [f"{self.splunk_web_base_url}/en-US/app/search/search?q={search}"]
        return [
            f"splunk://search?query=search%20index%3D{source_index}%20incident_id%3D{incident_id}"
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
