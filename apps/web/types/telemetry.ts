export interface TelemetryMetricsResponse {
  summary: SummaryMetrics;
  sources: SourceProfile[];
  security_findings: SecurityFinding[];
  savings_projection: SavingsProjection[];
  query_context: QueryContext;
}

export interface SummaryMetrics {
  roi_score?: number;
  gainscope?: number;
  total_annual_spend_usd?: number;
  total_potential_savings_usd?: number;
  low_value_spend_usd?: number;
  total_daily_volume_gb?: number;
  total_sourcetypes_assessed?: number;
  avg_utilization_score?: number;
  avg_detection_score?: number;
  avg_quality_score?: number;
  security_gap_count?: number;
  resolution_confidence?: number;
  [key: string]: unknown;
}

export interface SourceProfile {
  sourcetype: string;
  index?: string;
  composite_score?: number;
  score?: number;
  utilization_score?: number;
  detection_score?: number;
  quality_score?: number;
  tier?: "Critical" | "Important" | "Nice-to-Have" | "Wasteful" | string;
  gb_per_day?: number;
  annual_cost_usd?: number;
  potential_savings_usd?: number;
  detection_gap?: boolean;
  recommended_action?: string;
  domain?: "application" | "cloud" | "endpoint" | "infrastructure" | "network" | string;
  confidence?: number;
  raw?: Record<string, unknown>;
}

export interface SecurityFinding {
  id?: string;
  sourcetype?: string;
  finding_type?: string;
  severity?: "low" | "medium" | "high" | "critical" | string;
  domain?: string;
  mitre_coverage?: number;
  lantern_coverage?: number;
  active_alerts?: number;
  description?: string;
}

export interface SavingsProjection {
  stage: string;
  annual_cost_usd: number;
  savings_usd?: number;
  description?: string;
}

export interface QueryContext {
  used_live_data?: boolean;
  fallback_reason?: string;
  adapter_mode?: "mcp" | "native" | "auto" | string;
  fetched_at?: string;
  latency_ms?: number;
  confidence?: number;
  time_window?: string;
  splunk_instance?: string;
  query_method?: string;
}
