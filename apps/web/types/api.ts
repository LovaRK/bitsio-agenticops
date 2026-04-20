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
  runtime: {
    mode: "LOCAL_DEV" | "LOCAL_INTEGRATION" | "CLOUD_MODEL_TEST" | "CLOUD_LIVE";
  };
  security: {
    rbac_enabled: boolean;
    rate_limit_per_minute: number;
    oidc_boundary: boolean;
  };
}

export interface RuntimeConfigPayload {
  runtime_mode?: "LOCAL_DEV" | "LOCAL_INTEGRATION" | "CLOUD_MODEL_TEST" | "CLOUD_LIVE";
  model_provider: "ollama" | "anthropic" | "stub";
  model_name: string;
  splunk_adapter_mode: "mcp" | "native" | "auto";
  model_mock_mode: boolean;
  splunk_live_mode: boolean;
}

export interface RuntimeConfigResponse {
  updated: boolean;
  runtime_mode: "LOCAL_DEV" | "LOCAL_INTEGRATION" | "CLOUD_MODEL_TEST" | "CLOUD_LIVE";
  model_provider: string;
  model_name: string;
  splunk_adapter_mode: string;
  model_mock_mode: boolean;
  splunk_live_mode: boolean;
  tunnel_status?: "not_required" | "already_active" | "started" | "failed";
  tunnel_message?: string;
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

export interface FraudCaseItem {
  case_id: string;
  incident_id: string;
  vendor: string;
  user: string;
  amount_usd: number;
  risk_score: number;
  status: string;
  requires_approval: boolean;
  anomaly_types: string[];
  event_count: number;
  timestamp: string;
  source_index: string;
}

export interface FraudSummary {
  open_cases: number;
  high_risk_cases: number;
  approval_required_cases: number;
  avg_risk_score: number;
  total_amount_reviewed_usd: number;
  potential_exposure_usd: number;
  recommended_hold_amount_usd: number;
}

export interface FraudPolicyEvaluation {
  policy_id: string;
  policy_version: string;
  rule_triggered: string;
  approval_reason: string;
  source: "reported" | "derived";
}

export interface FraudDataQuality {
  completeness_score: number;
  freshness_seconds: number;
  accuracy_confidence: number;
  validation_passed: boolean;
  source: "reported" | "derived";
}

export interface FraudCompliance {
  data_classification: "internal" | "confidential" | "restricted";
  compliance_frameworks: string[];
  encryption_required: string;
  source: "reported" | "derived";
}

export interface FraudAgentTelemetry {
  agent_id: string;
  agent_version: string;
  agent_capabilities: string;
  action_confidence: number;
  human_in_the_loop: boolean;
  source: "reported" | "derived";
}

export interface FraudPricingContext {
  primary_buyer: string;
  annual_subscription_arr_usd: string;
  one_time_onboarding_usd: string;
  optional_managed_tuning_usd_per_year: string;
}

export interface FraudOverviewResponse {
  mode: "live" | "seed";
  degraded_reason: string | null;
  generated_at: string;
  summary: FraudSummary;
  active_cases: FraudCaseItem[];
  signal_breakdown: Record<string, number>;
  policy_evaluation: FraudPolicyEvaluation;
  data_quality: FraudDataQuality;
  compliance: FraudCompliance;
  agent_telemetry: FraudAgentTelemetry;
  pricing_context: FraudPricingContext;
  narrative: string;
}
