"""
Shared application configuration using Pydantic Settings.
All environment variables are loaded from .env (or process env).
"""

from __future__ import annotations

import sys
from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _should_load_env_file() -> bool:
    """Skip loading .env during tests to use defaults instead."""
    # Check if pytest is running by looking for PYTEST_CURRENT_TEST or pytest in sys.modules
    return "pytest" not in sys.modules


class Settings(BaseSettings):
    """Application settings with test-aware env file loading."""

    model_config = SettingsConfigDict(
        env_file=".env" if _should_load_env_file() else None,
        env_file_encoding="utf-8",
        populate_by_name=True,
        extra="ignore",
    )
    # ── Database ──────────────────────────────────────────────────────────────
    database_url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/bitsio",
        alias="DATABASE_URL",
    )

    # ── Redis ─────────────────────────────────────────────────────────────────
    redis_url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")

    # ── LLM ───────────────────────────────────────────────────────────────────
    model_provider: str = Field(default="ollama", alias="MODEL_PROVIDER")
    anthropic_api_key: str = Field(default="", alias="ANTHROPIC_API_KEY")
    model_name: str = Field(default="qwen2.5:7b", alias="MODEL_NAME")
    ollama_base_url: str = Field(default="http://127.0.0.1:11434", alias="OLLAMA_BASE_URL")

    # ── Splunk MCP ────────────────────────────────────────────────────────────
    splunk_mcp_base_url: str = Field(default="http://localhost:8081", alias="SPLUNK_MCP_BASE_URL")
    splunk_mcp_token: str = Field(default="", alias="SPLUNK_MCP_TOKEN")
    splunk_mcp_role: str = Field(default="read_only", alias="SPLUNK_MCP_ROLE")
    splunk_mcp_ssl_verify: bool = Field(default=True, alias="SPLUNK_MCP_SSL_VERIFY")
    splunk_auth_scheme: str = Field(default="Bearer", alias="SPLUNK_AUTH_SCHEME")
    splunk_adapter_mode: str = Field(default="native", alias="SPLUNK_ADAPTER_MODE")
    splunk_web_base_url: str = Field(default="", alias="SPLUNK_WEB_BASE_URL")
    splunk_live_mode: bool = Field(default=True, alias="SPLUNK_LIVE_MODE")

    # ── Auth / OIDC ───────────────────────────────────────────────────────────
    oidc_issuer: str = Field(default="", alias="OIDC_ISSUER")
    oidc_audience: str = Field(default="", alias="OIDC_AUDIENCE")

    # ── OTel ─────────────────────────────────────────────────────────────────
    otel_exporter_otlp_endpoint: str = Field(
        default="http://localhost:4317", alias="OTEL_EXPORTER_OTLP_ENDPOINT"
    )

    # ── App ───────────────────────────────────────────────────────────────────
    environment: str = Field(default="dev", alias="ENV")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    graph_name: str = "telemetry_value_agent"
    graph_version: str = "v1.0.0"
    web_base_url: str = Field(default="http://localhost:3000", alias="WEB_BASE_URL")
    rate_limit_per_minute: int = Field(default=100, alias="RATE_LIMIT_PER_MINUTE")
    tenant_safe_id: str = Field(default="tenant_demo", alias="TENANT_SAFE_ID")
    app_timezone: str = Field(default="UTC", alias="APP_TIMEZONE")
    model_mock_mode: bool = Field(default=False, alias="MODEL_MOCK_MODE")
    telemetry_metrics_search_window_days: int = Field(
        default=30,
        alias="TELEMETRY_METRICS_SEARCH_WINDOW_DAYS",
    )
    telemetry_metrics_cache_ttl_seconds: int = Field(
        default=45,
        alias="TELEMETRY_METRICS_CACHE_TTL_SECONDS",
    )

    @field_validator("environment")
    @classmethod
    def validate_environment(cls, v: str) -> str:
        allowed = {"dev", "staging", "prod"}
        if v not in allowed:
            raise ValueError(f"ENV must be one of {allowed}, got '{v}'")
        return v


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached singleton Settings instance."""
    return Settings()
