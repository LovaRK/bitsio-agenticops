import type { WasteDemoResponse, TelemetryMetricsResponse } from "@/types/api";
import type { TelemetryValueServiceContract } from "@/lib/services/contracts";
import { MAIN_TABS_ALLOW_FALLBACK, TELEMETRY_METRICS_TIMEOUT_MS } from "@/lib/config";
import { apiFetch, withTimeout } from "@/lib/http";
import telemetryValueStory from "@/lib/mocks/telemetry_value_story.json";
import { fetchWithFallback } from "@/lib/services/serviceFetch";

const demoFallback: WasteDemoResponse = telemetryValueStory as WasteDemoResponse;

export function getWasteDemoLocal(): WasteDemoResponse {
  return demoFallback;
}

function normalizeWasteResponse(
  payload: Partial<WasteDemoResponse>,
  defaults: { scenario: string; tenantId: string },
): WasteDemoResponse {
  return {
    workflow_id: payload.workflow_id ?? "wf_waste_unknown",
    scenario: payload.scenario ?? defaults.scenario,
    tenant_id: payload.tenant_id ?? defaults.tenantId,
    summary: payload.summary ?? "Waste analysis completed.",
    total_wasteful_sources: payload.total_wasteful_sources ?? 0,
    total_daily_ingest_gb: payload.total_daily_ingest_gb ?? 0,
    total_daily_wasted_gb: payload.total_daily_wasted_gb ?? 0,
    estimated_annual_savings_usd: payload.estimated_annual_savings_usd ?? 0,
    waste_pct: payload.waste_pct ?? 0,
    top_offenders: payload.top_offenders ?? [],
    recommendations: payload.recommendations ?? [],
    confidence: payload.confidence ?? 0,
    approval_required: payload.approval_required ?? false,
    guardrail_notes: payload.guardrail_notes ?? [],
    governance: payload.governance ?? {
      policy_id: "telemetry-waste-policy",
      policy_version: "v1.0.0",
      rule_triggered: (payload.approval_required ?? false) ? "require_approval" : "allow",
      approval_reason: (payload.approval_required ?? false)
        ? "Approval required due to policy threshold."
        : "No blocking policy violations.",
      source: "derived",
    },
    security: payload.security ?? {
      data_classification: "internal",
      compliance_frameworks: ["SOX", "PCI-DSS"],
      encryption_required: "in-transit + at-rest",
      risk_level: (payload.waste_pct ?? 0) >= 0.5 ? "high" : ((payload.waste_pct ?? 0) >= 0.2 ? "medium" : "low"),
      source: "derived",
    },
    calculation_assumptions: payload.calculation_assumptions ?? [],
    demo_profile: payload.demo_profile ?? "standard",
    amplification_factor: payload.amplification_factor,
  };
}

export async function getWasteDemo(): Promise<WasteDemoResponse> {
  const payload = await fetchWithFallback<WasteDemoResponse>({
    path: "/api/v1/waste/demo",
    fallbackFactory: () => demoFallback,
    warningMessage: "[api] Could not fetch waste demo, using mock data.",
  });
  return normalizeWasteResponse(payload, {
    scenario: "Demo waste profile",
    tenantId: "tenant_demo",
  });
}

export async function getWasteLive(
  tenantId = "tenant_demo",
  demoProfile: "standard" | "amplified" = "standard",
): Promise<WasteDemoResponse> {
  const payload = await withTimeout(
    apiFetch<Partial<WasteDemoResponse>>(
      `/api/v1/waste/analyze/live?tenant_id=${encodeURIComponent(tenantId)}&environment=dev&demo_profile=${demoProfile}`,
      {
        method: "POST",
      },
    ),
    6000,
    "waste-live",
  );
  return normalizeWasteResponse(payload, {
    scenario: "Live Splunk telemetry waste analysis",
    tenantId,
  });
}

