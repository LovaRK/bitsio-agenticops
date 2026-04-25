from __future__ import annotations

import logging
import os
from abc import ABC, abstractmethod
from datetime import UTC, datetime
from enum import Enum
from typing import Optional, Tuple

import httpx
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class SecurityError(Exception):
    """Raised when privacy contract is violated."""

    pass


class ModelProvider(str, Enum):
    """Available model providers."""

    OLLAMA = "ollama"
    ANTHROPIC = "anthropic"
    OPENAI = "openai"
    STUB = "stub"


class RuntimeMode(str, Enum):
    """Privacy/security modes for model selection."""

    LOCAL_ONLY = "local_only"  # Never cloud
    LOCAL_FIRST = "local_first"  # Default local, user can enable cloud
    CLOUD_ALLOWED = "cloud_allowed"  # Cloud available but not default


class UserModelSettings(BaseModel):
    """User preferences for model selection."""

    use_cloud: bool = Field(False, description="User explicitly opted-in to cloud models")
    preferred_cloud_provider: Optional[ModelProvider] = Field(
        None, description="User's preferred cloud provider"
    )


class ModelMetadata(BaseModel):
    """Metadata about which model was used for transparency."""

    provider: str
    model: str
    mode: str  # "local" or "cloud"
    user_opt_in: bool
    runtime_mode: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))

    def dict(self, **kwargs):
        """Override to ensure timestamp is ISO format (deprecated, use model_dump)."""
        data = super().model_dump(**kwargs)
        data["timestamp"] = data["timestamp"].isoformat()
        return data

    def model_dump(self, **kwargs):
        """Return dict with ISO timestamp."""
        data = super().model_dump(**kwargs)
        data["timestamp"] = data["timestamp"].isoformat()
        return data


def enforce_privacy_contract(
    selected_provider: ModelProvider,
    user_settings: UserModelSettings,
    runtime_mode: RuntimeMode,
) -> None:
    """CRITICAL: Prevent cloud usage without explicit permission.

    Raises SecurityError if cloud attempted without user permission.
    This is the security boundary that cannot be bypassed.
    """
    if runtime_mode == RuntimeMode.LOCAL_ONLY:
        if selected_provider != ModelProvider.OLLAMA:
            raise SecurityError(
                "LOCAL_ONLY mode enforced: Cloud models are disabled at the system level."
            )

    if selected_provider != ModelProvider.OLLAMA and not user_settings.use_cloud:
        raise SecurityError(
            "Cloud model usage not allowed. User has not explicitly opted-in to cloud models."
        )


class ModelAdapter(ABC):
    @abstractmethod
    def generate(self, prompt: str, *, temperature: float = 0.1) -> str:
        raise NotImplementedError


class AnthropicModelAdapter(ModelAdapter):
    def __init__(self, model_name: str | None = None) -> None:
        self.api_key = os.getenv("ANTHROPIC_API_KEY", "")
        self.model_name = model_name or os.getenv("MODEL_NAME", "claude-haiku-4-5-20251001")

    def generate(self, prompt: str, *, temperature: float = 0.1) -> str:
        if not self.api_key:
            return "Anthropic adapter running in mock mode: no API key configured."

        try:
            response = httpx.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": self.api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": self.model_name,
                    "max_tokens": 1024,
                    "temperature": temperature,
                    "messages": [{"role": "user", "content": prompt}],
                },
                timeout=30.0,
            )
            response.raise_for_status()
            data = response.json()
            if data.get("content") and len(data["content"]) > 0:
                return data["content"][0].get("text", f"[empty-response] {prompt[:100]}")
            return f"[no-content] {prompt[:100]}"
        except Exception as exc:
            logger.warning(f"Claude API call failed: {exc}. Returning fallback response.")
            return f"[fallback] Error: {type(exc).__name__} — {prompt[:200]}"


class StubModelAdapter(ModelAdapter):
    def generate(self, prompt: str, *, temperature: float = 0.1) -> str:  # noqa: ARG002
        return f"stub:{prompt[:120]}"


