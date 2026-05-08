"""Runtime profile resolution for settings/runtime control plane."""

from __future__ import annotations

from enum import Enum


class RuntimeMode(str, Enum):
    LOCAL_DEV = "LOCAL_DEV"
    LOCAL_INTEGRATION = "LOCAL_INTEGRATION"
    CLOUD_MODEL_TEST = "CLOUD_MODEL_TEST"
    CLOUD_LIVE = "CLOUD_LIVE"


def resolve_runtime_mode(*, model_provider: str, splunk_live_mode: bool) -> RuntimeMode:
    provider = model_provider.strip().lower()
    if provider == "anthropic":
        return RuntimeMode.CLOUD_LIVE if splunk_live_mode else RuntimeMode.CLOUD_MODEL_TEST
    return RuntimeMode.LOCAL_INTEGRATION if splunk_live_mode else RuntimeMode.LOCAL_DEV


def runtime_mode_config(mode: RuntimeMode) -> dict[str, str | bool]:
    # Single source of truth for profile-based runtime switching.
    if mode == RuntimeMode.LOCAL_DEV:
        return {
            "model_provider": "ollama",
            "model_name": "qwen2.5:7b",
            "model_mock_mode": False,
            "splunk_live_mode": False,
            "splunk_adapter_mode": "auto",
        }
    if mode == RuntimeMode.LOCAL_INTEGRATION:
        return {
            "model_provider": "ollama",
            "model_name": "qwen2.5:7b",
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


def runtime_label_for_provider(model_provider: str) -> str:
    return "local" if model_provider.strip().lower() == "ollama" else "cloud"
