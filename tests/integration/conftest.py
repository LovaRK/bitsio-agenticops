"""Integration test configuration.

Forces SPLUNK_LIVE_MODE=false so seed incidents are used instead of
hitting a live Splunk instance that won't be available in CI or local test runs.
"""

import os

import pytest

# Set before any app module is imported so the lru_cache picks it up.
os.environ["SPLUNK_LIVE_MODE"] = "false"


@pytest.fixture(autouse=True)
def disable_live_splunk() -> None:
    """Clear settings cache and force live mode off for every test."""
    from packages.shared.config.settings import get_settings

    get_settings.cache_clear()
    os.environ["SPLUNK_LIVE_MODE"] = "false"
    yield
    get_settings.cache_clear()
