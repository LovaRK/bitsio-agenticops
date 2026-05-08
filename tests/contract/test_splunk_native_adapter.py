from __future__ import annotations

import json

import httpx

from splunk_mcp.adapter import NativeSplunkAdapter


def _transport() -> httpx.MockTransport:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/services/data/indexes":
            return httpx.Response(
                200,
                json={
                    "entry": [
                        {
                            "name": "tutorial",
                            "content": {"totalEventCount": "12", "totalSizeMB": "42.5"},
                        }
                    ]
                },
            )

        if request.url.path == "/services/server/info":
            return httpx.Response(
                200,
                json={
                    "entry": [
                        {
                            "content": {
                                "version": "9.3.1",
                                "build": "abc123",
                                "server_roles": "enterprise",
                            }
                        }
                    ]
                },
            )

        if request.url.path == "/services/search/jobs/export":
            ndjson = "\n".join(
                [
                    json.dumps({"result": {"incident_id": "inc_1", "severity": "high"}}),
                    json.dumps({"messages": [{"type": "INFO", "text": "search completed"}]}),
                ]
            )
            return httpx.Response(200, text=ndjson)

        return httpx.Response(404, text="not found")

    return httpx.MockTransport(handler)


def test_native_list_indexes_contract() -> None:
    adapter = NativeSplunkAdapter("https://localhost:8089/services/mcp", transport=_transport())
    indexes = adapter.list_indexes()

    assert len(indexes) == 1
    assert indexes[0].name == "tutorial"
    assert indexes[0].event_count == 12
    assert indexes[0].size_mb == 42.5


def test_native_run_search_contract() -> None:
    adapter = NativeSplunkAdapter("https://localhost:8089", transport=_transport())
    result = adapter.run_search("search index=tutorial | head 1", "-15m", "now")

    assert result.done is True
    assert len(result.results) == 1
    assert result.results[0]["incident_id"] == "inc_1"
    assert "search completed" in " ".join(result.messages)


def test_native_server_info_contract() -> None:
    adapter = NativeSplunkAdapter("https://localhost:8089", transport=_transport())
    info = adapter.get_server_info()

    assert info.version == "9.3.1"
    assert info.build == "abc123"
    assert info.mode == "enterprise"
