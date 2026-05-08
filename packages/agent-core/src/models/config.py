"""Model configuration for BitsIO Telemetry Value Agent."""

from typing import Literal, Optional
from pydantic import BaseModel, Field


class ModelConfig(BaseModel):
    """Model configuration for AI inference."""

    provider: Literal["ollama", "anthropic", "openrouter"]
    model_name: str
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    temperature: float = 0.7
    max_tokens: int = 2048


class RuntimeConfig(BaseModel):
    """Runtime configuration that controls AI behavior."""

    local_mode: bool = True
    model_config: ModelConfig
    ollama_base_url: str = "http://localhost:11434"
    anthropic_api_key: Optional[str] = None
    openrouter_api_key: Optional[str] = None


def get_default_config() -> RuntimeConfig:
    """Get default runtime configuration - local with Gemma4."""
    return RuntimeConfig(
        local_mode=True,
        model_config=ModelConfig(
            provider="ollama",
            model_name="gemma:2b",
            temperature=0.7,
            max_tokens=2048,
        ),
        ollama_base_url="http://localhost:11434",
    )


def get_cloud_config(api_key: str) -> RuntimeConfig:
    """Get cloud configuration for Anthropic."""
    return RuntimeConfig(
        local_mode=False,
        model_config=ModelConfig(
            provider="anthropic",
            model_name="claude-3-sonnet-20240229",
            api_key=api_key,
            temperature=0.7,
            max_tokens=2048,
        ),
    )


def get_dev_config(api_key: str) -> RuntimeConfig:
    """Get development configuration for OpenRouter."""
    return RuntimeConfig(
        local_mode=False,
        model_config=ModelConfig(
            provider="openrouter",
            model_name="anthropic/claude-3-sonnet",
            api_key=api_key,
            base_url="https://openrouter.ai/api/v1",
            temperature=0.7,
            max_tokens=2048,
        ),
    )