from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from apps.api.app.middleware.rate_limit import install_rate_limit_middleware


def _build_test_app(limit: int) -> FastAPI:
    app = FastAPI()
    install_rate_limit_middleware(
        app,
        rate_limit_per_minute=limit,
        redis_url=None,
        default_tenant="tenant_demo",
    )

    @app.get("/probe")
    def probe() -> dict[str, str]:
        return {"ok": "true"}

    return app


def test_rate_limit_blocks_after_threshold_for_same_tenant() -> None:
    app = _build_test_app(limit=2)
    client = TestClient(app)
    headers = {"x-tenant-id": "tenant_a"}

    first = client.get("/probe", headers=headers)
    second = client.get("/probe", headers=headers)
    third = client.get("/probe", headers=headers)

    assert first.status_code == 200
    assert second.status_code == 200
    assert third.status_code == 429
    assert third.json()["detail"] == "rate_limit_exceeded"


def test_rate_limit_isolated_per_tenant() -> None:
    app = _build_test_app(limit=2)
    client = TestClient(app)

    assert client.get("/probe", headers={"x-tenant-id": "tenant_a"}).status_code == 200
    assert client.get("/probe", headers={"x-tenant-id": "tenant_a"}).status_code == 200
    assert client.get("/probe", headers={"x-tenant-id": "tenant_a"}).status_code == 429

    # A separate tenant should still have its own capacity.
    assert client.get("/probe", headers={"x-tenant-id": "tenant_b"}).status_code == 200

