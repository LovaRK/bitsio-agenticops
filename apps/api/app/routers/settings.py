"""Application settings endpoints."""

from __future__ import annotations

import os

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from apps.api.app.dependencies import (
    get_splunk_adapter,
    get_splunk_incident_service,
    resolve_splunk_mode_for_workload,
)
from apps.api.app.services.contracts import IncidentServiceProtocol
from apps.api.app.services.runtime_connectivity import (
    check_model_connectivity,
    check_splunk_connectivity,
)
from apps.api.app.services.runtime_profiles import (
    RuntimeMode,
    resolve_runtime_mode as _resolve_runtime_mode,
    runtime_label_for_provider,
    runtime_mode_config as _runtime_mode_config,
)
from apps.api.app.services.splunk_tunnel import ensure_local_splunk_tunnel as _ensure_local_splunk_tunnel
from packages.shared.auth import AuthContext, require_analyst
from packages.shared.config.settings import get_settings

router = APIRouter(prefix="/api/v1", tags=["settings"])


class RuntimeConfigPayload(BaseModel):
    runtime_mode: RuntimeMode | None = Field(default=None)
    model_provider: str | None = Field(default=None)
    model_name: str | None = Field(default=None)
    splunk_adapter_mode: str | None = Field(default=None)
    model_mock_mode: bool | None = Field(default=None)
    splunk_live_mode: bool | None = Field(default=None)


class RuntimeConfigResponse(BaseModel):
    updated: bool
    runtime_mode: RuntimeMode
    model_provider: str
    model_name: str
    splunk_adapter_mode: str
    model_mock_mode: bool
    splunk_live_mode: bool
    tunnel_status: str | None = None
    tunnel_message: str | None = None


class RuntimeConnectivityResponse(BaseModel):
    model: dict[str, str | bool]
    splunk: dict[str, str | bool]


@router.get("/settings")
def get_settings_snapshot(
    _ctx: AuthContext = Depends(require_analyst),
    splunk_service: IncidentServiceProtocol = Depends(get_splunk_incident_service),
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
            "runtime": runtime_label_for_provider(cfg.model_provider),
            "base_url": (
                "https://api.anthropic.com"
                if cfg.model_provider.strip().lower() == "anthropic"
                else cfg.ollama_base_url
            ),
            "mock_mode": cfg.model_mock_mode,
        },
        "runtime": {
            "mode": _resolve_runtime_mode(
                model_provider=cfg.model_provider,
                splunk_live_mode=cfg.splunk_live_mode,
            ).value
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
    if payload.runtime_mode is not None:
        resolved = _runtime_mode_config(payload.runtime_mode)
        model_provider = (payload.model_provider or str(resolved["model_provider"])).strip().lower()
        model_name = (payload.model_name or str(resolved["model_name"])).strip()
        model_mock_mode = (
            bool(payload.model_mock_mode)
            if payload.model_mock_mode is not None
            else bool(resolved["model_mock_mode"])
        )
        splunk_live_mode = (
            bool(payload.splunk_live_mode)
            if payload.splunk_live_mode is not None
            else bool(resolved["splunk_live_mode"])
        )
        adapter_mode = (payload.splunk_adapter_mode or str(resolved["splunk_adapter_mode"])).strip().lower()
        runtime_mode = payload.runtime_mode
    else:
        model_provider = (payload.model_provider or "ollama").strip().lower()
        adapter_mode = (payload.splunk_adapter_mode or "auto").strip().lower()
        model_name = (payload.model_name or "qwen2.5:7b").strip()
        model_mock_mode = bool(payload.model_mock_mode)
        splunk_live_mode = bool(payload.splunk_live_mode)
        runtime_mode = _resolve_runtime_mode(
            model_provider=model_provider,
            splunk_live_mode=splunk_live_mode,
        )

    if model_provider not in {"ollama", "anthropic", "stub"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="model_provider must be one of: ollama, anthropic, stub",
        )

    if adapter_mode not in {"mcp", "native", "auto"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="splunk_adapter_mode must be one of: mcp, native, auto",
        )

    if not model_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="model_name is required"
        )

    # Update environment variables for runtime reconfiguration
    os.environ["MODEL_PROVIDER"] = model_provider
    os.environ["MODEL_NAME"] = model_name
    os.environ["MODEL_MOCK_MODE"] = "true" if model_mock_mode else "false"
    os.environ["SPLUNK_ADAPTER_MODE"] = adapter_mode
    os.environ["SPLUNK_LIVE_MODE"] = "true" if splunk_live_mode else "false"

    # Clear cached dependency singletons so API uses new settings immediately
    get_settings.cache_clear()
    if hasattr(get_splunk_adapter, "cache_clear"):
        get_splunk_adapter.cache_clear()
    if hasattr(get_splunk_incident_service, "cache_clear"):
        get_splunk_incident_service.cache_clear()

    refreshed_cfg = get_settings()
    tunnel_status, tunnel_message = _ensure_local_splunk_tunnel(
        refreshed_cfg.splunk_mcp_base_url,
        live_mode=splunk_live_mode,
    )

    return RuntimeConfigResponse(
        updated=True,
        runtime_mode=runtime_mode,
        model_provider=model_provider,
        model_name=model_name,
        splunk_adapter_mode=adapter_mode,
        model_mock_mode=model_mock_mode,
        splunk_live_mode=splunk_live_mode,
        tunnel_status=tunnel_status,
        tunnel_message=tunnel_message,
    )


@router.get("/settings/runtime/check", response_model=RuntimeConnectivityResponse)
def check_runtime_connections(
    _ctx: AuthContext = Depends(require_analyst),
    splunk_service: IncidentServiceProtocol = Depends(get_splunk_incident_service),
) -> RuntimeConnectivityResponse:
    """Check runtime connectivity for model and Splunk."""
    cfg = get_settings()
    model_status = check_model_connectivity(cfg)
    splunk_status = check_splunk_connectivity(cfg, splunk_service=splunk_service)
    configured_mode = cfg.splunk_adapter_mode.strip().lower()
    resolved_deterministic = resolve_splunk_mode_for_workload(workload="deterministic")
    resolved_agentic = resolve_splunk_mode_for_workload(workload="agentic")
    backend = (
        "splunk-native"
        if resolved_deterministic == "native"
        else ("splunk-mcp" if resolved_deterministic == "mcp" else f"splunk-{resolved_deterministic}")
    )

    splunk_status = {
        **splunk_status,
        "configured_adapter_mode": configured_mode,
        "resolved_adapter_mode": resolved_deterministic,
        "resolved_agentic_mode": resolved_agentic,
        "backend": backend,
    }

    return RuntimeConnectivityResponse(
        model=model_status,
        splunk=splunk_status,
    )