function createMockTelemetryMetrics(): TelemetryMetricsResponse {
  const queryPlan: TelemetryMetricsResponse["query_plan"] = [
    {
      id: "index_volume_profile",
      description: "Estimate ingest volume by index and source type.",
      purpose: "Build annual spend baseline from observed ingest.",
      query:
        "search index=* earliest=-30d latest=now | eval event_bytes=len(_raw) | stats count AS total_events sum(event_bytes) AS total_bytes BY index, sourcetype",
      window_days: 30,
      status: "planned",
      backend: "splunk-auto",
    },
    {
      id: "search_usage_by_sourcetype",
      description: "Measure search usage by source type from audit logs.",
      purpose: "Detect under-utilized sources over the query window.",
      query:
        'index=_audit action=search earliest=-30d latest=now | rex field=search "sourcetype=(?<source_type>[^\\\\s|]+)" | stats count AS search_count_90d BY source_type',
      window_days: 30,
      status: "planned",
      backend: "splunk-auto",
    },
    {
      id: "search_usage_by_index",
      description: "Measure search usage by index from audit logs.",
      purpose: "Validate index-level demand and dashboard usage signal.",
      query:
        'index=_audit action=search earliest=-30d latest=now | rex field=search "index=(?<index_name>[^\\\\s|]+)" | stats count AS search_count_90d BY index_name',
      window_days: 30,
      status: "planned",
      backend: "splunk-auto",
    },
  ];

  return {
    summary: {
      total_annual_spend_usd: 2400000,
      total_potential_savings_usd: 580000,
      avg_utilization_score: 62,
      security_gap_count: 8,
      recommendation_complexity: "Medium",
    },
    sources: [
      {
        name: "Office 365",
        index: "office365",
        daily_ingest_gb: 45.2,
        utilization_score: 92,
        value_rating: "High",
        annual_spend_usd: 820000,
        potential_savings_usd: 45000,
        search_count_90d: 2150,
        dashboard_references: 18,
        alert_references: 12,
        recommendation: "Keep",
      },
      {
        name: "DNS Logs",
        index: "dns",
        daily_ingest_gb: 15.3,
        utilization_score: 78,
        value_rating: "High",
        annual_spend_usd: 420000,
        potential_savings_usd: 95000,
        search_count_90d: 890,
        dashboard_references: 7,
        alert_references: 5,
        recommendation: "Keep",
      },
      {
        name: "Cisco Nexus",
        index: "cisco_nexus",
        daily_ingest_gb: 120.8,
        utilization_score: 22,
        value_rating: "Low",
        annual_spend_usd: 680000,
        potential_savings_usd: 290000,
        search_count_90d: 45,
        dashboard_references: 1,
        alert_references: 0,
        recommendation: "Remove",
      },
      {
        name: "Windows Events",
        index: "windows_events",
        daily_ingest_gb: 62.5,
        utilization_score: 56,
        value_rating: "Medium",
        annual_spend_usd: 290000,
        potential_savings_usd: 120000,
        search_count_90d: 340,
        dashboard_references: 4,
        alert_references: 3,
        recommendation: "Optimize",
      },
      {
        name: "Application Logs",
        index: "app_logs",
        daily_ingest_gb: 28.9,
        utilization_score: 68,
        value_rating: "Medium",
        annual_spend_usd: 190000,
        potential_savings_usd: 30000,
        search_count_90d: 560,
        dashboard_references: 3,
        alert_references: 2,
        recommendation: "Optimize",
      },
    ],
    security_findings: [
      {
        id: "sec_001",
        category: "Detection",
        title: "Blind spot in cloud access detection",
        severity: "Critical",
        resolution_confidence_percent: 85,
        impact_on_savings_percent: 12,
        description: "SaaS cloud logs (Okta, GitHub) are not being indexed. Blind spot for unauthorized access detection.",
      },
      {
        id: "sec_002",
        category: "Detection",
        title: "Incomplete endpoint telemetry",
        severity: "High",
        resolution_confidence_percent: 78,
        impact_on_savings_percent: 8,
        description: "Only 60% of endpoints reporting logs. Missing visibility into rogue endpoint behavior.",
      },
      {
        id: "sec_003",
        category: "Investigation",
        title: "No forensic timeline correlation",
        severity: "High",
        resolution_confidence_percent: 72,
        impact_on_savings_percent: 6,
        description: "Log sources are not time-synchronized. Makes incident investigation difficult.",
      },
      {
        id: "sec_004",
        category: "Response",
        title: "Manual remediation workflows",
        severity: "Medium",
        resolution_confidence_percent: 88,
        impact_on_savings_percent: 4,
        description: "No automated response playbooks. All incidents require manual investigation.",
      },
      {
        id: "sec_005",
        category: "Detection",
        title: "Mobile device data missing",
        severity: "High",
        resolution_confidence_percent: 80,
        impact_on_savings_percent: 10,
        description: "No mobile device logs (iOS, Android). Blind spot for mobile-based threats.",
      },
      {
        id: "sec_006",
        category: "Investigation",
        title: "Weak data enrichment",
        severity: "Medium",
        resolution_confidence_percent: 75,
        impact_on_savings_percent: 5,
        description: "Limited threat intelligence and IP geolocation data enrichment.",
      },
      {
        id: "sec_007",
        category: "Response",
        title: "No real-time alerting",
        severity: "High",
        resolution_confidence_percent: 82,
        impact_on_savings_percent: 7,
        description: "Most alerts are 15-30 minutes delayed. Need immediate alerting for critical events.",
      },
      {
        id: "sec_008",
        category: "Detection",
        title: "User behavior baseline missing",
        severity: "Medium",
        resolution_confidence_percent: 70,
        impact_on_savings_percent: 3,
        description: "No UEBA (User and Entity Behavior Analytics) to detect anomalous patterns.",
      },
    ],
    savings_projection: [
      {
        month: 0,
        label: "Today",
        current_trajectory_usd: 2400000,
        optimized_trajectory_usd: 2400000,
      },
      {
        month: 1,
        label: "Month 1",
        current_trajectory_usd: 2400000,
        optimized_trajectory_usd: 2280000,
      },
      {
        month: 3,
        label: "Month 3",
        current_trajectory_usd: 2400000,
        optimized_trajectory_usd: 2040000,
      },
      {
        month: 6,
        label: "Month 6",
        current_trajectory_usd: 2400000,
        optimized_trajectory_usd: 1920000,
      },
      {
        month: 9,
        label: "Month 9",
        current_trajectory_usd: 2400000,
        optimized_trajectory_usd: 1880000,
      },
      {
        month: 12,
        label: "Month 12",
        current_trajectory_usd: 2400000,
        optimized_trajectory_usd: 1820000,
      },
    ],
    query_plan: queryPlan,
    executed_steps: queryPlan.map((step) => ({ ...step, status: "fallback" })),
    query_context: {
      adapter_mode: "auto",
      backend: "splunk-auto",
      live_mode: false,
      used_live_data: false,
      fallback_reason: "Mock telemetry response path.",
    },
    governance: {
      policy_id: "telemetry-waste-policy",
      policy_version: "v1.0.0",
      rule_triggered: "allow",
      approval_reason: "No blocking policy violations.",
      approval_status: "approved",
      data_owner: "Platform Team",
      last_reviewed: "2026-04-22",
      source: "derived",
    },
    security: {
      data_classification: "internal",
      compliance_frameworks: ["SOX", "PCI-DSS"],
      encryption_required: "in-transit + at-rest",
      risk_level: "high",
      security_confidence: 78,
      source: "derived",
    },
    conflicts: [
      {
        source: "cisco_nexus",
        recommendation: "Remove",
        conflict_reason: "Retention overlap with SOX investigation requirements.",
        suggested_action: "Change action to Optimize (retention 30d -> 7d) and keep metadata fields.",
        severity: "high",
      },
    ],
    trust: {
      data_source: "fallback",
      fallback_used: true,
      adapter_mode: "auto",
      backend: "splunk-auto",
      latency_ms: 130,
      confidence: 0.82,
      freshness: "5 minutes ago",
      coverage_pct: 92,
      source: "derived",
    },
    actions: [
      {
        id: "review_policy",
        label: "Review Policy",
        description: "Validate retention and removal guardrails before execution.",
        cta: "review_policy",
        severity: "high",
        source_target: "cisco_nexus",
        issue: "Remove recommendation conflicts with retention governance.",
        suggested_value: "Switch to optimize and keep compliance-safe fields.",
        decision_confidence: 0.82,
        impact_preview: {
          savings_delta_usd: 0,
          risk_before: "high",
          risk_after: "medium",
          compliance_safe: true,
        },
        source: "derived",
      },
      {
        id: "adjust_retention",
        label: "Adjust Retention",
        description: "Reduce retention for low-value sources to cut storage spend safely.",
        cta: "adjust_retention",
        severity: "medium",
        source_target: "windows_events",
        issue: "Medium utilization with measurable storage overhead.",
        current_value: "30 days",
        suggested_value: "7 days",
        estimated_savings_usd: 120000,
        decision_confidence: 0.78,
        impact_preview: {
          savings_delta_usd: 26400,
          risk_before: "medium",
          risk_after: "medium",
          compliance_safe: true,
        },
        source: "derived",
      },
      {
        id: "assign_owner",
        label: "Assign Owner",
        description: "Set clear source ownership for governance follow-up.",
        cta: "assign_owner",
        severity: "low",
        source_target: "app_logs",
        issue: "No accountable owner assigned for optimization tracking.",
        owner: "Unassigned",
        decision_confidence: 0.74,
        impact_preview: {
          savings_delta_usd: 0,
          risk_before: "medium",
          risk_after: "low",
          compliance_safe: true,
        },
        source: "derived",
      },
    ],
  };
}

