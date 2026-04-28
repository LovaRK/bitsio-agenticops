"""FastAPI application factory and router setup."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from apps.api.app.middleware.otel import instrument_fastapi
from apps.api.app.middleware.rate_limit import install_rate_limit_middleware
from apps.api.app.routers import (
    approvals,
    conversations,
    dashboard,
    decision_traces,
    feedback,
    fraud,
    fraud_batch,
    incident_context,
    incidents,
    incidents_batch,
    monitoring,
    settings,
    support,
    waste,
)
from packages.shared.config.settings import get_settings

log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Wire persistent resources into app.state at startup, release at shutdown."""
    cfg = get_settings()

    # ── Decision trace store ──────────────────────────────────────────────────
    from decision_tracing.store import InMemoryDecisionTraceStore

    store: object
    try:
        from decision_tracing.pg_store import PostgresDecisionTraceStore

        # asyncpg uses postgresql:// not postgresql+asyncpg://
        dsn = cfg.database_url.replace("postgresql+asyncpg://", "postgresql://").replace(
            "postgresql+psycopg://", "postgresql://"
        )
        pg_store = PostgresDecisionTraceStore(dsn=dsn)
        await pg_store.connect()
        store = pg_store
        log.info("lifespan: using PostgresDecisionTraceStore")
    except Exception as exc:  # noqa: BLE001
        log.warning("lifespan: Postgres unavailable (%s) — falling back to InMemoryDecisionTraceStore", exc)
        store = InMemoryDecisionTraceStore()

    app.state.trace_store = store

    # ── Redis client ──────────────────────────────────────────────────────────
    redis_client = None
    try:
        from redis.asyncio import Redis

        redis_client = Redis.from_url(cfg.redis_url, decode_responses=True)
        await redis_client.ping()
        log.info("lifespan: Redis connected at %s", cfg.redis_url)
    except Exception as exc:  # noqa: BLE001
        log.warning("lifespan: Redis unavailable (%s) — enrich cache will be in-process", exc)
        redis_client = None

    app.state.redis = redis_client

    # ── Conversation store ────────────────────────────────────────────────────
    from apps.api.app.services.conversation_service import (
        InMemoryConversationStore,
        PostgresConversationStore,
    )

    conv_store: object
    try:
        if hasattr(store, "_pool") and store._pool is not None:  # type: ignore[union-attr]
            conv_store = PostgresConversationStore(pool=store._pool)  # type: ignore[union-attr]
            log.info("lifespan: using PostgresConversationStore")
        else:
            raise RuntimeError("no pg pool")
    except Exception as exc:  # noqa: BLE001
        log.warning("lifespan: conversation store falling back to in-memory (%s)", exc)
        conv_store = InMemoryConversationStore()

    app.state.conversation_store = conv_store

    # ── Feedback store ────────────────────────────────────────────────────────
    from apps.api.app.services.feedback_service import (
        InMemoryFeedbackStore,
        PostgresFeedbackStore,
    )

    fb_store: object
    try:
        if hasattr(store, "_pool") and store._pool is not None:  # type: ignore[union-attr]
            fb_store = PostgresFeedbackStore(pool=store._pool)  # type: ignore[union-attr]
            log.info("lifespan: using PostgresFeedbackStore")
        else:
            raise RuntimeError("no pg pool")
    except Exception as exc:  # noqa: BLE001
        log.warning("lifespan: feedback store falling back to in-memory (%s)", exc)
        fb_store = InMemoryFeedbackStore()

    app.state.feedback_store = fb_store

    yield

    # ── Shutdown ──────────────────────────────────────────────────────────────
    if hasattr(store, "close"):
        await store.close()  # type: ignore[union-attr]
    if redis_client is not None:
        await redis_client.aclose()
    log.info("lifespan: shutdown complete")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(title="BitsIO AgenticOps API", version="0.1.0", lifespan=lifespan)
    cfg = get_settings()

    # CORS
    _web_base = cfg.web_base_url.rstrip("/")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[_web_base, "http://localhost:3000", "http://127.0.0.1:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    instrument_fastapi(app)
    install_rate_limit_middleware(
        app,
        rate_limit_per_minute=cfg.rate_limit_per_minute,
        redis_url=cfg.redis_url,
        default_tenant=cfg.tenant_safe_id,
    )

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
    app.include_router(conversations.router)
    app.include_router(feedback.router)
    app.include_router(fraud_batch.router)
    app.include_router(incidents_batch.router)

    @app.get("/health")
    async def health() -> dict:
        """Health check with liveness probes for DB, Redis, and Splunk tunnel."""
        status = "ok"
        checks: dict[str, str] = {}

        # DB liveness
        store = getattr(app.state, "trace_store", None)
        if store is None:
            checks["db"] = "not_initialized"
            status = "degraded"
        elif hasattr(store, "_pool") and store._pool is not None:  # type: ignore[union-attr]
            try:
                async with store._pool.acquire() as conn:  # type: ignore[union-attr]
                    await conn.fetchval("SELECT 1")
                checks["db"] = "ok"
            except Exception:
                checks["db"] = "error"
                status = "degraded"
        else:
            checks["db"] = "in_memory"

        # Redis liveness
        redis = getattr(app.state, "redis", None)
        if redis is None:
            checks["redis"] = "unavailable"
        else:
            try:
                await redis.ping()
                checks["redis"] = "ok"
            except Exception:
                checks["redis"] = "error"
                status = "degraded"

        # Splunk tunnel liveness (non-critical — degraded, not error)
        import httpx
        from packages.shared.config.settings import get_settings as _gs
        _cfg = _gs()
        if _cfg.splunk_live_mode:
            try:
                r = httpx.get(
                    f"{_cfg.splunk_mcp_base_url.rstrip('/')}/health",
                    timeout=2.0,
                    verify=_cfg.splunk_mcp_ssl_verify,
                )
                checks["splunk"] = "ok" if r.status_code < 500 else "error"
            except Exception:
                checks["splunk"] = "unreachable"
                status = "degraded"
        else:
            checks["splunk"] = "live_mode_disabled"

        return {"status": status, "time": datetime.now(tz=UTC).isoformat(), "checks": checks}

    return app


app = create_app()
