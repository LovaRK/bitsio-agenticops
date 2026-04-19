"""Application settings endpoints."""

from __future__ import annotations

import os
import socket
import subprocess
from enum import Enum
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from agent_core.models.adapter import AnthropicModelAdapter, OllamaModelAdapter
from apps.api.app.dependencies import (
    get_splunk_adapter,
    get_splunk_incident_service,
)
from apps.api.app.services.splunk_live import SplunkIncidentService
from packages.shared.auth import AuthContext, require_analyst
from packages.shared.config.settings import get_settings

router = APIRouter(prefix="/api/v1", tags=["settings"])


class RuntimeMode(str, Enum):
    LOCAL_DEV = "LOCAL_DEV"
    LOCAL_INTEGRATION = "LOCAL_INTEGRATION"
    CLOUD_MODEL_TEST = "CLOUD_MODEL_TEST"
    CLOUD_LIVE = "CLOUD_LIVE"


class RuntimeConfigPayload(BaseModel):
    runtime_mode: RuntimeMode | None = Field(default=None)
    model_provider: str = Field(default="ollama")
    model_name: str = Field(default="qwen2.5:14b")
    splunk_adapter_mode: str = Field(default="auto")
    model_mock_mode: bool = Field(default=False)
    splunk_live_mode: bool = Field(default=False)


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


def _resolve_runtime_mode(
    *,
    model_provider: str,
    splunk_live_mode: bool,
) -> RuntimeMode:
    provider = model_provider.strip().lower()
    if provider == "anthropic":
        return RuntimeMode.CLOUD_LIVE if splunk_live_mode else RuntimeMode.CLOUD_MODEL_TEST
    return RuntimeMode.LOCAL_INTEGRATION if splunk_live_mode else RuntimeMode.LOCAL_DEV


def _runtime_mode_config(mode: RuntimeMode) -> dict[str, str | bool]:
    # Single source of truth for profile-based runtime switching.
    if mode == RuntimeMode.LOCAL_DEV:
        return {
            "model_provider": "ollama",
            "model_name": "qwen2.5:14b",
            "model_mock_mode": False,
            "splunk_live_mode": False,
            "splunk_adapter_mode": "auto",
        }
    if mode == RuntimeMode.LOCAL_INTEGRATION:
        return {
            "model_provider": "ollama",
            "model_name": "qwen2.5:14b",
            "model_mock_mode": False,
            "splunk_live_mode": True,
            "splunk_adapter_mode": "native",
        }
    if mode == RuntimeMode.CLOUD_MODEL_TEST:
        return {
            "model_provider": "anthropic",
            "model_name": "claude-haiku-4-5-20251001",
            "model_mock_mode": False,
            "splunk_live_mode": False,
            "splunk_adapter_mode": "auto",
        }
    return {
        "model_provider": "anthropic",
        "model_name": "claude-haiku-4-5-20251001",
        "model_mock_mode": False,
        "splunk_live_mode": True,
        "splunk_adapter_mode": "native",
    }


def _is_port_open(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.5)
        return sock.connect_ex((host, port)) == 0


def _ensure_local_splunk_tunnel(splunk_base_url: str, *, live_mode: bool) -> tuple[str, str]:
    """
    Best-effort auto-tunnel startup for local live mode.
    Returns (status, message) where status is one of:
    - "not_required"
    - "already_active"
    - "started"
    - "failed"
    """
    if not live_mode:
        return ("not_required", "Live Splunk disabled; tunnel not required.")

    parsed = urlparse(splunk_base_url)
    host = (parsed.hostname or "").strip().lower()
    port = parsed.port or (443 if parsed.scheme == "https" else 80)

    if host not in {"localhost", "127.0.0.1"} or port != 8089:
        return ("not_required", f"Tunnel not required for host={host or 'unknown'} port={port}.")

    if _is_port_open("127.0.0.1", 8089):
        return ("already_active", "Tunnel already active on localhost:8089.")

    target = os.getenv("SPLUNK_TUNNEL_SSH_TARGET", "root@144.202.48.85").strip()
    if not target:
        return ("failed", "SPLUNK_TUNNEL_SSH_TARGET is empty.")

    try:
        subprocess.run(
            ["ssh", "-fN", "-L", "8089:localhost:8089", target],
            check=True,
            timeout=15,
        )
    except Exception as exc:  # noqa: BLE001
        return ("failed", f"Failed to start tunnel via ssh: {type(exc).__name__}: {exc}")

    if _is_port_open("127.0.0.1", 8089):
        return ("started", f"Tunnel started: localhost:8089 -> {target}:8089")
    return ("failed", "SSH command completed but localhost:8089 is still unreachable.")


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
        model_provider = str(resolved["model_provider"])
        model_name = str(resolved["model_name"])
        model_mock_mode = bool(resolved["model_mock_mode"])
        splunk_live_mode = bool(resolved["splunk_live_mode"])
        adapter_mode = str(resolved["splunk_adapter_mode"])
        runtime_mode = payload.runtime_mode
    else:
        model_provider = payload.model_provider.strip().lower()
        adapter_mode = payload.splunk_adapter_mode.strip().lower()
        model_name = payload.model_name.strip()
        model_mock_mode = payload.model_mock_mode
        splunk_live_mode = payload.splunk_live_mode
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
    splunk_service: SplunkIncidentService = Depends(get_splunk_incident_service),
) -> RuntimeConnectivityResponse:
    """Check runtime connectivity for model and Splunk."""
    cfg = get_settings()
    model_connected = False
    model_detail = "unavailable"

    provider = cfg.model_provider.strip().lower()
    if cfg.model_mock_mode or provider == "stub":
        model_connected = True
        model_detail = "stub: mock mode enabled"
    elif provider == "anthropic":
        if not cfg.anthropic_api_key.strip():
            model_connected = False
            model_detail = "missing ANTHROPIC_API_KEY"
        else:
            try:
                sample = AnthropicModelAdapter(model_name=cfg.model_name).generate(
                    "Respond with OK only.",
                    temperature=0.0,
                )
                model_connected = not sample.startswith("[fallback]")
                model_detail = "OK" if model_connected else sample[:120]
            except Exception as exc:  # noqa: BLE001
                model_connected = False
                model_detail = f"{type(exc).__name__}: {exc}"
    elif provider == "ollama":
        try:
            sample = OllamaModelAdapter(
                model_name=cfg.model_name,
                base_url=cfg.ollama_base_url,
            ).generate("Respond with OK only.", temperature=0.0)
            model_connected = not sample.startswith("[fallback]")
            model_detail = "OK" if model_connected else sample[:120]
        except Exception as exc:  # noqa: BLE001
            model_connected = False
            model_detail = f"{type(exc).__name__}: {exc}"
    else:
        model_connected = False
        model_detail = f"unsupported provider: {provider}"

    if not cfg.splunk_live_mode:
        splunk_connected = True
        splunk_detail = "Live Splunk disabled (using local mock data)."
    else:
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
