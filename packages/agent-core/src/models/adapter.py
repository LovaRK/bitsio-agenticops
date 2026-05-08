"""Model adapter interface for LiteLLM integration."""

import os
from abc import ABC, abstractmethod
from typing import Optional
import httpx


class ModelAdapter(ABC):
    """Abstract base class for model adapters."""

    @abstractmethod
    async def generate(self, prompt: str, **kwargs) -> str:
        """Generate text from prompt."""
        pass

    @abstractmethod
    async def is_available(self) -> bool:
        """Check if the model is available."""
        pass


class OllamaAdapter(ModelAdapter):
    """Ollama local model adapter (default)."""

    def __init__(self, model_name: str = "gemma:2b", base_url: str = "http://localhost:11434"):
        self.model_name = model_name
        self.base_url = base_url

    async def generate(self, prompt: str, **kwargs) -> str:
        """Generate text using Ollama."""
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": self.model_name,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": kwargs.get("temperature", 0.7),
                        "num_predict": kwargs.get("max_tokens", 2048),
                    },
                },
            )
            response.raise_for_status()
            return response.json().get("response", "")

    async def is_available(self) -> bool:
        """Check if Ollama is running."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                return response.status_code == 200
        except Exception:
            return False


class AnthropicAdapter(ModelAdapter):
    """Anthropic cloud model adapter."""

    def __init__(self, api_key: str, model_name: str = "claude-3-sonnet-20240229"):
        self.api_key = api_key
        self.model_name = model_name

    async def generate(self, prompt: str, **kwargs) -> str:
        """Generate text using Anthropic."""
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": self.api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": self.model_name,
                    "max_tokens": kwargs.get("max_tokens", 2048),
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": kwargs.get("temperature", 0.7),
                },
            )
            response.raise_for_status()
            data = response.json()
            return data.get("content", [{}])[0].get("text", "")

    async def is_available(self) -> bool:
        """Check if Anthropic API is accessible."""
        return bool(self.api_key)


class OpenRouterAdapter(ModelAdapter):
    """OpenRouter development model adapter."""

    def __init__(self, api_key: str, model_name: str = "anthropic/claude-3-sonnet"):
        self.api_key = api_key
        self.model_name = model_name

    async def generate(self, prompt: str, **kwargs) -> str:
        """Generate text using OpenRouter."""
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model_name,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": kwargs.get("temperature", 0.7),
                    "max_tokens": kwargs.get("max_tokens", 2048),
                },
            )
            response.raise_for_status()
            data = response.json()
            return data.get("choices", [{}])[0].get("message", {}).get("content", "")

    async def is_available(self) -> bool:
        """Check if OpenRouter API is accessible."""
        return bool(self.api_key)


def get_model_adapter(
    provider: str = "ollama",
    model_name: str = "gemma:2b",
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
) -> ModelAdapter:
    """Factory function to get the appropriate model adapter."""
    if provider == "ollama":
        return OllamaAdapter(
            model_name=model_name,
            base_url=base_url or os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
        )
    elif provider == "anthropic":
        return AnthropicAdapter(
            api_key=api_key or os.getenv("ANTHROPIC_API_KEY", ""),
            model_name=model_name,
        )
    elif provider == "openrouter":
        return OpenRouterAdapter(
            api_key=api_key or os.getenv("OPENROUTER_API_KEY", ""),
            model_name=model_name,
        )
    else:
        raise ValueError(f"Unknown provider: {provider}")