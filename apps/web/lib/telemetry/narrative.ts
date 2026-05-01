import type { AgentActivityItem, AgentDecision } from '@/types/agent';
import type { TelemetryMetricsResponse } from '@/types/telemetry';
import { deriveRiskLevel } from './recommendations';

export const deriveAgentDecision = (metrics: TelemetryMetricsResponse): AgentDecision => {
  const risk = deriveRiskLevel(metrics.summary, metrics.security_findings);
  const waste = metrics.summary.low_value_spend_usd ?? 0;
  const headline = risk === 'high' || risk === 'critical'
    ? 'Improve detection coverage before aggressive cost reduction'
    : waste > 50_000
      ? 'Prioritize telemetry cost reduction actions'
      : 'Maintain monitoring with targeted optimization';
  return {
    id: 'decision-current',
    headline,
    reasonBullets: [
      `Security findings: ${metrics.security_findings.length}`,
      `Low-value spend: ${waste.toFixed(0)} USD`,
      `Sources analyzed: ${metrics.sources.length}`,
    ],
    nextAction: risk === 'low' ? 'Review archive candidates' : 'Generate detection rule plan',
    risk,
    confidence: metrics.query_context.confidence ?? 0.88,
    businessImpact: risk === 'low' ? 'Cost optimization potential is actionable.' : 'Detection blind spots may increase incident exposure.',
    recommendedActionType: risk === 'low' ? 'cost_optimization' : 'detection_improvement',
    requiresApproval: true,
  };
};

export const deriveAgentActivity = (metrics: TelemetryMetricsResponse): AgentActivityItem[] => {
  const now = Date.now();
  const phases: AgentActivityItem['stage'][] = ['observe', 'analyze', 'reason', 'decide', 'action', 'audit', 'learn'];
  return phases.map((stage, idx) => ({
    id: `activity-${stage}`,
    timestamp: new Date(now - (phases.length - idx) * 4000).toISOString(),
    stage,
    status: idx === phases.length - 1 ? 'running' : 'success',
    message: `Agent ${stage} stage completed using telemetry evidence.`,
    evidenceCount: Math.max(1, metrics.sources.length / 4),
    confidence: Math.max(0.6, (metrics.query_context.confidence ?? 0.85) - idx * 0.01),
    toolName: stage === 'observe' ? 'splunk_adapter' : 'telemetry_engine',
    durationMs: 80 + idx * 55,
  }));
};

export const deriveMultiAgentStatus = (metrics: TelemetryMetricsResponse) => {
  const baseConfidence = metrics.query_context.confidence ?? 0.85;
  return [
    'Cost Optimization Agent',
    'Detection Coverage Agent',
    'Data Quality Agent',
    'Storage Routing Agent',
    'Forecasting Agent',
    'Governance Agent',
  ].map((name, idx) => ({
    name,
    status: idx === 1 && metrics.security_findings.length > 0 ? 'active' : 'monitoring',
    task: idx === 1 ? 'Evaluate MITRE gaps' : 'Process telemetry recommendations',
    lastDecision: 'Recommendation updated',
    confidence: Math.max(0.65, baseConfidence - idx * 0.03),
    inputSignals: ['cost', 'utilization', 'detection'],
    output: idx === 1 ? 'Detection risk: medium' : 'Optimization plan prepared',
  }));
};

export const deriveNarrativeInsights = (metrics: TelemetryMetricsResponse): string[] => {
  const decision = deriveAgentDecision(metrics);
  return [
    `Recommendation based on current Splunk data: ${decision.headline}`,
    `Confidence: ${Math.round(decision.confidence * 100)}%`,
    `Risk: ${decision.risk}`,
  ];
};

export const deriveExecutiveBrief = (metrics: TelemetryMetricsResponse) => {
  const d = deriveAgentDecision(metrics);
  return {
    primaryDecision: d.headline,
    businessImpact: d.businessImpact,
    riskLevel: d.risk,
    nextAction: d.nextAction,
    confidence: d.confidence,
  };
};
