/**
 * Mock monitoring data for development and fallback.
 */

import type { MonitoringOverview } from "@/types/api";

export function mockMonitoringOverview(): MonitoringOverview {
  return {
    kpis: {
      global_uptime: "99.90%",
      active_nodes: 3,
      avg_latency_ms: 88,
      system_load_percent: 34,
    },
    kpi_explanations: [
      {
        label: "Global Uptime",
        formula: "Mean service uptime across core services",
        source: "derived",
        freshness: new Date().toISOString(),
      },
      {
        label: "Active Nodes",
        formula: "Visible index count with safety floor",
        source: "reported",
        freshness: new Date().toISOString(),
      },
      {
        label: "Avg Latency",
        formula: "Mean latency across control plane, adapter, worker",
        source: "derived",
        freshness: new Date().toISOString(),
      },
      {
        label: "System Load",
        formula: "Mean load score across core services",
        source: "derived",
        freshness: new Date().toISOString(),
      },
    ],
    agent_runtime: {
      window_minutes: 15,
      model_provider: "ollama",
      model_name: "qwen2.5:14b",
      runtime_mode: "local",
      splunk_mode: "mcp",
      llm_calls: 3,
      retrieval_calls: 3,
      policy_calls: 2,
      avg_llm_latency_ms: 140,
      avg_retrieval_latency_ms: 90,
      avg_policy_latency_ms: 24,
      prompt_tokens: 1200,
      completion_tokens: 550,
      total_tokens: 1750,
      estimated_cost_usd: 0.0014,
      token_source: "derived",
      cost_source: "derived",
      freshness: new Date().toISOString(),
    },
    services: [
      {
        name: "FastAPI Control Plane",
        status: "Healthy",
        uptime: "99.95%",
        latency_ms: 24,
        load_percent: 20,
      },
    ],
    indexes: [{ name: "tutorial", size_mb: 12, event_count: 1000 }],
    server_info: { version: "mock", build: "mock", mode: "mock" },
  };
}
