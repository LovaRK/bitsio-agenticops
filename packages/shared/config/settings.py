"""
Shared application configuration using Pydantic Settings.
All environment variables are loaded from .env (or process env).
"""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
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
    model_name: str = Field(default="qwen2.5:14b", alias="MODEL_NAME")
    ollama_base_url: str = Field(default="http://127.0.0.1:11434", alias="OLLAMA_BASE_URL")

    # ── Splunk MCP ────────────────────────────────────────────────────────────
    splunk_mcp_url: str = Field(default="http://localhost:8081", alias="SPLUNK_MCP_URL")
    splunk_mcp_token: str = Field(default="", alias="SPLUNK_MCP_TOKEN")

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

    @field_validator("environment")
    @classmethod
    def validate_environment(cls, v: str) -> str:
        allowed = {"dev", "staging", "prod"}
        if v not in allowed:
            raise ValueError(f"ENV must be one of {allowed}, got '{v}'")
        return v

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "populate_by_name": True}


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached singleton Settings instance."""
    return Settings()
