import type { AgentActivityItem, AgentReliabilityMetrics } from '@/types/agent';

export const deriveReliability = (activity: AgentActivityItem[]): AgentReliabilityMetrics => {
  const total = activity.length || 1;
  const errors = activity.filter((a) => a.status === 'error').length;
  const avgLatency = activity.reduce((a, b) => a + (b.durationMs ?? 0), 0) / total;
  return {
    decisionLatencyMs: avgLatency,
    decisionSuccessRate: (total - errors) / total,
    evidenceCompleteness: Math.min(1, activity.reduce((a, b) => a + b.evidenceCount, 0) / (total * 5)),
    confidenceTrend: activity.map((a) => a.confidence),
    errorRate: errors / total,
    fallbackUsageRate: 0.1,
    liveSplunkRatio: 0.9,
    approvalQueueAgingHours: 1.2,
  };
};
