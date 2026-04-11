from __future__ import annotations

import logging
import os
from abc import ABC, abstractmethod

import httpx

logger = logging.getLogger(__name__)


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
