/**
 * Mock settings data for development and fallback.
 */

import type { SettingsSnapshot } from "@/types/api";

export function mockSettingsSnapshot(): SettingsSnapshot {
  return {
    platform_name: "BitsIO AgenticOps",
    environment: "local",
    timezone: "UTC",
    splunk: {
      adapter_mode: "native",
      live_mode: true,
      base_url: "http://localhost:8081",
      web_base_url: "http://localhost:8000",
      connected: false,
      index_count: 0,
    },
    model: {
      provider: "ollama",
      name: "qwen2.5:7b",
      runtime: "local",
      base_url: "http://127.0.0.1:11434",
      mock_mode: false,
    },
    runtime: {
      mode: "LOCAL_INTEGRATION",
    },
    security: {
      rbac_enabled: true,
      rate_limit_per_minute: 100,
      oidc_boundary: true,
    },
  };
}
