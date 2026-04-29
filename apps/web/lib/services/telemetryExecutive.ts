/**
 * datasensAI v3 Executive Telemetry — service layer.
 * Calls GET /api/v1/telemetry/executive-summary with scoring config query params.
 */

import { apiFetch } from "@/lib/http";
import { fetchWithFallback } from "@/lib/services/serviceFetch";
import type {
  ExecutiveSummaryResponse,
  ScoringConfig,
  TierName,
} from "@/types/telemetry-executive";

// ── Realistic fallback dataset (mirrors seed data from Python backend) ────────

const FALLBACK: ExecutiveSummaryResponse = {
  executive_kpis: {
    roi_score: 43.2,
    gainscope: 33.4,
    low_value_license_spend_usd: 4256226.75,
    storage_savings_potential_usd: 3900000.0,
    total_daily_volume_gb: 135.77,
    total_sourcetypes_assessed: 22,
    total_annual_spend_usd: 7440126.0,
  },
  data_value_split: {
    volume: {
      utilized_gb: 45.32,
      underutilized_gb: 90.45,
      utilized_pct: 33.4,
      underutilized_pct: 66.6,
    },
    sourcetype_count: {
      utilized_count: 6,
      underutilized_count: 16,
      utilized_pct: 27.3,
      underutilized_pct: 72.7,
    },
  },
  quick_wins: [
    {
      rank: 1,
      category: "Archive to S3",
      action: "Route 'tomcat:runtime.log' to S3 cold storage, access via Federated Search",
      sourcetype: "tomcat:runtime.log",
      estimated_impact_usd: 1484122.5,
      details: "30.10 GB/day, utilization score=7",
    },
    {
      rank: 2,
      category: "Retention Optimization",
      action: "Reduce retention on index 'app_loyalty' from 90→30 days",
      sourcetype: "app:car.loyalty.sms:processor",
      estimated_impact_usd: 630525.0,
      details: "17.26 GB/day, currently retaining 90 days",
    },
    {
      rank: 3,
      category: "Field Optimization",
      action:
        "Filter unused fields from 'app:car.loyalty.sms:processor' — 34 of 40 fields never searched",
      sourcetype: "app:car.loyalty.sms:processor",
      estimated_impact_usd: 238736.25,
      details: "17.26 GB/day, 85.0% of fields unused",
    },
  ],
  tier_distribution: {
    Critical: { count: 2, annual_cost_usd: 852307.5, daily_gb: 15.55, pct: 9.1 },
    Important: { count: 4, annual_cost_usd: 185655.75, daily_gb: 1.77, pct: 18.2 },
    "Nice-to-Have": { count: 8, annual_cost_usd: 2345712.0, daily_gb: 47.63, pct: 36.4 },
    Wasteful: { count: 8, annual_cost_usd: 4056451.5, daily_gb: 70.82, pct: 36.4 },
  } as Record<TierName, { count: number; annual_cost_usd: number; daily_gb: number; pct: number }>,
  score_profiles_by_tier: {
    Critical: { utilization: 79.5, detection: 82.1, quality: 100.0 },
    Important: { utilization: 49.4, detection: 29.5, quality: 100.0 },
    "Nice-to-Have": { utilization: 18.2, detection: 15.3, quality: 100.0 },
    Wasteful: { utilization: 5.2, detection: 0.0, quality: 99.9 },
  },
  savings_staircase: [
    {
      stage: 1,
      label: "Current Spend",
      annual_cost_usd: 7440126.0,
      description: "Your current annual Splunk license cost across all sourcetypes.",
    },
    {
      stage: 2,
      label: "After Quick Actions",
      annual_cost_usd: 5208088.2,
      description: "Savings from reducing retention on Wasteful sourcetypes (90→30 days).",
    },
    {
      stage: 3,
      label: "After Field Tuning",
      annual_cost_usd: 3906066.15,
      description: "Additional savings from filtering unused fields (those never searched).",
    },
    {
      stage: 4,
      label: "After S3 Archival",
      annual_cost_usd: 1953033.0,
      description: "Savings from moving Nice-to-Have data (>1 GB/day) to S3 cold storage.",
    },
    {
      stage: 5,
      label: "Optimized Target",
      annual_cost_usd: 1718669.04,
      description: "Final optimized state with ongoing query tuning applied.",
    },
  ],
  top_sourcetypes_by_volume: [
    { sourcetype: "tomcat:runtime.log", gb_per_day: 30.1, tier: "Wasteful", composite: 27.5 },
    { sourcetype: "fortigate_traffic", gb_per_day: 24.14, tier: "Nice-to-Have", composite: 44.5 },
    { sourcetype: "app:car.loyalty.sms:processor", gb_per_day: 17.26, tier: "Wasteful", composite: 25.4 },
    { sourcetype: "fortigate_utm", gb_per_day: 14.67, tier: "Important", composite: 55.6 },
    { sourcetype: "WinEventLog", gb_per_day: 13.86, tier: "Critical", composite: 79.7 },
    { sourcetype: "fgt_traffic", gb_per_day: 9.88, tier: "Wasteful", composite: 29.1 },
  ],
  s3_candidates: [
    {
      sourcetype: "tomcat:runtime.log",
      tier: "Wasteful",
      composite: 27.5,
      gb_per_day: 30.1,
      annual_cost_usd: 1649025.0,
      utilization: 7.19,
      detection: 0.0,
      recommended_action: "Strong S3 candidate — high volume, rarely searched",
    },
    {
      sourcetype: "app:car.loyalty.sms:processor",
      tier: "Wasteful",
      composite: 25.4,
      gb_per_day: 17.26,
      annual_cost_usd: 945787.5,
      utilization: 1.16,
      detection: 0.0,
      recommended_action: "Route to S3, use Federated Search for occasional access",
    },
  ],
  security_gaps: {
    mitre_gaps: [
      { sourcetype: "json", mitre_coverage_pct: 0.0, tier: "Important" },
      { sourcetype: "sc4s:events", mitre_coverage_pct: 5.0, tier: "Important" },
    ],
    mitre_gap_count: 2,
    operational_gaps: [{ sourcetype: "fortigate_traffic", detection: 27.5, alert_count: 0 }],
    operational_gap_count: 1,
    detection_coverage_by_domain: {
      infrastructure: 5,
      network: 7,
      cloud: 3,
      endpoint: 0,
      application: 7,
    },
  },
  avg_scores: { utilization: 26.4, detection: 22.3, quality: 99.9 },
  resolution_confidence: 82.5,
  sourcetype_scores: [],
  scoring_config: {
    cost_per_gb_year: 150.0,
    util_weight: 0.35,
    det_weight: 0.4,
    qual_weight: 0.25,
  },
  trust: {
    data_source: "seed",
    fallback_used: true,
    latency_ms: 0,
    confidence: 0.82,
  },
};

// ── Public API ────────────────────────────────────────────────────────────────

export async function getExecutiveSummary(
  config: Partial<ScoringConfig> = {},
): Promise<ExecutiveSummaryResponse> {
  const params = new URLSearchParams();
  if (config.cost_per_gb_year != null) params.set("cost_per_gb", String(config.cost_per_gb_year));
  if (config.util_weight != null) params.set("util_weight", String(config.util_weight));
  if (config.det_weight != null) params.set("det_weight", String(config.det_weight));
  if (config.qual_weight != null) params.set("qual_weight", String(config.qual_weight));

  const path = `/api/v1/telemetry/executive-summary${params.toString() ? `?${params.toString()}` : ""}`;

  return fetchWithFallback<ExecutiveSummaryResponse>({
    path,
    fallbackFactory: () => FALLBACK,
    warningMessage: "[api] Could not fetch executive telemetry summary, using fallback data.",
    timeoutMs: 30_000,
  });
}
