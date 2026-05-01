import type { SummaryMetrics } from "@/types/telemetry";

export type AgentStatus = "active" | "paused" | "error";
export type AgentMode = "autonomous_monitoring" | "advisory" | "approval_required";
export type AutonomyLevel = "advisory" | "assisted" | "approval_gated" | "autonomous";

export interface WorkspaceContext {
  id: string;
  name: string;
  customerName: string;
  environment: "demo" | "prod" | "pci" | "eu" | "dev" | "security";
  region?: string;
  splunkInstanceLabel: string;
  dataResidency?: string;
  complianceTags: string[];
}

export interface AgentState {
  id: string;
  name: string;
  version: string;
  status: AgentStatus;
  mode: AgentMode;
  autonomyLevel: AutonomyLevel;
  currentGoal: string;
  lastDecisionAt: string;
  confidence: number;
  workspace: WorkspaceContext;
}

export type AgentStage = "observe" | "analyze" | "reason" | "decide" | "action" | "audit" | "learn";
export type EventStatus = "success" | "warning" | "error" | "running";
export type GuardrailDecision = "allowed" | "approval_required" | "risk_scored" | "blocked";

export interface AgentActivityItem {
  id: string;
  timestamp: string;
  stage: AgentStage;
  status: EventStatus;
  message: string;
  evidenceCount: number;
  confidence: number;
  toolName?: string;
  durationMs?: number;
  sourceId?: string;
}

export interface AgentDecision {
  id: string;
  headline: string;
  reasonBullets: string[];
  nextAction: string;
  risk: "low" | "medium" | "high" | "critical";
  confidence: number;
  businessImpact: string;
  recommendedActionType: string;
  requiresApproval: boolean;
}

export interface AgentGuardrailRule {
  id: string;
  actionType: string;
  decision: GuardrailDecision;
  reason: string;
  complianceTags?: Array<"PCI" | "SOX" | "HIPAA" | "SOC2" | "ISO27001">;
  requiresHumanReason: boolean;
}

export interface ApprovalItem {
  id: string;
  actionType: string;
  title: string;
  sourcetype?: string;
  impactUsd?: number;
  risk: "low" | "medium" | "high" | "critical";
  confidence: number;
  rollbackPlan: string;
  guardrailDecision: GuardrailDecision;
  status: "pending" | "approved" | "rejected" | "modified";
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  agentName: string;
  decision: string;
  inputSummary: string;
  confidence: number;
  humanApproval?: "approved" | "rejected" | "not_required";
  workspaceId: string;
  evidenceIds: string[];
  reason?: string;
}

export interface LiveTelemetryEvent {
  id: string;
  timestamp: string;
  severity: "info" | "warning" | "critical";
  eventType: string;
  title: string;
  description: string;
  affectedSource?: string;
  metricDelta?: string;
  recommendedAgentResponse?: string;
}

export interface AgentReplaySnapshot {
  id: string;
  timestamp: string;
  workspaceId: string;
  agentVersion: string;
  telemetrySnapshotHash: string;
  decision: AgentDecision;
  activities: AgentActivityItem[];
  evidence: AuditEntry[];
  metricsSummary: SummaryMetrics;
}

export interface DriftSignal {
  id: string;
  timestamp: string;
  severity: "low" | "medium" | "high";
  driftType: string;
  explanation: string;
  previousState: string;
  currentState: string;
  recommendedReviewAction: string;
}

export interface AgentReliabilityMetrics {
  decisionLatencyMs: number;
  decisionSuccessRate: number;
  evidenceCompleteness: number;
  confidenceTrend: number[];
  errorRate: number;
  fallbackUsageRate: number;
  liveSplunkRatio: number;
  approvalQueueAgingHours: number;
}