class OllamaModelAdapter(ModelAdapter):
    def __init__(self, model_name: str | None = None, base_url: str | None = None) -> None:
        self.model_name = model_name or os.getenv("MODEL_NAME", "qwen2.5:7b")
        self.base_url = (base_url or os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")).rstrip(
            "/"
        )

    def generate(self, prompt: str, *, temperature: float = 0.1) -> str:
        try:
            response = httpx.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": self.model_name,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": temperature,
                    },
                },
                timeout=60.0,
            )
            response.raise_for_status()
            payload = response.json()
            text = str(payload.get("response", "")).strip()
            return text or f"[no-content] {prompt[:100]}"
        except Exception as exc:
            logger.warning(f"Ollama generate failed: {exc}. Returning fallback response.")
            return f"[fallback] Error: {type(exc).__name__} — {prompt[:200]}"


class ModelSelectionEngine:
    """Core engine for selecting models with local-first privacy enforcement."""

    def __init__(
        self,
        runtime_mode: RuntimeMode = RuntimeMode.LOCAL_FIRST,
        ollama_model: str | None = None,
        ollama_url: str | None = None,
        anthropic_model: str | None = None,
    ):
        self.runtime_mode = runtime_mode
        self.ollama_model = ollama_model or os.getenv("OLLAMA_MODEL", "qwen2.5:7b")
        self.ollama_url = (ollama_url or os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")).rstrip(
            "/"
        )
        self.anthropic_model = anthropic_model or os.getenv(
            "ANTHROPIC_MODEL", "claude-sonnet-4-20250514"
        )
        self.anthropic_api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()

    def _get_local_model(self) -> Tuple[ModelProvider, str, ModelAdapter]:
        """Get local Ollama model."""
        adapter = OllamaModelAdapter(model_name=self.ollama_model, base_url=self.ollama_url)
        return ModelProvider.OLLAMA, self.ollama_model, adapter

    def _get_cloud_model(
        self, preferred_provider: Optional[ModelProvider] = None
    ) -> Tuple[ModelProvider, str, ModelAdapter]:
        """Get cloud model. Raises error if not configured."""
        target = preferred_provider or ModelProvider.ANTHROPIC

        if target == ModelProvider.ANTHROPIC:
            if not self.anthropic_api_key:
                raise SecurityError(
                    f"Cloud model {target} requested but API key not configured. "
                    "Set ANTHROPIC_API_KEY in environment."
                )
            adapter = AnthropicModelAdapter(model_name=self.anthropic_model)
            return ModelProvider.ANTHROPIC, self.anthropic_model, adapter

        if target == ModelProvider.OPENAI:
            raise SecurityError("OpenAI model requested but not yet implemented.")

        raise SecurityError(f"Unknown cloud provider: {target}")

    def select_model(
        self, user_settings: UserModelSettings
    ) -> Tuple[ModelProvider, str, ModelAdapter]:
        """Select model based on runtime mode and user preferences.

        RULE 1: LOCAL_ONLY mode ALWAYS uses local
        RULE 2: User must explicitly opt-in to cloud
        RULE 3: DEFAULT is ALWAYS local
        """
        if self.runtime_mode == RuntimeMode.LOCAL_ONLY:
            return self._get_local_model()

        if user_settings.use_cloud:
            return self._get_cloud_model(user_settings.preferred_cloud_provider)

        return self._get_local_model()

    def create_metadata(
        self,
        provider: ModelProvider,
        model: str,
        user_opt_in: bool,
    ) -> ModelMetadata:
        """Create transparency metadata for API responses."""
        mode = "cloud" if provider != ModelProvider.OLLAMA else "local"
        return ModelMetadata(
            provider=provider.value,
            model=model,
            mode=mode,
            user_opt_in=user_opt_in,
            runtime_mode=self.runtime_mode.value,
        )


def resolve_model_adapter() -> ModelAdapter:
    """Legacy function for backwards compatibility. Use ModelSelectionEngine for new code."""
    provider = os.getenv("MODEL_PROVIDER", "stub").strip().lower()

    if provider == "ollama":
        return OllamaModelAdapter()

    if provider == "anthropic":
        if os.getenv("ANTHROPIC_API_KEY", "").strip():
            return AnthropicModelAdapter()
        return StubModelAdapter()

    return StubModelAdapter()
