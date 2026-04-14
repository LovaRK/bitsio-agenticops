/**
 * Incident API service.
 * Handles fetching and managing incident data.
 */

import type { DecisionTrace } from "@/types/decision-trace";
import type { IncidentSummary } from "@/types/api";
import { USE_MOCK_FALLBACK, ACTION_TIMEOUT_MS } from "@/lib/config";
import { apiFetch, withTimeout, canFallback } from "@/lib/http";
import { mockIncidents, pickMockIncident } from "@/lib/mocks/incidents";
import { getSettingsSnapshot } from "@/lib/services/settings";

function deriveRuntimeMetadataFromSettings(
  settings: Awaited<ReturnType<typeof getSettingsSnapshot>> | null,
): NonNullable<DecisionTrace["run_metadata"]> {
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

function buildFallbackNodeRuns(
  timestamp: string,
  runtimeMetadata: NonNullable<DecisionTrace["run_metadata"]>,
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

export async function listIncidents(): Promise<IncidentSummary[]> {
  if (USE_MOCK_FALLBACK) {
    return mockIncidents();
  }

  try {
    const response = await apiFetch<{ items: IncidentSummary[] }>("/api/v1/incidents");
    return response.items;
  } catch (err) {
    if (!canFallback()) {
      throw err;
    }
    console.warn("[api] Could not fetch incidents, using mock data.", err);
    return mockIncidents();
  }
}

export async function getIncidentDetail(id: string): Promise<DecisionTrace> {
  if (USE_MOCK_FALLBACK) {
    return pickMockIncident(id);
  }

  try {
    const settings = await getSettingsSnapshot().catch(() => null);
    const derivedRuntime = deriveRuntimeMetadataFromSettings(settings);
    const trace = await apiFetch<Partial<DecisionTrace>>(
      `/api/v1/decision-traces/${id}`
    );

    // Ensure required fields exist (API may not return them yet)
    const defaultNodeRuns = trace.node_runs && trace.node_runs.length > 0
      ? trace.node_runs
      : buildFallbackNodeRuns(trace.timestamp || new Date().toISOString(), {
          ...derivedRuntime,
          run_time_ms: trace.run_metadata?.run_time_ms ?? derivedRuntime.run_time_ms,
        });

    const runMetadata = trace.run_metadata
      ? { ...derivedRuntime, ...trace.run_metadata, source: trace.run_metadata.source ?? "reported" }
      : derivedRuntime;

    return {
      ...trace,
      node_runs: defaultNodeRuns,
      confidence: trace.confidence ?? 0.78,
      assigned_agent: trace.assigned_agent ?? "Observer-Prime",
      run_metadata: runMetadata,
    } as DecisionTrace;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isDecisionTraceFetchError =
      message.includes("/api/v1/decision-traces/") ||
      message.includes("decision trace") ||
      message.includes("Splunk MCP decision trace fetch failed");

    if (!isDecisionTraceFetchError && !canFallback()) {
      throw err;
    }

    const settings = await getSettingsSnapshot().catch(() => null);
    const derivedRuntime = deriveRuntimeMetadataFromSettings(settings);
    const fallback = pickMockIncident(id);
    const incidentId = id.startsWith("wf_") ? id.replace(/^wf_/, "") : id;
    const workflowId = id.startsWith("wf_") ? id : `wf_${incidentId}`;

    console.warn(`[api] Could not fetch trace ${id}, using fallback trace.`, err);
    return {
      ...fallback,
      workflow_id: workflowId,
      incident_id: incidentId,
      run_metadata: {
        ...derivedRuntime,
        run_time_ms: fallback.run_metadata?.run_time_ms ?? 0,
        source: "derived",
      },
      summary:
        "Live decision trace was unavailable, so this page is rendering a local fallback trace. Reconnect Splunk and refresh for live evidence.",
      probable_cause: fallback.probable_cause || "Live evidence unavailable.",
      missing_evidence: [
        ...(fallback.missing_evidence ?? []),
        "live_decision_trace_unavailable",
      ],
    };
  }
}
