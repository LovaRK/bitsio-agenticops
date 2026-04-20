import type { SettingsSnapshot } from "@/types/api";
import type { DecisionTrace } from "@/types/decision-trace";

export type RuntimeMetadata = NonNullable<DecisionTrace["run_metadata"]>;

export function deriveRuntimeMetadataFromSettings(
  settings: SettingsSnapshot | null,
): RuntimeMetadata {
  if (!settings) {
    return {
      model_provider: "unknown",
      model_name: "unknown",
      runtime_mode: "cloud",
      splunk_mode: "auto",
      run_time_ms: 0,
      source: "derived",
    };
  }

  return {
    model_provider: settings.model.provider,
    model_name: settings.model.name,
    runtime_mode: settings.model.runtime === "local" ? "local" : "cloud",
    splunk_mode:
      settings.splunk.adapter_mode === "mcp" ||
      settings.splunk.adapter_mode === "native" ||
      settings.splunk.adapter_mode === "auto"
        ? settings.splunk.adapter_mode
        : "auto",
    run_time_ms: 0,
    source: "derived",
  };
}

export function buildFallbackNodeRuns(
  timestamp: string,
  runtimeMetadata: RuntimeMetadata,
): DecisionTrace["node_runs"] {
  const llmProvider = `${runtimeMetadata.model_provider ?? "unknown"}/${runtimeMetadata.runtime_mode ?? "unknown"}`;
  const llmModel = runtimeMetadata.model_name ?? "unknown";
  const splunkMode = runtimeMetadata.splunk_mode ?? "auto";

  return [
    {
      node_name: "incident_ingest",
      status: "success",
      started_at: timestamp,
      duration_ms: 50,
      tool_calls: [],
      policy_checks: [],
    },
    {
      node_name: "evidence_retrieval",
      status: "success",
      started_at: timestamp,
      duration_ms: 200,
      tool_calls: [
        {
          tool_name: "run_search",
          status: "success",
          tool_type: "retrieval",
          token_usage: { prompt: 0, completion: 0, total: 0, source: "not_applicable" },
          metric_source: { token_usage: "not_applicable", latency: "derived", confidence_impact: "derived" },
          latency_ms: 120,
          confidence_impact: 0.26,
          provider: `splunk/${splunkMode}`,
          model_name: "n/a",
          runtime_mode: runtimeMetadata.runtime_mode,
          splunk_mode: splunkMode,
          explainability_notes: [
            "Retrieval tools do not consume LLM tokens.",
          ],
        },
      ],
      policy_checks: [],
    },
    {
      node_name: "correlation",
      status: "success",
      started_at: timestamp,
      duration_ms: 100,
      tool_calls: [],
      policy_checks: [],
    },
    {
      node_name: "reasoning_draft",
      status: "success",
      started_at: timestamp,
      duration_ms: 150,
      tool_calls: [
        {
          tool_name: "llm_call",
          status: "success",
          tool_type: "llm",
          metric_source: { token_usage: "derived", latency: "derived", confidence_impact: "derived" },
          latency_ms: 150,
          confidence_impact: 0.18,
          provider: llmProvider,
          model_name: llmModel,
          runtime_mode: runtimeMetadata.runtime_mode,
          splunk_mode: splunkMode,
          explainability_notes: [
            "Token and cost values are available only when runtime tracing is reported for this run.",
          ],
        },
      ],
      policy_checks: [],
    },
    {
      node_name: "confidence_score",
      status: "success",
      started_at: timestamp,
      duration_ms: 30,
      tool_calls: [],
      policy_checks: [],
    },
    {
      node_name: "approval_check",
      status: "success",
      started_at: timestamp,
      duration_ms: 20,
      tool_calls: [
        {
          tool_name: "policy_evaluator",
          status: "success",
          tool_type: "policy",
          token_usage: { prompt: 0, completion: 0, total: 0, source: "not_applicable" },
          metric_source: { token_usage: "not_applicable", latency: "derived", confidence_impact: "derived" },
          latency_ms: 20,
          confidence_impact: 0.08,
          provider: "policy-engine",
          model_name: "n/a",
          runtime_mode: runtimeMetadata.runtime_mode,
          splunk_mode: splunkMode,
          explainability_notes: ["Deterministic policy evaluation; token usage is not applicable."],
        },
      ],
      policy_checks: [{ rule_id: "rbac_analyst", matched: true, action: "allow" }],
    },
    {
      node_name: "final_response",
      status: "success",
      started_at: timestamp,
      duration_ms: 10,
      tool_calls: [],
      policy_checks: [],
    },
  ];
}
