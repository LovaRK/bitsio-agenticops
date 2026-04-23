from __future__ import annotations

from apps.api.app.dependencies import _resolve_splunk_mode
from apps.api.app.routers.settings import RuntimeMode, _resolve_runtime_mode, _runtime_mode_config


def test_resolve_runtime_mode_local_dev() -> None:
    mode = _resolve_runtime_mode(model_provider="ollama", splunk_live_mode=False)
    assert mode == RuntimeMode.LOCAL_DEV


def test_resolve_runtime_mode_cloud_live() -> None:
    mode = _resolve_runtime_mode(model_provider="anthropic", splunk_live_mode=True)
    assert mode == RuntimeMode.CLOUD_LIVE


def test_runtime_mode_matrix_cloud_model_test() -> None:
    cfg = _runtime_mode_config(RuntimeMode.CLOUD_MODEL_TEST)
    assert cfg["model_provider"] == "anthropic"
    assert cfg["splunk_live_mode"] is False
    assert cfg["splunk_adapter_mode"] == "auto"


def test_runtime_mode_matrix_local_integration() -> None:
    cfg = _runtime_mode_config(RuntimeMode.LOCAL_INTEGRATION)
    assert cfg["model_provider"] == "ollama"
    assert cfg["splunk_live_mode"] is True
    assert cfg["splunk_adapter_mode"] == "native"


def test_splunk_mode_auto_prefers_native_for_deterministic_workloads() -> None:
    resolved = _resolve_splunk_mode(
        "auto",
        "https://splunk.example.com/services/mcp",
        workload="deterministic",
    )
    assert resolved == "native"


def test_splunk_mode_auto_prefers_mcp_for_agentic_workloads_when_available() -> None:
    resolved = _resolve_splunk_mode(
        "auto",
        "https://splunk.example.com/services/mcp",
        workload="agentic",
    )
    assert resolved == "mcp"


def test_splunk_mode_auto_falls_back_to_native_for_agentic_without_mcp_path() -> None:
    resolved = _resolve_splunk_mode("auto", "https://splunk.example.com", workload="agentic")
    assert resolved == "native"
