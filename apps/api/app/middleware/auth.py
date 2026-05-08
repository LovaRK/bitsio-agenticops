"""Authentication middleware."""

import os
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class AuthMiddleware(BaseHTTPMiddleware):
    """Authentication middleware for production."""

    async def dispatch(self, request: Request, call_next):
        # Skip auth for health endpoints
        if request.url.path in ["/", "/health", "/health/ready", "/health/live"]:
            return await call_next(request)

        # Check for API key in development mode
        env = os.getenv("ENV", "development")
        if env == "development":
            # Dev mode: accept dev key or skip auth
            api_key = request.headers.get("x-api-key")
            dev_key = os.getenv("API_KEY", "dev-api-key-change-in-production")
            if api_key == dev_key or api_key is None:
                return await call_next(request)

        # Production: require valid authentication
        # TODO: Implement proper OIDC JWT validation
        # authorization = request.headers.get("Authorization")
        # if not authorization or not authorization.startswith("Bearer "):
        #     return JSONResponse(
        #         status_code=401,
        #         content={"detail": "Missing authentication"}
        #     )

        return await call_next(request)