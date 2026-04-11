export type TimelineStatus = "success" | "fail" | "pending";

export type ToolCall = {
  tool_name: string;
  status: string;
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
};
