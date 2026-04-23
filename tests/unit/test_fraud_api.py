from __future__ import annotations

from fastapi.testclient import TestClient

from apps.api.app.dependencies import get_splunk_adapter_native_default
from apps.api.app.main import app
from packages.shared.config.settings import get_settings
from splunk_mcp.dtos import IndexDTO, SearchResultDTO, ServerInfoDTO


class DummyLiveAdapter:
    def list_indexes(self) -> list[IndexDTO]:
        return [IndexDTO(name="tutorial", size_mb=128.0, event_count=5000)]

    def run_search(self, query: str, earliest: str, latest: str) -> SearchResultDTO:
        _ = (query, earliest, latest)
        return SearchResultDTO(
            results=[
                {
                    "incident_id": "inc_live_1",
                    "vendor": "acme-payments",
                    "user": "finance.user.11",
                    "amount": "94250",
                    "event_count": "9",
                    "_time": "2026-04-18T10:00:00Z",
                    "index": "tutorial",
                }
            ],
            messages=[],
            done=True,
        )

    def get_server_info(self) -> ServerInfoDTO:
        return ServerInfoDTO(version="10.2.2", build="abc", mode="enterprise")

    def explain_error(self, raw_error: dict) -> dict:
        return raw_error


client = TestClient(app)


def test_fraud_demo_returns_seed_payload() -> None:
    response = client.get("/api/v1/fraud/demo", headers={"x-api-key": "dev-analyst"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["mode"] == "seed"
    assert payload["summary"]["open_cases"] >= 1
    assert payload["policy_evaluation"]["policy_id"] == "fraud-risk-approval-policy"


def test_fraud_overview_seed_mode() -> None:
    response = client.get("/api/v1/fraud/overview?mode=seed", headers={"x-api-key": "dev-analyst"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["mode"] == "seed"
    assert len(payload["active_cases"]) >= 1


def test_fraud_overview_live_uses_adapter_override() -> None:
    app.dependency_overrides[get_splunk_adapter_native_default] = lambda: DummyLiveAdapter()
    try:
        response = client.get(
            "/api/v1/fraud/overview?mode=live",
            headers={"x-api-key": "dev-analyst"},
        )
    finally:
        app.dependency_overrides.pop(get_splunk_adapter_native_default, None)

    assert response.status_code == 200
    payload = response.json()
    assert payload["mode"] == "live"
    assert payload["summary"]["open_cases"] >= 1
    assert payload["active_cases"][0]["vendor"] == "acme-payments"


def test_fraud_analyze_live_requires_live_mode(monkeypatch) -> None:
    monkeypatch.setenv("SPLUNK_LIVE_MODE", "false")
    get_settings.cache_clear()
    response = client.post("/api/v1/fraud/analyze/live", headers={"x-api-key": "dev-analyst"})
    assert response.status_code == 400


def test_fraud_analyze_live_success(monkeypatch) -> None:
    monkeypatch.setenv("SPLUNK_LIVE_MODE", "true")
    get_settings.cache_clear()
    app.dependency_overrides[get_splunk_adapter_native_default] = lambda: DummyLiveAdapter()
    try:
        response = client.post("/api/v1/fraud/analyze/live", headers={"x-api-key": "dev-analyst"})
    finally:
        app.dependency_overrides.pop(get_splunk_adapter_native_default, None)
        monkeypatch.delenv("SPLUNK_LIVE_MODE", raising=False)
        get_settings.cache_clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["mode"] == "live"
    assert payload["summary"]["high_risk_cases"] >= 1
