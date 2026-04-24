from __future__ import annotations

import os

import pytest

# Force safe deterministic test mode before app modules are imported.
os.environ["SPLUNK_LIVE_MODE"] = "false"


def _clear_runtime_caches() -> None:
    from apps.api.app.dependencies import (
        get_incident_context_graph,
        get_splunk_adapter,
        get_splunk_adapter_agentic,
        get_splunk_adapter_native_default,
        get_splunk_incident_service,
        get_trace_store,
    )
    from packages.shared.config.settings import get_settings

    get_settings.cache_clear()

    for fn in (
        get_splunk_adapter,
        get_splunk_adapter_native_default,
        get_splunk_adapter_agentic,
        get_splunk_incident_service,
        get_incident_context_graph,
        get_trace_store,
    ):
        if hasattr(fn, "cache_clear"):
            fn.cache_clear()


@pytest.fixture(autouse=True)
def _isolate_runtime_settings() -> None:
    _clear_runtime_caches()
    yield
    _clear_runtime_caches()
