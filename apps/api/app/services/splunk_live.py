from __future__ import annotations

from typing import Any

from apps.api.app.services.incident_trace_assembly import (
    build_decision_trace_from_rows,
    extract_int,
    extract_text,
    extract_time,
    normalize_incident_id,
    normalize_severity,
    normalize_status,
)
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
            incident_id = extract_text(row, "incident_id", default="unknown-incident")
            severity = normalize_severity(extract_text(row, "severity", default="medium"))
            status = normalize_status(extract_text(row, "status", default="triaging"))
            incidents.append(
                {
                    "id": incident_id,
                    "title": extract_text(row, "title", default=f"Incident {incident_id}"),
                    "severity": severity,
                    "status": status,
                    "timestamp": extract_time(row.get("latest_time")),
                    "source": extract_text(row, "source_index", default="tutorial"),
                    "event_count": extract_int(row.get("event_count"), default=0),
                }
            )

        return incidents

    def get_decision_trace(self, incident_ref: str) -> dict[str, Any]:
        incident_id = normalize_incident_id(incident_ref)
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
        return build_decision_trace_from_rows(
            rows=rows,
            incident_ref=incident_ref,
            source_index=source_index,
            model_provider=self.model_provider,
            model_name=self.model_name,
            runtime_mode=self.runtime_mode,
            splunk_mode=self.splunk_mode,
            splunk_web_base_url=self.splunk_web_base_url,
        )
