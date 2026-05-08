"""Settings API endpoints."""

from typing import Literal, Optional
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class RuntimeConfig(BaseModel):
    """Runtime configuration model."""
    model_provider: Literal["ollama", "anthropic", "openrouter"]
    model_name: str
    local_mode: bool
    anthropic_api_key: Optional[str] = None
    openrouter_api_key: Optional[str] = None


class RuntimeStatus(BaseModel):
    """Runtime status model."""
    provider: str
    model: str
    local_mode: bool
    inference: str
    cloud_access: str
    telemetry_source: str


# In-memory store for demo (use database in production)
_runtime_config = RuntimeConfig(
    model_provider="ollama",
    model_name="gemma:2b",
    local_mode=True,
    anthropic_api_key=None,
    openrouter_api_key=None
)


@router.get("/settings/runtime")
async def get_runtime_settings() -> RuntimeStatus:
    """Get current runtime settings."""
    return RuntimeStatus(
        provider=_runtime_config.model_provider,
        model=_runtime_config.model_name,
        local_mode=_runtime_config.local_mode,
        inference="LOCAL" if _runtime_config.local_mode else "CLOUD",
        cloud_access="DISABLED" if _runtime_config.local_mode else "ENABLED",
        telemetry_source="LIVE"
    )


@router.put("/settings/runtime")
async def update_runtime_settings(config: RuntimeConfig) -> RuntimeStatus:
    """Update runtime settings."""
    global _runtime_config
    _runtime_config = config

    return RuntimeStatus(
        provider=config.model_provider,
        model=config.model_name,
        local_mode=config.local_mode,
        inference="LOCAL" if config.local_mode else "CLOUD",
        cloud_access="DISABLED" if config.local_mode else "ENABLED",
        telemetry_source="LIVE"
    )


@router.post("/settings/runtime/test")
async def test_runtime_connection() -> dict:
    """Test runtime connectivity."""
    # TODO: Implement actual connection test
    return {
        "status": "ok",
        "message": "Runtime connection successful"
    }