from __future__ import annotations

import time
from collections import defaultdict
from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response
from redis.asyncio import Redis

NextCallable = Callable[[Request], Awaitable[Response]]


class InMemoryFixedWindowLimiter:
    def __init__(self) -> None:
        self._buckets: dict[tuple[str, int], int] = defaultdict(int)

    async def check_and_increment(self, tenant_id: str, limit: int, window_seconds: int) -> bool:
        now = int(time.time())
        window = now // window_seconds
        key = (tenant_id, window)
        self._buckets[key] += 1
        return self._buckets[key] <= limit


class RedisFixedWindowLimiter:
    def __init__(self, redis_url: str) -> None:
        self._redis = Redis.from_url(redis_url, decode_responses=True)

    async def check_and_increment(self, tenant_id: str, limit: int, window_seconds: int) -> bool:
        now = int(time.time())
        window = now // window_seconds
        key = f"ratelimit:{tenant_id}:{window}"
        count = await self._redis.incr(key)
        if count == 1:
            await self._redis.expire(key, window_seconds + 1)
        return count <= limit


class TenantRateLimitMiddleware:
    def __init__(
        self,
        rate_limit_per_minute: int = 100,
        redis_url: str | None = None,
        default_tenant: str = "tenant_demo",
    ) -> None:
        self._limit = max(1, rate_limit_per_minute)
        self._window_seconds = 60
        self._default_tenant = default_tenant
        self._fallback = InMemoryFixedWindowLimiter()
        self._redis_limiter: RedisFixedWindowLimiter | None = (
            RedisFixedWindowLimiter(redis_url) if redis_url else None
        )

    async def __call__(self, request: Request, call_next: NextCallable) -> Response:
        if request.url.path == "/health":
            return await call_next(request)

        tenant_id = request.headers.get("x-tenant-id") or self._default_tenant

        allowed = await self._is_allowed(tenant_id)
        if not allowed:
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "rate_limit_exceeded",
                    "tenant_id": tenant_id,
                    "limit_per_minute": self._limit,
                },
                headers={"Retry-After": "60"},
            )

        return await call_next(request)

    async def _is_allowed(self, tenant_id: str) -> bool:
        if self._redis_limiter is not None:
            try:
                return await self._redis_limiter.check_and_increment(
                    tenant_id, self._limit, self._window_seconds
                )
            except Exception:  # noqa: BLE001
                self._redis_limiter = None
        return await self._fallback.check_and_increment(tenant_id, self._limit, self._window_seconds)


def install_rate_limit_middleware(
    app: FastAPI,
    *,
    rate_limit_per_minute: int = 100,
    redis_url: str | None = None,
    default_tenant: str = "tenant_demo",
) -> TenantRateLimitMiddleware:
    limiter = TenantRateLimitMiddleware(
        rate_limit_per_minute=rate_limit_per_minute,
        redis_url=redis_url,
        default_tenant=default_tenant,
    )
    app.middleware("http")(limiter)
    return limiter