function createEmptyTelemetryMetrics(): TelemetryMetricsResponse {
  return {
    summary: {
      total_annual_spend_usd: 0,
      total_potential_savings_usd: 0,
      avg_utilization_score: 0,
      security_gap_count: 0,
      recommendation_complexity: "Low" as const,
    },
    sources: [],
    security_findings: [],
    savings_projection: [],
    query_plan: [],
    executed_steps: [],
    query_context: {
      adapter_mode: "auto",
      backend: "splunk-auto",
      live_mode: false,
      used_live_data: false,
      fallback_reason: "Live data mode: API call failed, showing zero instead of mock data.",
    },
    governance: {
      policy_id: "telemetry-waste-policy",
      policy_version: "v1.0.0",
      rule_triggered: "deny",
      approval_reason: "No live data available.",
      approval_status: "rejected",
      data_owner: "Unknown",
      last_reviewed: new Date().toISOString(),
      source: "derived",
    },
    security: {
      data_classification: "unknown",
      compliance_frameworks: [],
      encryption_required: "in-transit + at-rest",
      risk_level: "unknown",
      security_confidence: 0,
      source: "derived",
    },
    conflicts: [],
    trust: {
      data_source: "none",
      fallback_used: false,
      adapter_mode: "auto",
      backend: "splunk-auto",
      latency_ms: 0,
      confidence: 0,
      freshness: "unavailable",
      coverage_pct: 0,
      source: "derived",
    },
    actions: [],
  };
}

export interface TelemetryMetricsOptions {
  isLocalModel?: boolean;
  isLiveMode?: boolean;
}

export async function getTelemetryMetrics(
  options?: TelemetryMetricsOptions,
): Promise<TelemetryMetricsResponse> {
  const isLocalModelLiveMode = options?.isLocalModel && options?.isLiveMode;
  const shouldDisallowFallback = isLocalModelLiveMode;

  return fetchWithFallback<TelemetryMetricsResponse>({
    path: "/api/v1/waste/telemetry/metrics",
    fallbackFactory: shouldDisallowFallback ? createEmptyTelemetryMetrics : createMockTelemetryMetrics,
    warningMessage: shouldDisallowFallback
      ? "[api] Could not fetch live telemetry metrics, showing zero (local model mode requires real data only)."
      : "[api] Could not fetch telemetry metrics, using mock data.",
    allowFallback: shouldDisallowFallback ? false : MAIN_TABS_ALLOW_FALLBACK,
    timeoutMs: TELEMETRY_METRICS_TIMEOUT_MS,
    timeoutLabel: "telemetry-metrics",
  });
}

export const telemetryValueService: TelemetryValueServiceContract = {
  getTelemetryMetrics,
};
