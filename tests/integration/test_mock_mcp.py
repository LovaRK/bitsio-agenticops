from fastapi.testclient import TestClient

from apps.mock_mcp.app.main import app

client = TestClient(app)


def test_baseline_returns_200_for_known_service() -> None:
    response = client.get("/api/v1/baselines/payment-service")
    assert response.status_code == 200
    payload = response.json()
    assert "stddev" in payload


def test_baseline_returns_404_for_unknown_service() -> None:
    response = client.get("/api/v1/baselines/unknown-service")
    assert response.status_code == 404


def test_baseline_stddev_scales_with_lookback() -> None:
    short = client.get("/api/v1/baselines/auth-service", params={"lookback_days": 7}).json()
    long = client.get("/api/v1/baselines/auth-service", params={"lookback_days": 365}).json()
    assert long["stddev"]["latency_p95"] > short["stddev"]["latency_p95"]
