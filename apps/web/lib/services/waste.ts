import type { WasteDemoResponse, TelemetryMetricsResponse } from "@/types/api";
import { apiFetch, canFallback, withTimeout } from "@/lib/http";
import telemetryValueStory from "@/lib/mocks/telemetry_value_story.json";

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
    calculation_assumptions: payload.calculation_assumptions ?? [],
    demo_profile: payload.demo_profile ?? "standard",
    amplification_factor: payload.amplification_factor,
  };
}

export async function getWasteDemo(): Promise<WasteDemoResponse> {
  try {
    const payload = await apiFetch<WasteDemoResponse>("/api/v1/waste/demo");
    return normalizeWasteResponse(payload, {
      scenario: "Demo waste profile",
      tenantId: "tenant_demo",
    });
  } catch (error) {
    if (!canFallback()) {
      throw error;
    }
    return demoFallback;
  }
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
  };
}

export async function getTelemetryMetrics(): Promise<TelemetryMetricsResponse> {
  try {
    const response = await apiFetch<TelemetryMetricsResponse>("/api/v1/telemetry/metrics");
    return response;
  } catch (error) {
    if (!canFallback()) {
      throw error;
    }
    console.warn("[api] Could not fetch telemetry metrics, using mock data.", error);
    return createMockTelemetryMetrics();
  }
}
