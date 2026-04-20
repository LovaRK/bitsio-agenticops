/**
 * Incident API service.
 * Handles fetching and managing incident data.
 */

import type { DecisionTrace } from "@/types/decision-trace";
import type { IncidentSummary } from "@/types/api";
import { MAIN_TABS_ALLOW_FALLBACK, USE_MOCK_FALLBACK } from "@/lib/config";
import { apiFetch, canFallback } from "@/lib/http";
import { mockIncidents, pickMockIncident } from "@/lib/mocks/incidents";
import type { IncidentServiceContract } from "@/lib/services/contracts";
import { buildFallbackNodeRuns, deriveRuntimeMetadataFromSettings } from "@/lib/services/incidentTraceAssembly";
import { fetchWithFallback } from "@/lib/services/serviceFetch";
import { getSettingsSnapshot } from "@/lib/services/settings";

export async function listIncidents(): Promise<IncidentSummary[]> {
  const response = await fetchWithFallback<{ items: IncidentSummary[] }>({
    path: "/api/v1/incidents",
    fallbackFactory: () => ({ items: mockIncidents() }),
    warningMessage: "[api] Could not fetch incidents, using mock data.",
    allowFallback: MAIN_TABS_ALLOW_FALLBACK,
  });
  return response.items;
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

export const incidentService: IncidentServiceContract = {
  listIncidents,
  getIncidentDetail,
};
