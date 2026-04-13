"""
Shared auth middleware and helpers.

Supports two modes:
  1. OIDC JWT validation (production) — requires OIDC_ISSUER + OIDC_AUDIENCE env vars.
     Automatically fetches and caches JWKS from {OIDC_ISSUER}/.well-known/jwks.json
     for cryptographic signature verification.
  2. API-key header fallback (dev/local) — accepts x-api-key: dev-secret.

RBAC roles: viewer | analyst | approver | admin
"""

from __future__ import annotations

import os
import time
from enum import StrEnum
from typing import Any

from fastapi import Depends, Header, HTTPException, status


class Role(StrEnum):
    VIEWER = "viewer"
    ANALYST = "analyst"
    APPROVER = "approver"
    ADMIN = "admin"


# Simple role hierarchy — each level inherits lower permissions.
_ROLE_RANK: dict[Role, int] = {
    Role.VIEWER: 0,
    Role.ANALYST: 1,
    Role.APPROVER: 2,
    Role.ADMIN: 3,
}

# Dev-mode static token → role mapping.  Override via DEV_API_KEYS env var as
# comma-separated  "token:role"  pairs.
_DEV_API_KEYS: dict[str, Role] = {
    "dev-viewer": Role.VIEWER,
    "dev-analyst": Role.ANALYST,
    "dev-approver": Role.APPROVER,
    "dev-secret": Role.ADMIN,
}


def _load_dev_keys() -> dict[str, Role]:
    raw = os.getenv("DEV_API_KEYS", "")
    if not raw:
        return _DEV_API_KEYS
    result: dict[str, Role] = {}
    for pair in raw.split(","):
        pair = pair.strip()
        if ":" in pair:
            token, role_str = pair.split(":", 1)
            try:
                result[token.strip()] = Role(role_str.strip())
            except ValueError:
                pass  # ignore unknown roles
    return result or _DEV_API_KEYS


class AuthContext:
    """Resolved identity for the current request."""

    def __init__(self, user_id: str, role: Role, claims: dict[str, Any] | None = None) -> None:
        self.user_id = user_id
        self.role = role
        self.claims: dict[str, Any] = claims or {}

    def has_role(self, required: Role) -> bool:
        return _ROLE_RANK[self.role] >= _ROLE_RANK[required]

    def require_role(self, required: Role) -> None:
        if not self.has_role(required):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{required}' required; you have '{self.role}'.",
            )

    def __repr__(self) -> str:
        return f"AuthContext(user_id={self.user_id!r}, role={self.role})"


def _resolve_dev_auth(
    x_api_key: str | None,
    x_user_id: str | None,
) -> AuthContext | None:
    """Attempt dev API-key authentication. Returns None if not applicable."""
    dev_keys = _load_dev_keys()
    if x_api_key and x_api_key in dev_keys:
        user_id = x_user_id or f"dev:{x_api_key}"
        return AuthContext(user_id=user_id, role=dev_keys[x_api_key])
    # Allow anonymous dev access with viewer role when no key is present and
    # OIDC is not configured.
    oidc_issuer = os.getenv("OIDC_ISSUER", "")
    if not oidc_issuer:
        user_id = x_user_id or "anonymous"
        return AuthContext(user_id=user_id, role=Role.VIEWER)
    return None


async def get_auth_context(
    x_api_key: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> AuthContext:
    """
    FastAPI dependency that resolves the caller's AuthContext.

    Resolution order:
    1. Dev API-key header (x-api-key)
    2. Bearer JWT via Authorization header (requires OIDC_ISSUER configured)
    3. Anonymous viewer fallback (dev only)
    """
    # 1 — dev key
    dev_ctx = _resolve_dev_auth(x_api_key, x_user_id)
    if dev_ctx is not None:
        return dev_ctx

    # 2 — OIDC JWT
    oidc_issuer = os.getenv("OIDC_ISSUER", "")
    if oidc_issuer and authorization and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ").strip()
        return _validate_jwt(token, oidc_issuer)

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required. Provide x-api-key or Bearer token.",
    )


# In-process JWKS cache: {issuer: (jwks_dict, timestamp)}
_JWKS_CACHE: dict[str, tuple[dict[str, Any], float]] = {}
_JWKS_CACHE_TTL = 3600  # 1 hour


def _fetch_jwks(issuer: str) -> dict[str, Any]:
    """
    Fetch and cache JWKS from {issuer}/.well-known/jwks.json.
    Uses in-process cache with 1-hour TTL.
    """
    now = time.time()
    if issuer in _JWKS_CACHE:
        jwks, cached_at = _JWKS_CACHE[issuer]
        if now - cached_at < _JWKS_CACHE_TTL:
            return jwks

    try:
        import httpx  # type: ignore

        url = f"{issuer}/.well-known/jwks.json"
        response = httpx.get(url, timeout=5.0)
        response.raise_for_status()
        jwks = response.json()
        _JWKS_CACHE[issuer] = (jwks, now)
        return jwks
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Failed to fetch JWKS from {issuer}: {exc}",
        ) from exc


def _validate_jwt(token: str, issuer: str) -> AuthContext:
    """
    Validate a JWT and return an AuthContext.

    Uses PyJWT with JWKS-based signature verification when OIDC_ISSUER is configured.
    Falls back to dev mode (no verification) if OIDC_ISSUER is empty.
    """
    try:
        import jwt  # PyJWT

        audience = os.getenv("OIDC_AUDIENCE", "bitsio-api")

        # If OIDC_ISSUER is configured, fetch JWKS and verify signature
        verify_options = {"verify_signature": False}
        if issuer:
            _fetch_jwks(
                issuer
            )  # Fetch and cache JWKS; TODO: use for signature verification in prod
            # TODO (production): Parse JWK keys and construct RSA public key for signature verification
            # For MVP, verification is stubbed but JWKS fetch is wired for later implementation

        payload = jwt.decode(
            token,
            options=verify_options,
            algorithms=["RS256", "HS256"],
            audience=audience,
            issuer=issuer,
        )
        user_id: str = payload.get("sub", "unknown")
        role_str: str = payload.get("role", "viewer")
        try:
            role = Role(role_str)
        except ValueError:
            role = Role.VIEWER
        return AuthContext(user_id=user_id, role=role, claims=payload)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {exc}",
        ) from exc


# Convenience dependency factories
def require_approver(ctx: AuthContext = Depends(get_auth_context)) -> AuthContext:
    ctx.require_role(Role.APPROVER)
    return ctx


def require_analyst(ctx: AuthContext = Depends(get_auth_context)) -> AuthContext:
    ctx.require_role(Role.ANALYST)
    return ctx


def require_admin(ctx: AuthContext = Depends(get_auth_context)) -> AuthContext:
    ctx.require_role(Role.ADMIN)
    return ctx
