export interface IncidentSummary {
  id: string;
  title: string;
  severity: string;
  status: string;
  timestamp: string;
  source?: string;
  event_count?: number;
}

export interface DashboardSummaryResponse {
  stats: {
    active_incidents: number;
    pending_approvals: number;
    avg_confidence: number;
    source_indexes: string[];
    last_updated: string;
  };
  items: IncidentSummary[];
}

export interface ApprovalPayload {
  approver: string;
  decision: "approved" | "rejected";
  reason: string;
}

export interface ApprovalEvent {
  event_id: string;
  workflow_id: string;
  approver: string;
  decision: "approved" | "rejected";
  reason: string;
  created_at: string;
}

export interface PendingApprovalItem {
  workflow_id: string;
  incident_id: string;
  title: string;
  severity: string;
  confidence: number;
  recommendation: string;
  time_queued: string;
}

export interface MonitoringService {
  name: string;
  status: "Healthy" | "Degraded";
  uptime: string;
  latency_ms: number;
  load_percent: number;
}

export interface MonitoringOverview {
  kpis: {
    global_uptime: string;
    active_nodes: number;
    avg_latency_ms: number;
    system_load_percent: number;
  };
  kpi_explanations: {
    label: string;
    formula: string;
    source: "reported" | "derived" | "not_applicable";
    freshness: string;
  }[];
  agent_runtime: {
    window_minutes: number;
    model_provider: string;
    model_name: string;
    runtime_mode: string;
    splunk_mode: string;
    llm_calls: number;
    retrieval_calls: number;
    policy_calls: number;
    avg_llm_latency_ms: number;
    avg_retrieval_latency_ms: number;
    avg_policy_latency_ms: number;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    estimated_cost_usd: number;
    token_source: "reported" | "derived" | "not_applicable";
    cost_source: "reported" | "derived" | "not_applicable";
    freshness: string;
  };
  services: MonitoringService[];
  indexes: {
    name: string;
    size_mb: number;
    event_count: number;
  }[];
  server_info: {
    version: string;
    build: string;
    mode: string;
  };
}

export interface SettingsSnapshot {
  platform_name: string;
  environment: string;
  timezone: string;
  splunk: {
    adapter_mode: string;
    live_mode: boolean;
    base_url: string;
    web_base_url: string;
    connected: boolean;
    index_count: number;
  };
  model: {
    provider: string;
    name: string;
    runtime: string;
    base_url: string;
    mock_mode: boolean;
  };
  security: {
    rbac_enabled: boolean;
    rate_limit_per_minute: number;
    oidc_boundary: boolean;
  };
}

export interface RuntimeConfigPayload {
  model_provider: "ollama" | "anthropic" | "stub";
  model_name: string;
  splunk_adapter_mode: "mcp" | "native" | "auto";
  model_mock_mode: boolean;
  splunk_live_mode: boolean;
}

export interface RuntimeConfigResponse {
  updated: boolean;
  model_provider: string;
  model_name: string;
  splunk_adapter_mode: string;
  model_mock_mode: boolean;
  splunk_live_mode: boolean;
}

export interface RuntimeConnectivityResponse {
  model: {
    connected: boolean;
    detail: string;
  };
  splunk: {
    connected: boolean;
    detail: string;
  };
}

export interface SupportResourcesResponse {
  categories: {
    title: string;
    icon: string;
    links: {
      label: string;
      href: string;
    }[];
  }[];
  contact: {
    email: string;
    chat: string;
  };
}

export interface WasteOffender {
  source_type: string;
  index: string;
  daily_ingest_gb: number;
  search_count_90d: number;
  retention_days: number;
  unused_fields: string[];
  used_fields: string[];
}

export interface WasteRecommendation {
  source_type: string;
  action: string;
  current_retention_days: number;
  recommended_retention_days: number;
  field_savings_pct: number;
  estimated_daily_gb_saved: number;
  estimated_annual_savings_usd: number;
  rationale: string;
}

export interface WasteDemoResponse {
  workflow_id: string;
  scenario: string;
  tenant_id: string;
  summary: string;
  total_wasteful_sources: number;
  total_daily_ingest_gb: number;
  total_daily_wasted_gb: number;
  estimated_annual_savings_usd: number;
  waste_pct: number;
  top_offenders: WasteOffender[];
  recommendations: WasteRecommendation[];
  confidence: number;
  approval_required: boolean;
  guardrail_notes: string[];
  calculation_assumptions?: string[];
  demo_profile?: "standard" | "amplified";
  amplification_factor?: number;
}

export interface SourceUtilizationMetrics {
  name: string;
  index: string;
  daily_ingest_gb: number;
  utilization_score: number;
  value_rating: "High" | "Medium" | "Low";
  annual_spend_usd: number;
  potential_savings_usd: number;
  search_count_90d: number;
  dashboard_references: number;
  alert_references: number;
  recommendation: "Keep" | "Optimize" | "Remove";
}

export interface SecurityFindingDetail {
  id: string;
  category: "Detection" | "Investigation" | "Response";
  title: string;
  severity: "Critical" | "High" | "Medium";
  resolution_confidence_percent: number;
  impact_on_savings_percent: number;
  description: string;
}

export interface SavingsProjectionPoint {
  month: number;
  label: string;
  current_trajectory_usd: number;
  optimized_trajectory_usd: number;
}

export interface TelemetryMetricsResponse {
  summary: {
    total_annual_spend_usd: number;
    total_potential_savings_usd: number;
    avg_utilization_score: number;
    security_gap_count: number;
    recommendation_complexity: "Low" | "Medium" | "High";
  };
  sources: SourceUtilizationMetrics[];
  security_findings: SecurityFindingDetail[];
  savings_projection: SavingsProjectionPoint[];
}
