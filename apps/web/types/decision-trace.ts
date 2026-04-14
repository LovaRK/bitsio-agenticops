export type TimelineStatus = "success" | "fail" | "pending";

export type ToolType = "llm" | "retrieval" | "policy" | "transform";
export type MetricSource = "reported" | "derived" | "not_applicable";

export type TokenUsage = {
  prompt: number;
  completion: number;
  total: number;
  source: MetricSource;
};

export type CostUsage = {
  usd: number;
  source: MetricSource;
};

export type ToolCall = {
  tool_name: string;
  status: string;
  tool_type?: ToolType;
  metric_source?: {
    token_usage?: MetricSource;
    latency?: MetricSource;
    confidence_impact?: MetricSource;
    cost_usage?: MetricSource;
  };
  token_usage?: TokenUsage;
  cost_usage?: CostUsage;
  provider?: string;
  model_name?: string;
  runtime_mode?: "local" | "cloud" | "unknown";
  splunk_mode?: "mcp" | "native" | "auto" | "unknown";
  tokens_prompt?: number;
  tokens_completion?: number;
  latency_ms?: number;
  input_preview?: string;
  output_preview?: string;
  confidence_impact?: number;
  explainability_notes?: string[];
};

export type PolicyCheck = {
  rule_id: string;
  matched: boolean;
  action: string;
};

export type NodeRun = {
  node_name: string;
  status: TimelineStatus;
  started_at: string;
  duration_ms: number;
  tool_calls: ToolCall[];
  policy_checks: PolicyCheck[];
};

export type DecisionTrace = {
  workflow_id: string;
  incident_id: string;
  title: string;
  severity: "low" | "medium" | "high";
  timestamp: string;
  source_index: string;
  status: "open" | "triaging" | "pending_approval" | "resolved";
  graph_version: string;
  assigned_agent: string;
  summary: string;
  probable_cause: string;
  confidence: number;
  approval_required: boolean;
  evidence_refs: string[];
  missing_evidence: string[];
  node_runs: NodeRun[];
  run_metadata?: {
    model_provider?: string;
    model_name?: string;
    runtime_mode?: "local" | "cloud";
    splunk_mode?: "mcp" | "native" | "auto";
    run_time_ms?: number;
    source?: MetricSource;
  };
};
