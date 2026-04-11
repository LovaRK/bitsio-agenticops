from __future__ import annotations

import json
from pathlib import Path

import httpx
import pytest

from splunk_mcp.adapter import SplunkMCPAdapter

FIXTURE_DIR = Path(__file__).parent.parent / "fixtures" / "splunk_mcp"


def _fixture(name: str) -> dict:
    return json.loads((FIXTURE_DIR / f"{name}.json").read_text(encoding="utf-8"))


def _transport() -> httpx.MockTransport:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/list_indexes":
            return httpx.Response(200, json=_fixture("list_indexes"))
        if request.url.path == "/run_search":
            return httpx.Response(200, json=_fixture("run_search"))
        if request.url.path == "/server_info":
            return httpx.Response(200, json=_fixture("server_info"))
        return httpx.Response(404, json={"code": "404", "message": "not found"})

    return httpx.MockTransport(handler)


def test_list_indexes_contract() -> None:
    adapter = SplunkMCPAdapter("http://mock", transport=_transport())
    indexes = adapter.list_indexes()

    assert len(indexes) == 2
    assert indexes[0].name == "tutorial"


def test_run_search_contract() -> None:
    adapter = SplunkMCPAdapter("http://mock", transport=_transport())
    result = adapter.run_search("search index=tutorial", "-15m", "now")

    assert result.done is True
    assert len(result.messages) >= 1


def test_get_server_info_contract() -> None:
    adapter = SplunkMCPAdapter("http://mock", transport=_transport())
    info = adapter.get_server_info()

    assert info.mode == "enterprise"


def test_explain_error_contract() -> None:
    adapter = SplunkMCPAdapter("http://mock", transport=_transport())
    retryable = adapter.explain_error({"code": "503", "message": "down"})
    assert retryable.retryable is True

    not_retryable = adapter.explain_error({"code": "400", "message": "bad"})
    assert not_retryable.retryable is False


@pytest.mark.parametrize("code", [429, 503, 504])
def test_retryable_status_mapping(code: int) -> None:
    adapter = SplunkMCPAdapter("http://mock", transport=_transport())
    error = adapter.explain_error({"code": str(code), "message": "temp"})
    assert error.retryable is True
