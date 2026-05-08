"""Support resources endpoint."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from packages.shared.auth import AuthContext, require_analyst

router = APIRouter(prefix="/api/v1", tags=["support"])


@router.get("/support/resources")
def support_resources(
    _ctx: AuthContext = Depends(require_analyst),
) -> dict:
    """Get support resources and documentation links."""
    return {
        "categories": [
            {
                "title": "Runbooks",
                "icon": "rocket_launch",
                "links": [
                    {"label": "Live Monitoring View", "href": "/monitoring"},
                    {"label": "Approval Workflow", "href": "/approvals"},
                    {"label": "Incident Explorer", "href": "/incidents"},
                ],
            },
            {
                "title": "System Design",
                "icon": "menu_book",
                "links": [
                    {"label": "Dashboard Overview", "href": "/"},
                    {"label": "Settings Snapshot", "href": "/settings"},
                    {"label": "Service Health Matrix", "href": "/monitoring"},
                ],
            },
            {
                "title": "Security & Ops",
                "icon": "shield",
                "links": [
                    {"label": "Rate Limit + RBAC Status", "href": "/settings"},
                    {"label": "Decision Traces", "href": "/incidents"},
                ],
            },
        ],
        "contact": {
            "email": "support@bitsio.example",
            "chat": "Slack #bitsio-agenticops",
        },
    }
