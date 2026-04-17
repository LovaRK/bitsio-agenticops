from __future__ import annotations

from fastapi.testclient import TestClient

from apps.api.app.main import create_app


def _client() -> TestClient:
    app = create_app()
    return TestClient(app)


def _headers() -> dict[str, str]:
    return {"x-api-key": "dev-analyst"}


def test_enrich_returns_200_with_enriched_payload() -> None:
    client = _client()
    response = client.post(
        "/api/v1/incidents/inc_20260408_42/enrich",
        headers=_headers(),
        json={"force_refresh": True},
    )
    assert response.status_code == 200
    payload = response.json()
    assert "enriched_incident" in payload
    assert payload["incident_id"] == "inc_20260408_42"


def test_enrich_returns_404_for_unknown_incident() -> None:
    client = _client()
    response = client.post(
        "/api/v1/incidents/inc_unknown/enrich",
        headers=_headers(),
        json={"force_refresh": True},
    )
    assert response.status_code == 404


def test_enrich_returns_422_on_invalid_request_body() -> None:
    client = _client()
    response = client.post(
        "/api/v1/incidents/inc_20260408_42/enrich",
        headers=_headers(),
        json={"force_refresh": "nope"},
    )
    assert response.status_code == 422


def test_enrich_returns_cached_result_when_force_refresh_false() -> None:
    client = _client()
    first = client.post(
        "/api/v1/incidents/inc_20260408_42/enrich",
        headers=_headers(),
        json={"force_refresh": True},
    )
    assert first.status_code == 200

    second = client.post(
        "/api/v1/incidents/inc_20260408_42/enrich",
        headers=_headers(),
        json={"force_refresh": False},
    )
    assert second.status_code == 200
    assert second.json().get("cached") is True


def test_enrich_creates_decision_trace_record() -> None:
    client = _client()
    response = client.post(
        "/api/v1/incidents/inc_20260408_43/enrich",
        headers=_headers(),
        json={"force_refresh": True},
    )
    assert response.status_code == 200


def test_enrich_propagates_otel_workflow_id() -> None:
    client = _client()
    response = client.post(
        "/api/v1/incidents/inc_20260408_44/enrich",
        headers=_headers(),
        json={"force_refresh": True},
    )
    assert response.status_code == 200
    assert response.json()["workflow_id"].startswith("wf_")
