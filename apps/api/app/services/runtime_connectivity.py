"""Runtime connectivity checks for model and Splunk backends."""

from __future__ import annotations

import httpx

from agent_core.models.adapter import AnthropicModelAdapter, OllamaModelAdapter
from apps.api.app.services.contracts import IncidentServiceProtocol
from packages.shared.config.settings import Settings


def check_model_connectivity(cfg: Settings) -> dict[str, str | bool]:
    provider = cfg.model_provider.strip().lower()
    if cfg.model_mock_mode or provider == "stub":
        return {"connected": True, "detail": "stub: mock mode enabled"}

    if provider == "anthropic":
        if not cfg.anthropic_api_key.strip():
            return {"connected": False, "detail": "missing ANTHROPIC_API_KEY"}
        try:
            sample = AnthropicModelAdapter(model_name=cfg.model_name).generate(
                "Respond with OK only.",
                temperature=0.0,
            )
            ok = not sample.startswith("[fallback]")
            return {"connected": ok, "detail": "OK" if ok else sample[:120]}
        except Exception as exc:  # noqa: BLE001
            return {"connected": False, "detail": f"{type(exc).__name__}: {exc}"}

    if provider == "ollama":
        try:
            base_url = cfg.ollama_base_url.rstrip("/")
            response = httpx.get(f"{base_url}/api/tags", timeout=10.0)
            response.raise_for_status()
            payload = response.json()
            models = {
                str(model.get("name", "")).strip()
                for model in payload.get("models", [])
                if isinstance(model, dict)
            }
            if cfg.model_name in models:
                return {"connected": True, "detail": f"OK ({cfg.model_name} available)"}
            if models:
                preview = ", ".join(sorted(models)[:4])
                return {
                    "connected": False,
                    "detail": f"model '{cfg.model_name}' not installed; available: {preview}",
                }
            return {"connected": False, "detail": "Ollama reachable but no models installed"}
        except Exception as exc:  # noqa: BLE001
            return {"connected": False, "detail": f"{type(exc).__name__}: {exc}"}

    return {"connected": False, "detail": f"unsupported provider: {provider}"}


def check_splunk_connectivity(
    cfg: Settings,
    *,
    splunk_service: IncidentServiceProtocol,
) -> dict[str, str | bool]:
    if not cfg.splunk_live_mode:
        return {"connected": True, "detail": "Live Splunk disabled (using local mock data)."}

    try:
        index_count = len(splunk_service.adapter.list_indexes())
        return {"connected": True, "detail": f"{index_count} indexes visible"}
    except Exception as exc:  # noqa: BLE001
        return {"connected": False, "detail": f"{type(exc).__name__}: {exc}"}
