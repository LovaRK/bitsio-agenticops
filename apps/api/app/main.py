"""FastAPI application factory and router setup."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from apps.api.app.middleware.otel import instrument_fastapi
from apps.api.app.middleware.rate_limit import install_rate_limit_middleware
from apps.api.app.routers import (
    approvals,
    dashboard,
    decision_traces,
    fraud,
    incident_context,
    incidents,
    monitoring,
    settings,
    support,
    waste,
)
from packages.shared.config.settings import get_settings


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(title="BitsIO AgenticOps API", version="0.1.0")
    cfg = get_settings()

    # CORS configuration
    _web_base = cfg.web_base_url.rstrip("/")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            _web_base,
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Observability middleware
    instrument_fastapi(app)
    install_rate_limit_middleware(
        app,
        rate_limit_per_minute=cfg.rate_limit_per_minute,
        redis_url=cfg.redis_url,
        default_tenant=cfg.tenant_safe_id,
    )

    # Include routers
    app.include_router(incidents.router)
    app.include_router(decision_traces.router)
    app.include_router(incident_context.router)
    app.include_router(approvals.router)
    app.include_router(dashboard.router)
    app.include_router(monitoring.router)
    app.include_router(fraud.router)
    app.include_router(settings.router)
    app.include_router(support.router)
    app.include_router(waste.router)

    # Health endpoint
    @app.get("/health")
    def health() -> dict:
        """Health check endpoint."""
        return {"status": "ok", "time": datetime.now(tz=UTC).isoformat()}

    return app


app = create_app()
