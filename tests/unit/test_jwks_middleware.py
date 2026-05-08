"""
Unit tests for OIDC authentication middleware and RBAC.
"""

from __future__ import annotations

import pytest

from packages.shared.auth.middleware import AuthContext, Role, get_auth_context


@pytest.mark.asyncio
async def test_get_auth_context_dev_analyst_key() -> None:
    """Dev API key 'dev-analyst' should authenticate with analyst role."""
    ctx = await get_auth_context(
        x_api_key="dev-analyst",
        x_user_id=None,
        authorization=None,
    )

    assert ctx.user_id == "dev:dev-analyst"
    assert ctx.role == Role.ANALYST


@pytest.mark.asyncio
async def test_get_auth_context_dev_approver_key() -> None:
    """Dev API key 'dev-approver' should authenticate with approver role."""
    ctx = await get_auth_context(
        x_api_key="dev-approver",
        x_user_id=None,
        authorization=None,
    )

    assert ctx.user_id == "dev:dev-approver"
    assert ctx.role == Role.APPROVER


@pytest.mark.asyncio
async def test_get_auth_context_custom_user_id() -> None:
    """x-user-id header should be used when provided."""
    ctx = await get_auth_context(
        x_api_key="dev-analyst",
        x_user_id="custom_user_123",
        authorization=None,
    )

    assert ctx.user_id == "custom_user_123"


@pytest.mark.asyncio
async def test_get_auth_context_anonymous_fallback() -> None:
    """No API key and no OIDC should fall back to anonymous viewer in dev mode."""
    import os

    # Ensure OIDC is not configured
    old_issuer = os.environ.pop("OIDC_ISSUER", None)
    try:
        ctx = await get_auth_context(
            x_api_key=None,
            x_user_id=None,
            authorization=None,
        )
        assert ctx.role == Role.VIEWER
    finally:
        if old_issuer:
            os.environ["OIDC_ISSUER"] = old_issuer


def test_auth_context_role_hierarchy() -> None:
    """AuthContext.has_role should respect role hierarchy."""
    admin_ctx = AuthContext("user1", Role.ADMIN)
    approver_ctx = AuthContext("user2", Role.APPROVER)
    analyst_ctx = AuthContext("user3", Role.ANALYST)
    viewer_ctx = AuthContext("user4", Role.VIEWER)

    # Admin can do any operation
    assert admin_ctx.has_role(Role.ANALYST)
    assert admin_ctx.has_role(Role.APPROVER)
    assert admin_ctx.has_role(Role.ADMIN)

    # Approver can do analyst but not admin
    assert approver_ctx.has_role(Role.ANALYST)
    assert approver_ctx.has_role(Role.APPROVER)
    assert not approver_ctx.has_role(Role.ADMIN)

    # Analyst can do analyst but not approver or admin
    assert analyst_ctx.has_role(Role.ANALYST)
    assert not analyst_ctx.has_role(Role.APPROVER)
    assert not analyst_ctx.has_role(Role.ADMIN)

    # Viewer can only do viewer
    assert viewer_ctx.has_role(Role.VIEWER)
    assert not viewer_ctx.has_role(Role.ANALYST)
