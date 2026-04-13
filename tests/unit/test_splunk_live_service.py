from __future__ import annotations

from apps.api.app.services.splunk_live import SplunkIncidentService
from splunk_mcp.dtos import SearchResultDTO


class _FakeAdapter:
    def __init__(self) -> None:
        self.last_query = ""

    def run_search(self, query: str, earliest: str, latest: str) -> SearchResultDTO:
        self.last_query = query
        if "stats latest(_time)" in query:
            return SearchResultDTO(
                done=True,
                results=[
                    {
                        "incident_id": "inc_99231",
                        "title": "Payments timeout burst",
                        "severity": "high",
                        "status": "triaging",
                        "latest_time": "1712800000",
                        "source_index": "tutorial",
                        "event_count": "14",
                    }
                ],
            )
        return SearchResultDTO(
            done=True,
            results=[
                {
                    "_time": "1712800010",
                    "incident_id": "inc_99231",
                    "severity": "high",
                    "host": "api-1",
                },
                {
                    "_time": "1712800011",
                    "incident_id": "inc_99231",
                    "severity": "high",
                    "host": "api-1",
                },
                {
                    "_time": "1712800013",
                    "incident_id": "inc_99231",
                    "severity": "high",
                    "host": "api-2",
                },
            ],
        )


def test_list_incidents_from_splunk_rows() -> None:
    service = SplunkIncidentService(adapter=_FakeAdapter())
    items = service.list_incidents(limit=10)

    assert len(items) == 1
    assert items[0]["id"] == "inc_99231"
    assert items[0]["severity"] == "high"
    assert items[0]["source"] == "tutorial"


def test_decision_trace_shape_from_live_results() -> None:
    service = SplunkIncidentService(
        adapter=_FakeAdapter(), splunk_web_base_url="http://144.202.48.85:8000"
    )
    trace = service.get_decision_trace("99231")

    assert trace["incident_id"] == "inc_99231"
    assert trace["workflow_id"] == "wf_inc_99231"
    assert trace["approval_required"] is True
    assert trace["status"] in {"pending_approval", "triaging"}
    assert trace["evidence_refs"][0].startswith("http://144.202.48.85:8000")
    # Verify shape: no fabricated data (node_runs, confidence, assigned_agent)
    assert "node_runs" not in trace
    assert "confidence" not in trace
    assert "assigned_agent" not in trace
