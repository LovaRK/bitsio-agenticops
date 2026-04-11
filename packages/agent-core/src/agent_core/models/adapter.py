from __future__ import annotations

import os
from abc import ABC, abstractmethod


class ModelAdapter(ABC):
    @abstractmethod
    def generate(self, prompt: str, *, temperature: float = 0.1) -> str:
        raise NotImplementedError


class AnthropicModelAdapter(ModelAdapter):
    def __init__(self, model_name: str | None = None) -> None:
        self.api_key = os.getenv("ANTHROPIC_API_KEY", "")
        self.model_name = model_name or os.getenv("MODEL_NAME", "claude-3-5-sonnet-20241022")

    def generate(self, prompt: str, *, temperature: float = 0.1) -> str:
        if not self.api_key:
            return "Anthropic adapter running in mock mode: no API key configured."
        # Placeholder to keep unit tests and local setup deterministic without live API calls.
        return f"[anthropic:{self.model_name}] {prompt[:300]}"


class StubModelAdapter(ModelAdapter):
    def generate(self, prompt: str, *, temperature: float = 0.1) -> str:
        return f"stub:{prompt[:120]}"
