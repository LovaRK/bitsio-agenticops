"""Application settings endpoints."""

from __future__ import annotations

import os

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from agent_core.models.adapter import resolve_model_adapter
from apps.api.app.dependencies import (
    get_splunk_adapter,
    get_splunk_incident_service,
)
from apps.api.app.services.splunk_live import SplunkIncidentService
from packages.shared.auth import AuthContext, require_analyst
from packages.shared.config.settings import get_settings

router = APIRouter(prefix="/api/v1", tags=["settings"])


class RuntimeConfigPayload(BaseModel):
    model_provider: str = Field(default="ollama")
    model_name: str = Field(default="qwen2.5:14b")
    splunk_adapter_mode: str = Field(default="auto")
    model_mock_mode: bool = Field(default=False)
    splunk_live_mode: bool = Field(default=False)


class RuntimeConfigResponse(BaseModel):
    updated: bool
    model_provider: str
    model_name: str
    splunk_adapter_mode: str
    model_mock_mode: bool
    splunk_live_mode: bool


class RuntimeConnectivityResponse(BaseModel):
    model: dict[str, str | bool]
    splunk: dict[str, str | bool]


@router.get("/settings")
def get_settings_snapshot(
    _ctx: AuthContext = Depends(require_analyst),
    splunk_service: SplunkIncidentService = Depends(get_splunk_incident_service),
) -> dict:
    """Get current application settings snapshot."""
    cfg = get_settings()
    try:
        index_count = len(splunk_service.adapter.list_indexes())
        splunk_connected = True
    except Exception:  # noqa: BLE001
        index_count = 0
        splunk_connected = False

    return {
        "platform_name": "BitsIO AgenticOps",
        "environment": cfg.environment,
        "timezone": cfg.app_timezone,
        "splunk": {
            "adapter_mode": cfg.splunk_adapter_mode,
            "live_mode": cfg.splunk_live_mode,
            "base_url": cfg.splunk_mcp_base_url,
            "web_base_url": cfg.splunk_web_base_url,
            "connected": splunk_connected,
            "index_count": index_count,
        },
        "model": {
            "provider": cfg.model_provider,
            "name": cfg.model_name,
            "runtime": "local" if cfg.model_provider.strip().lower() == "ollama" else "cloud",
            "base_url": cfg.ollama_base_url,
            "mock_mode": cfg.model_mock_mode,
        },
        "security": {
            "rbac_enabled": True,
            "rate_limit_per_minute": cfg.rate_limit_per_minute,
            "oidc_boundary": True,
        },
    }


@router.put("/settings/runtime", response_model=RuntimeConfigResponse)
def update_runtime_settings(
    payload: RuntimeConfigPayload,
    _ctx: AuthContext = Depends(require_analyst),
) -> RuntimeConfigResponse:
    """Update runtime settings and clear dependency caches."""
    model_provider = payload.model_provider.strip().lower()
    if model_provider not in {"ollama", "anthropic", "stub"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="model_provider must be one of: ollama, anthropic, stub",
        )

    adapter_mode = payload.splunk_adapter_mode.strip().lower()
    if adapter_mode not in {"mcp", "native", "auto"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="splunk_adapter_mode must be one of: mcp, native, auto",
        )

    model_name = payload.model_name.strip()
    if not model_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="model_name is required"
        )

    # Update environment variables for runtime reconfiguration
    os.environ["MODEL_PROVIDER"] = model_provider
    os.environ["MODEL_NAME"] = model_name
    os.environ["MODEL_MOCK_MODE"] = "true" if payload.model_mock_mode else "false"
    os.environ["SPLUNK_ADAPTER_MODE"] = adapter_mode
    os.environ["SPLUNK_LIVE_MODE"] = "true" if payload.splunk_live_mode else "false"

    # Clear cached dependency singletons so API uses new settings immediately
    get_settings.cache_clear()
    get_splunk_adapter.cache_clear()
    get_splunk_incident_service.cache_clear()

    return RuntimeConfigResponse(
        updated=True,
        model_provider=model_provider,
        model_name=model_name,
        splunk_adapter_mode=adapter_mode,
        model_mock_mode=payload.model_mock_mode,
        splunk_live_mode=payload.splunk_live_mode,
    )


@router.get("/settings/runtime/check", response_model=RuntimeConnectivityResponse)
def check_runtime_connections(
    _ctx: AuthContext = Depends(require_analyst),
    splunk_service: SplunkIncidentService = Depends(get_splunk_incident_service),
) -> RuntimeConnectivityResponse:
    """Check runtime connectivity for model and Splunk."""
    cfg = get_settings()
    model_connected = False
    model_detail = "unavailable"

    provider = cfg.model_provider.strip().lower()
    if provider == "anthropic" and not cfg.anthropic_api_key.strip():
        model_connected = False
        model_detail = "missing ANTHROPIC_API_KEY"
    else:
        try:
            sample = resolve_model_adapter().generate(
                "Health check: respond with OK.", temperature=0.0
            )
            model_connected = not sample.startswith("[fallback]")
            model_detail = sample[:120]
        except Exception as exc:  # noqa: BLE001
            model_connected = False
            model_detail = f"{type(exc).__name__}: {exc}"

    try:
        index_count = len(splunk_service.adapter.list_indexes())
        splunk_connected = True
        splunk_detail = f"{index_count} indexes visible"
    except Exception as exc:  # noqa: BLE001
        splunk_connected = False
        splunk_detail = f"{type(exc).__name__}: {exc}"

    return RuntimeConnectivityResponse(
        model={"connected": model_connected, "detail": model_detail},
        splunk={"connected": splunk_connected, "detail": splunk_detail},
    )
